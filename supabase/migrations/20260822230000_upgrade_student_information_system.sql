alter table public.students
  add column if not exists profile_photo_path text unique check (profile_photo_path is null or char_length(profile_photo_path) between 1 and 500),
  add column if not exists preferred_name text check (preferred_name is null or char_length(preferred_name) between 1 and 100),
  add column if not exists blood_group text check (blood_group is null or blood_group in ('a_positive','a_negative','b_positive','b_negative','ab_positive','ab_negative','o_positive','o_negative','unknown')),
  add column if not exists student_category text check (student_category is null or char_length(student_category) <= 100),
  add column if not exists aadhaar_number text check (aadhaar_number is null or aadhaar_number ~ '^[0-9]{12}$'),
  add column if not exists nationality text check (nationality is null or char_length(nationality) <= 100),
  add column if not exists mother_tongue text check (mother_tongue is null or char_length(mother_tongue) <= 100),
  add column if not exists previous_school_name text check (previous_school_name is null or char_length(previous_school_name) <= 200),
  add column if not exists previous_class text check (previous_class is null or char_length(previous_class) <= 100),
  add column if not exists previous_school_tc_number text check (previous_school_tc_number is null or char_length(previous_school_tc_number) <= 100),
  add column if not exists previous_school_location text check (previous_school_location is null or char_length(previous_school_location) <= 200),
  add column if not exists admission_remarks text check (admission_remarks is null or char_length(admission_remarks) <= 2000),
  add column if not exists father_name text check (father_name is null or char_length(father_name) <= 160),
  add column if not exists father_mobile text check (father_mobile is null or char_length(father_mobile) between 7 and 30),
  add column if not exists father_email text check (father_email is null or char_length(father_email) <= 254),
  add column if not exists father_occupation text check (father_occupation is null or char_length(father_occupation) <= 160),
  add column if not exists mother_mobile text check (mother_mobile is null or char_length(mother_mobile) between 7 and 30),
  add column if not exists mother_email text check (mother_email is null or char_length(mother_email) <= 254),
  add column if not exists mother_occupation text check (mother_occupation is null or char_length(mother_occupation) <= 160),
  add column if not exists guardian_name text check (guardian_name is null or char_length(guardian_name) <= 160),
  add column if not exists guardian_relationship text check (guardian_relationship is null or char_length(guardian_relationship) <= 100),
  add column if not exists guardian_mobile text check (guardian_mobile is null or char_length(guardian_mobile) between 7 and 30),
  add column if not exists guardian_email text check (guardian_email is null or char_length(guardian_email) <= 254),
  add column if not exists primary_contact text check (primary_contact is null or primary_contact in ('father','mother','guardian')),
  add column if not exists emergency_contact_name text check (emergency_contact_name is null or char_length(emergency_contact_name) <= 160),
  add column if not exists emergency_contact_relationship text check (emergency_contact_relationship is null or char_length(emergency_contact_relationship) <= 100),
  add column if not exists emergency_contact_mobile text check (emergency_contact_mobile is null or char_length(emergency_contact_mobile) between 7 and 30),
  add column if not exists door_number text check (door_number is null or char_length(door_number) <= 80),
  add column if not exists street text check (street is null or char_length(street) <= 160),
  add column if not exists area_locality text check (area_locality is null or char_length(area_locality) <= 120),
  add column if not exists village_town_city text check (village_town_city is null or char_length(village_town_city) <= 120),
  add column if not exists mandal text check (mandal is null or char_length(mandal) <= 120),
  add column if not exists district text check (district is null or char_length(district) <= 120),
  add column if not exists identification_mark_1 text check (identification_mark_1 is null or char_length(identification_mark_1) <= 250),
  add column if not exists identification_mark_2 text check (identification_mark_2 is null or char_length(identification_mark_2) <= 250),
  add column if not exists transport_required boolean not null default false,
  add column if not exists general_notes text check (general_notes is null or char_length(general_notes) <= 4000);

create index if not exists students_name_admission_idx on public.students (full_name, admission_number);
create index if not exists students_photo_path_idx on public.students (profile_photo_path) where profile_photo_path is not null;

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  document_type text not null check (document_type in ('birth_certificate','aadhaar','transfer_certificate','previous_school_record','photograph_other','other')),
  title text not null check (char_length(title) between 1 and 180),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists student_documents_student_created_idx on public.student_documents (student_id, created_at desc);

create or replace function public.set_student_document_audit_fields()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by = auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists student_documents_audit on public.student_documents;
create trigger student_documents_audit before insert on public.student_documents for each row execute function public.set_student_document_audit_fields();

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  note text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists student_notes_student_updated_idx on public.student_notes (student_id, updated_at desc);

create or replace function public.set_student_note_audit_fields()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by = auth.uid(); end if;
  new.updated_by = auth.uid(); new.updated_at = now(); return new;
end;
$$;

drop trigger if exists student_notes_audit on public.student_notes;
create trigger student_notes_audit before insert or update on public.student_notes for each row execute function public.set_student_note_audit_fields();

alter table public.student_documents enable row level security;
alter table public.student_notes enable row level security;
revoke all on public.student_documents, public.student_notes from anon, authenticated;
grant select, insert, update, delete on public.student_documents to authenticated;
grant select, insert, update on public.student_notes to authenticated;
create policy "Active admins manage student documents" on public.student_documents for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Active admins manage student notes" on public.student_notes for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-documents', 'student-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Active admins manage student photos" on storage.objects for all to authenticated
  using (bucket_id = 'student-photos' and public.is_active_admin() and (storage.foldername(name))[1] = 'student-photos' and exists (select 1 from public.students where id::text = (storage.foldername(name))[2]))
  with check (bucket_id = 'student-photos' and public.is_active_admin() and (storage.foldername(name))[1] = 'student-photos' and exists (select 1 from public.students where id::text = (storage.foldername(name))[2]));
create policy "Active admins manage student documents storage" on storage.objects for all to authenticated
  using (bucket_id = 'student-documents' and public.is_active_admin() and (storage.foldername(name))[1] = 'student-documents' and exists (select 1 from public.students where id::text = (storage.foldername(name))[2]))
  with check (bucket_id = 'student-documents' and public.is_active_admin() and (storage.foldername(name))[1] = 'student-documents' and exists (select 1 from public.students where id::text = (storage.foldername(name))[2]));
