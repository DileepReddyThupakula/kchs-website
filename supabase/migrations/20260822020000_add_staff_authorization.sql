-- Add explicit staff authorization and preserve private admissions records.
create table public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff_users enable row level security;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users
    where user_id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to authenticated;

create policy "Staff can read their own authorization"
on public.staff_users
for select
to authenticated
using (user_id = auth.uid());

create policy "Active staff can read admissions"
on public.admission_enquiries
for select
to authenticated
using (public.is_active_staff());

create policy "Active staff can update admissions"
on public.admission_enquiries
for update
to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());
