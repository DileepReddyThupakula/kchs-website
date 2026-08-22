create extension if not exists "pgcrypto";

do $$ begin
  create type public.event_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_type as enum ('academic', 'exam', 'holiday', 'meeting', 'sports', 'cultural', 'admissions', 'celebration', 'other');
exception when duplicate_object then null;
end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  description text check (description is null or char_length(description) <= 6000),
  event_type public.event_type not null default 'other',
  start_at timestamptz not null,
  end_at timestamptz,
  location text check (location is null or char_length(location) <= 240),
  status public.event_status not null default 'draft',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  check (end_at is null or end_at >= start_at)
);

create index if not exists events_status_start_at_idx on public.events (status, start_at asc);
create index if not exists events_public_start_at_idx on public.events (start_at asc) where status = 'published' and is_public = true;

create or replace function public.set_events_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
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

drop trigger if exists set_events_audit_fields on public.events;
create trigger set_events_audit_fields
before insert or update on public.events
for each row execute function public.set_events_audit_fields();

alter table public.events enable row level security;

-- Explicit Data API privileges: public visitors can only read; staff can mutate without DELETE.
revoke all on table public.events from anon, authenticated;
grant select on table public.events to anon;
grant select, insert, update on table public.events to authenticated;

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
on public.events for select to anon, authenticated
using (status = 'published' and is_public = true);

drop policy if exists "Active staff can read events" on public.events;
create policy "Active staff can read events"
on public.events for select to authenticated
using (public.is_active_staff());

drop policy if exists "Active staff can create events" on public.events;
create policy "Active staff can create events"
on public.events for insert to authenticated
with check (public.is_active_staff());

drop policy if exists "Active staff can update events" on public.events;
create policy "Active staff can update events"
on public.events for update to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());
