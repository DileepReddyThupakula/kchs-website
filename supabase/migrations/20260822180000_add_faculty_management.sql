do $$ begin create type public.faculty_status as enum ('active', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.faculty_department as enum ('leadership', 'teaching_staff', 'primary', 'mathematics', 'science', 'social_studies', 'english', 'telugu', 'hindi', 'physical_education', 'administration', 'support_staff', 'other'); exception when duplicate_object then null; end $$;

create table public.faculty_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 140),
  designation text not null check (char_length(designation) between 1 and 140),
  department public.faculty_department not null default 'teaching_staff',
  qualification text check (qualification is null or char_length(qualification) <= 240),
  bio text check (bio is null or char_length(bio) <= 1600),
  photo_path text unique check (photo_path is null or char_length(photo_path) between 1 and 500),
  display_order integer not null default 0 check (display_order between 0 and 10000),
  is_public boolean not null default true,
  status public.faculty_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index faculty_members_staff_list_idx on public.faculty_members (status, department, display_order, updated_at desc);
create index faculty_members_public_list_idx on public.faculty_members (display_order, full_name) where status = 'active' and is_public = true;

create or replace function public.set_faculty_member_audit_fields() returns trigger language plpgsql security invoker set search_path = public as $$ begin
  if tg_op = 'INSERT' then new.created_by = auth.uid(); end if;
  new.updated_by = auth.uid(); new.updated_at = now(); return new;
end; $$;
create trigger set_faculty_member_audit_fields before insert or update on public.faculty_members for each row execute function public.set_faculty_member_audit_fields();

alter table public.faculty_members enable row level security;
revoke all on public.faculty_members from anon, authenticated;
grant select on public.faculty_members to anon;
grant select, insert, update on public.faculty_members to authenticated;
create policy "Public can read active public faculty" on public.faculty_members for select to anon, authenticated using (status = 'active' and is_public = true);
create policy "Active staff can read faculty" on public.faculty_members for select to authenticated using (public.is_active_staff());
create policy "Active staff can create faculty" on public.faculty_members for insert to authenticated with check (public.is_active_staff());
create policy "Active staff can update faculty" on public.faculty_members for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('faculty-photos', 'faculty-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
create policy "Public can read eligible faculty photos" on storage.objects for select to anon, authenticated using (bucket_id = 'faculty-photos' and exists (select 1 from public.faculty_members f where f.photo_path = name and f.status = 'active' and f.is_public = true));
create policy "Active staff can read faculty photos" on storage.objects for select to authenticated using (bucket_id = 'faculty-photos' and public.is_active_staff());
create policy "Active staff can upload faculty photos" on storage.objects for insert to authenticated with check (bucket_id = 'faculty-photos' and public.is_active_staff());
create policy "Active staff can update faculty photos" on storage.objects for update to authenticated using (bucket_id = 'faculty-photos' and public.is_active_staff()) with check (bucket_id = 'faculty-photos' and public.is_active_staff());
create policy "Active staff can remove faculty photos" on storage.objects for delete to authenticated using (bucket_id = 'faculty-photos' and public.is_active_staff());
