-- Additive Phase 3 admissions foundation. Apply through Supabase CLI or a
-- reviewed Postgres migration runner; this migration does not expose data publicly.
create extension if not exists pgcrypto;

do $$
begin
  create type public.admission_enquiry_status as enum ('new', 'contacted', 'follow_up', 'admitted', 'closed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.admission_enquiries (
  id uuid primary key default gen_random_uuid(),
  guardian_name text not null check (char_length(guardian_name) <= 120),
  student_name text not null check (char_length(student_name) <= 120),
  class_seeking text not null check (class_seeking in ('Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10')),
  phone_number text not null check (phone_number ~ '^\\+91[6-9][0-9]{9}$'),
  email_address text,
  message text check (message is null or char_length(message) <= 1000),
  status public.admission_enquiry_status not null default 'new',
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admission_enquiries_created_at_idx on public.admission_enquiries (created_at desc);
create index if not exists admission_enquiries_status_idx on public.admission_enquiries (status);
create index if not exists admission_enquiries_class_seeking_idx on public.admission_enquiries (class_seeking);

create or replace function public.set_admission_enquiries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admission_enquiries_set_updated_at
before update on public.admission_enquiries
for each row execute function public.set_admission_enquiries_updated_at();

alter table public.admission_enquiries enable row level security;
-- No public policies are intentionally created. Future staff access must use
-- authenticated, server-side authorization; public inserts stay in Server Actions.
