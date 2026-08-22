do $$ begin
  create type public.student_status as enum ('active', 'inactive', 'graduated', 'transferred');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.student_enrollment_status as enum ('active', 'inactive', 'completed', 'transferred');
exception when duplicate_object then null;
end $$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_number text not null unique check (char_length(admission_number) between 1 and 50),
  full_name text not null check (char_length(full_name) between 1 and 160),
  photo_path text check (photo_path is null or char_length(photo_path) <= 500),
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'other', 'not_specified')),
  father_guardian_name text check (father_guardian_name is null or char_length(father_guardian_name) between 1 and 160),
  mother_name text check (mother_name is null or char_length(mother_name) between 1 and 160),
  primary_phone text check (primary_phone is null or char_length(primary_phone) between 7 and 30),
  secondary_phone text check (secondary_phone is null or char_length(secondary_phone) between 7 and 30),
  email text check (email is null or char_length(email) <= 254),
  address_line_1 text check (address_line_1 is null or char_length(address_line_1) <= 200),
  address_line_2 text check (address_line_2 is null or char_length(address_line_2) <= 200),
  locality text check (locality is null or char_length(locality) <= 120),
  city text check (city is null or char_length(city) <= 120),
  state text check (state is null or char_length(state) <= 120),
  postal_code text check (postal_code is null or char_length(postal_code) between 3 and 20),
  admission_date date not null default current_date,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  academic_section_id uuid not null references public.academic_sections(id) on delete restrict,
  roll_number text check (roll_number is null or char_length(roll_number) between 1 and 30),
  status public.student_enrollment_status not null default 'active',
  enrollment_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (student_id, academic_year_id)
);

create unique index student_enrollments_section_roll_number_idx
  on public.student_enrollments (academic_section_id, roll_number)
  where roll_number is not null;
create index students_status_name_idx on public.students (status, full_name);
create index students_admission_number_idx on public.students (admission_number);
create index student_enrollments_student_idx on public.student_enrollments (student_id, academic_year_id desc);
create index student_enrollments_current_lookup_idx on public.student_enrollments (academic_year_id, class_id, academic_section_id, status);

create or replace function public.set_student_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then new.created_by = auth.uid(); end if;
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.assert_valid_student_enrollment_section()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.academic_sections
    where id = new.academic_section_id
      and academic_year_id = new.academic_year_id
      and class_id = new.class_id
  ) then
    raise exception 'Enrollment section must belong to the selected academic year and class' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_audit
before insert or update on public.students
for each row execute function public.set_student_audit_fields();

create trigger student_enrollments_audit
before insert or update on public.student_enrollments
for each row execute function public.set_student_audit_fields();

create trigger student_enrollments_section_check
before insert or update on public.student_enrollments
for each row execute function public.assert_valid_student_enrollment_section();

alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;

revoke all on public.students, public.student_enrollments from anon, authenticated;
grant select, insert, update on public.students, public.student_enrollments to authenticated;

create policy "Active admins manage students"
  on public.students for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy "Active admins manage student enrollments"
  on public.student_enrollments for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create or replace function public.create_student_with_enrollment(
  p_admission_number text,
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_father_guardian_name text,
  p_mother_name text,
  p_primary_phone text,
  p_secondary_phone text,
  p_email text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_locality text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_admission_date date,
  p_status public.student_status,
  p_academic_year_id uuid,
  p_class_id uuid,
  p_academic_section_id uuid,
  p_roll_number text,
  p_enrollment_date date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Student management is restricted to active administrators' using errcode = '42501';
  end if;

  insert into public.students (
    admission_number, full_name, date_of_birth, gender, father_guardian_name, mother_name,
    primary_phone, secondary_phone, email, address_line_1, address_line_2, locality, city,
    state, postal_code, admission_date, status
  ) values (
    p_admission_number, p_full_name, p_date_of_birth, p_gender, p_father_guardian_name, p_mother_name,
    p_primary_phone, p_secondary_phone, p_email, p_address_line_1, p_address_line_2, p_locality, p_city,
    p_state, p_postal_code, p_admission_date, p_status
  ) returning id into v_student_id;

  insert into public.student_enrollments (
    student_id, academic_year_id, class_id, academic_section_id, roll_number, enrollment_date
  ) values (
    v_student_id, p_academic_year_id, p_class_id, p_academic_section_id, p_roll_number, p_enrollment_date
  );

  return v_student_id;
end;
$$;

revoke all on function public.create_student_with_enrollment(
  text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, date,
  public.student_status, uuid, uuid, uuid, text, date
) from public;
grant execute on function public.create_student_with_enrollment(
  text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, date,
  public.student_status, uuid, uuid, uuid, text, date
) to authenticated;
