-- Phase 7 notices management. This is additive and leaves admissions/auth unchanged.
create extension if not exists pgcrypto;

do $$
begin
  create type public.notice_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notice_priority as enum ('normal', 'important', 'urgent');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  summary text check (summary is null or char_length(summary) <= 400),
  content text not null check (char_length(content) between 1 and 6000),
  status public.notice_status not null default 'draft',
  priority public.notice_priority not null default 'normal',
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  check (expires_at is null or published_at is null or expires_at > published_at)
);

create index if not exists notices_status_updated_at_idx on public.notices (status, updated_at desc);
create index if not exists notices_published_at_idx on public.notices (published_at desc) where status = 'published';

create or replace function public.set_notices_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
  end if;

  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

create trigger notices_set_audit_fields
before insert or update on public.notices
for each row execute function public.set_notices_audit_fields();

alter table public.notices enable row level security;

create policy "Public can read active published notices"
on public.notices
for select
to anon, authenticated
using (
  status = 'published'
  and (published_at is null or published_at <= now())
  and (expires_at is null or expires_at > now())
);

create policy "Active staff can read notices"
on public.notices
for select
to authenticated
using (public.is_active_staff());

create policy "Active staff can create notices"
on public.notices
for insert
to authenticated
with check (public.is_active_staff());

create policy "Active staff can update notices"
on public.notices
for update
to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());
