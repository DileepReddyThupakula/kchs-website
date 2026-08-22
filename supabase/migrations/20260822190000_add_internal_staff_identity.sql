do $$ begin create type public.staff_member_type as enum ('teacher', 'non_teaching'); exception when duplicate_object then null; end $$;
do $$ begin create type public.staff_employment_status as enum ('active', 'inactive'); exception when duplicate_object then null; end $$;

create or replace function public.is_active_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_users where user_id = auth.uid() and role = 'admin' and active = true);
$$;
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique check (char_length(employee_code) between 1 and 40),
  full_name text not null check (char_length(full_name) between 1 and 140),
  staff_type public.staff_member_type not null,
  designation text not null check (char_length(designation) between 1 and 140),
  employment_status public.staff_employment_status not null default 'active',
  phone text check (phone is null or char_length(phone) between 7 and 30),
  email text check (email is null or char_length(email) <= 254),
  joining_date date,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
create index staff_members_type_status_idx on public.staff_members (staff_type, employment_status, full_name);
create index staff_members_auth_user_idx on public.staff_members (auth_user_id) where auth_user_id is not null;

create or replace function public.set_staff_member_audit_fields() returns trigger language plpgsql security invoker set search_path = public as $$ begin
  if tg_op = 'INSERT' then new.created_by = auth.uid(); end if;
  new.updated_by = auth.uid(); new.updated_at = now(); return new;
end; $$;
create trigger set_staff_member_audit_fields before insert or update on public.staff_members for each row execute function public.set_staff_member_audit_fields();

alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant select, insert, update on public.staff_members to authenticated;
create policy "Active admins can read staff members" on public.staff_members for select to authenticated using (public.is_active_admin());
create policy "Active admins can create staff members" on public.staff_members for insert to authenticated with check (public.is_active_admin());
create policy "Active admins can update staff members" on public.staff_members for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

alter table public.faculty_members add column staff_member_id uuid unique references public.staff_members(id) on delete set null;
create index faculty_members_staff_member_idx on public.faculty_members (staff_member_id) where staff_member_id is not null;
