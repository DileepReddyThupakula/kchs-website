-- Student attendance Phase 1: admin-only, enrollment-linked daily attendance.
-- Effective-date convention: student_enrollments.ended_on is the first date the
-- source enrollment is no longer attendance-eligible. An enrollment is eligible
-- when enrollment_date <= attendance_date and (ended_on is null or attendance_date < ended_on).

do $$ begin
  create type public.student_attendance_status as enum ('present', 'absent', 'late', 'excused');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.student_attendance_session_state as enum ('open', 'locked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.student_attendance_revision_action as enum ('correction', 'locked', 'unlocked');
exception when duplicate_object then null;
end $$;

create table public.student_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  attendance_date date not null,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  class_id uuid not null references public.school_classes(id) on delete restrict,
  academic_section_id uuid not null,
  state public.student_attendance_session_state not null default 'open',
  revision integer not null default 0 check (revision >= 0),
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (attendance_date, academic_year_id, class_id, academic_section_id),
  foreign key (academic_section_id, academic_year_id, class_id)
    references public.academic_sections(id, academic_year_id, class_id)
    on delete restrict,
  check (
    (state = 'locked') = (locked_at is not null)
    and (state = 'locked') = (locked_by is not null)
  )
);

create table public.student_attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references public.student_attendance_sessions(id) on delete restrict,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete restrict,
  status public.student_attendance_status not null,
  remark text check (remark is null or char_length(remark) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (attendance_session_id, student_enrollment_id)
);

create table public.student_attendance_revisions (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references public.student_attendance_sessions(id) on delete restrict,
  attendance_record_id uuid references public.student_attendance_records(id) on delete restrict,
  action public.student_attendance_revision_action not null,
  previous_status public.student_attendance_status,
  next_status public.student_attendance_status,
  previous_remark text,
  next_remark text,
  reason text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (reason is null or char_length(reason) between 1 and 500),
  check (
    (action = 'correction' and attendance_record_id is not null and reason is not null)
    or action in ('locked', 'unlocked')
  )
);

create index student_attendance_sessions_year_date_section_idx
  on public.student_attendance_sessions (academic_year_id, attendance_date, class_id, academic_section_id);
create index student_attendance_records_enrollment_session_idx
  on public.student_attendance_records (student_enrollment_id, attendance_session_id);
create index student_attendance_revisions_session_created_idx
  on public.student_attendance_revisions (attendance_session_id, created_at);
create index student_enrollments_attendance_roster_idx
  on public.student_enrollments (academic_year_id, class_id, academic_section_id, enrollment_date, ended_on, student_id);

create or replace function public.set_student_attendance_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
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

create or replace function public.assert_student_attendance_session_configuration()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.attendance_date > (timezone('Asia/Kolkata', now()))::date then
    raise exception 'Attendance cannot be recorded for a future date' using errcode = '23514';
  end if;

  perform 1
  from public.academic_years y
  join public.school_classes c on c.id = new.class_id and c.active
  join public.academic_sections s on s.id = new.academic_section_id
    and s.academic_year_id = new.academic_year_id
    and s.class_id = new.class_id
    and s.active
  where y.id = new.academic_year_id
    and y.status in ('planning', 'current')
    and new.attendance_date between y.start_date and y.end_date;

  if not found then
    raise exception 'Attendance requires an eligible academic year, class, section, and date' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.assert_student_attendance_record_eligibility()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.student_attendance_sessions s
    join public.student_enrollments e on e.id = new.student_enrollment_id
      and e.academic_year_id = s.academic_year_id
      and e.class_id = s.class_id
      and e.academic_section_id = s.academic_section_id
      and e.enrollment_date <= s.attendance_date
      and (e.ended_on is null or s.attendance_date < e.ended_on)
      and (e.status = 'active' or e.ended_on is not null)
    where s.id = new.attendance_session_id
  ) then
    raise exception 'Attendance record enrollment is not eligible for this session date and placement' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger student_attendance_sessions_audit
before insert or update on public.student_attendance_sessions
for each row execute function public.set_student_attendance_audit_fields();

create trigger student_attendance_sessions_configuration
before insert or update of attendance_date, academic_year_id, class_id, academic_section_id
on public.student_attendance_sessions
for each row execute function public.assert_student_attendance_session_configuration();

create trigger student_attendance_records_audit
before insert or update on public.student_attendance_records
for each row execute function public.set_student_attendance_audit_fields();

create trigger student_attendance_records_eligibility
before insert or update of attendance_session_id, student_enrollment_id
on public.student_attendance_records
for each row execute function public.assert_student_attendance_record_eligibility();

alter table public.student_attendance_sessions enable row level security;
alter table public.student_attendance_records enable row level security;
alter table public.student_attendance_revisions enable row level security;

revoke all on public.student_attendance_sessions, public.student_attendance_records, public.student_attendance_revisions from public, anon, authenticated;
grant select on public.student_attendance_sessions, public.student_attendance_records, public.student_attendance_revisions to authenticated;

create policy "Active admins can read attendance sessions"
on public.student_attendance_sessions for select to authenticated
using ((select public.is_active_admin()));

create policy "Active admins can read attendance records"
on public.student_attendance_records for select to authenticated
using ((select public.is_active_admin()));

create policy "Active admins can read attendance revisions"
on public.student_attendance_revisions for select to authenticated
using ((select public.is_active_admin()));

create or replace function public.get_student_attendance_roster(
  p_academic_year_id uuid,
  p_class_id uuid,
  p_academic_section_id uuid,
  p_attendance_date date
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.student_attendance_sessions%rowtype;
  v_rows jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into v_session
  from public.student_attendance_sessions
  where academic_year_id = p_academic_year_id
    and class_id = p_class_id
    and academic_section_id = p_academic_section_id
    and attendance_date = p_attendance_date;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'attendance_record_id', r.id,
      'student_enrollment_id', e.id,
      'student_id', st.id,
      'admission_number', st.admission_number,
      'full_name', st.full_name,
      'status', r.status,
      'remark', r.remark
    ) order by lower(st.full_name), st.admission_number, e.id), '[]'::jsonb)
    into v_rows
    from public.student_attendance_records r
    join public.student_enrollments e on e.id = r.student_enrollment_id
    join public.students st on st.id = e.student_id
    where r.attendance_session_id = v_session.id;
  else
    perform 1
    from public.academic_years y
    join public.school_classes c on c.id = p_class_id and c.active
    join public.academic_sections s on s.id = p_academic_section_id
      and s.academic_year_id = p_academic_year_id
      and s.class_id = p_class_id
      and s.active
    where y.id = p_academic_year_id
      and y.status in ('planning', 'current')
      and p_attendance_date between y.start_date and y.end_date
      and p_attendance_date <= (timezone('Asia/Kolkata', now()))::date;
    if not found then
      raise exception 'Attendance requires an eligible academic year, class, section, and date' using errcode = '23514';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'attendance_record_id', null,
      'student_enrollment_id', e.id,
      'student_id', st.id,
      'admission_number', st.admission_number,
      'full_name', st.full_name,
      'status', 'present',
      'remark', null
    ) order by lower(st.full_name), st.admission_number, e.id), '[]'::jsonb)
    into v_rows
    from public.student_enrollments e
    join public.students st on st.id = e.student_id
    where e.academic_year_id = p_academic_year_id
      and e.class_id = p_class_id
      and e.academic_section_id = p_academic_section_id
      and e.enrollment_date <= p_attendance_date
      and (e.ended_on is null or p_attendance_date < e.ended_on)
      and (e.status = 'active' or e.ended_on is not null);
  end if;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', coalesce(v_session.state::text, 'open'),
    'revision', coalesce(v_session.revision, 0),
    'rows', v_rows
  );
end;
$$;

create or replace function public.save_student_attendance(
  p_academic_year_id uuid,
  p_class_id uuid,
  p_academic_section_id uuid,
  p_attendance_date date,
  p_expected_revision integer,
  p_records jsonb,
  p_correction_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.student_attendance_sessions%rowtype;
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(p_correction_reason), '');
  v_roster_ids uuid[];
  v_submitted_ids uuid[];
  v_submitted_count integer;
  v_existing boolean := false;
  v_changed boolean := false;
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Attendance revision is invalid' using errcode = '23514';
  end if;
  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'Attendance records must be an array' using errcode = '23514';
  end if;

  insert into public.student_attendance_sessions (
    attendance_date, academic_year_id, class_id, academic_section_id
  ) values (
    p_attendance_date, p_academic_year_id, p_class_id, p_academic_section_id
  ) on conflict (attendance_date, academic_year_id, class_id, academic_section_id) do nothing;

  select * into v_session
  from public.student_attendance_sessions
  where attendance_date = p_attendance_date
    and academic_year_id = p_academic_year_id
    and class_id = p_class_id
    and academic_section_id = p_academic_section_id
  for update;

  if v_session.revision <> p_expected_revision then
    raise exception 'Attendance was updated by another administrator' using errcode = '40001';
  end if;
  if v_session.state = 'locked' then
    raise exception 'Attendance session is locked' using errcode = '23514';
  end if;

  select array_agg(e.id order by e.id)
  into v_roster_ids
  from public.student_enrollments e
  where e.academic_year_id = p_academic_year_id
    and e.class_id = p_class_id
    and e.academic_section_id = p_academic_section_id
    and e.enrollment_date <= p_attendance_date
    and (e.ended_on is null or p_attendance_date < e.ended_on)
    and (e.status = 'active' or e.ended_on is not null);

  if coalesce(cardinality(v_roster_ids), 0) = 0 then
    raise exception 'Attendance roster is empty' using errcode = '23514';
  end if;

  with submitted as (
    select enrollment_id, status, nullif(btrim(remark), '') as remark
    from jsonb_to_recordset(p_records) as x(
      enrollment_id uuid,
      status public.student_attendance_status,
      remark text
    )
  )
  select array_agg(enrollment_id order by enrollment_id), count(*)::integer
  into v_submitted_ids, v_submitted_count
  from submitted;

  if v_submitted_count <> coalesce(cardinality(v_roster_ids), 0)
    or v_submitted_ids is null
    or exists (select 1 from unnest(v_submitted_ids) id where id is null)
    or cardinality(v_submitted_ids) <> cardinality(array(select distinct id from unnest(v_submitted_ids) id))
    or v_submitted_ids is distinct from v_roster_ids then
    raise exception 'Attendance submission must match the full eligible roster exactly' using errcode = '23514';
  end if;

  with submitted as (
    select enrollment_id, status, nullif(btrim(remark), '') as remark
    from jsonb_to_recordset(p_records) as x(
      enrollment_id uuid,
      status public.student_attendance_status,
      remark text
    )
  )
  select exists (
    select 1
    from public.student_attendance_records r
    join submitted x on x.enrollment_id = r.student_enrollment_id
    where r.attendance_session_id = v_session.id
      and (r.status is distinct from x.status or r.remark is distinct from x.remark)
  ) into v_changed;

  select exists (
    select 1 from public.student_attendance_records where attendance_session_id = v_session.id
  ) into v_existing;

  if v_existing and v_changed and p_attendance_date < (timezone('Asia/Kolkata', now()))::date and v_reason is null then
    raise exception 'A correction reason is required for previous-day attendance changes' using errcode = '23514';
  end if;

  if v_existing and v_changed and p_attendance_date < (timezone('Asia/Kolkata', now()))::date then
    insert into public.student_attendance_revisions (
      attendance_session_id, attendance_record_id, action,
      previous_status, next_status, previous_remark, next_remark, reason, actor_user_id
    )
    select v_session.id, r.id, 'correction', r.status, x.status, r.remark, x.remark, v_reason, v_actor
    from public.student_attendance_records r
    join jsonb_to_recordset(p_records) as x(
      enrollment_id uuid,
      status public.student_attendance_status,
      remark text
    ) on x.enrollment_id = r.student_enrollment_id
    where r.attendance_session_id = v_session.id
      and (r.status is distinct from x.status or r.remark is distinct from nullif(btrim(x.remark), ''));
  end if;

  insert into public.student_attendance_records (
    attendance_session_id, student_enrollment_id, status, remark
  )
  select v_session.id, x.enrollment_id, x.status, nullif(btrim(x.remark), '')
  from jsonb_to_recordset(p_records) as x(
    enrollment_id uuid,
    status public.student_attendance_status,
    remark text
  )
  on conflict (attendance_session_id, student_enrollment_id)
  do update set status = excluded.status, remark = excluded.remark;

  update public.student_attendance_sessions
  set revision = revision + 1
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object('session_id', v_session.id, 'state', v_session.state, 'revision', v_session.revision);
end;
$$;

create or replace function public.lock_student_attendance_session(
  p_session_id uuid,
  p_expected_revision integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_session public.student_attendance_sessions%rowtype;
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_session from public.student_attendance_sessions where id = p_session_id for update;
  if not found then raise exception 'Attendance session not found' using errcode = 'P0002'; end if;
  if v_session.revision <> p_expected_revision then raise exception 'Attendance was updated by another administrator' using errcode = '40001'; end if;
  if v_session.state = 'locked' then raise exception 'Attendance session is already locked' using errcode = '23514'; end if;
  update public.student_attendance_sessions
  set state = 'locked', locked_at = now(), locked_by = auth.uid(), revision = revision + 1
  where id = v_session.id
  returning * into v_session;
  insert into public.student_attendance_revisions (attendance_session_id, action, actor_user_id)
  values (v_session.id, 'locked', auth.uid());
  return jsonb_build_object('session_id', v_session.id, 'state', v_session.state, 'revision', v_session.revision);
end;
$$;

create or replace function public.unlock_student_attendance_session(
  p_session_id uuid,
  p_expected_revision integer,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_session public.student_attendance_sessions%rowtype; v_reason text := nullif(btrim(p_reason), '');
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if v_reason is null then raise exception 'A reason is required to unlock attendance' using errcode = '23514'; end if;
  select * into v_session from public.student_attendance_sessions where id = p_session_id for update;
  if not found then raise exception 'Attendance session not found' using errcode = 'P0002'; end if;
  if v_session.revision <> p_expected_revision then raise exception 'Attendance was updated by another administrator' using errcode = '40001'; end if;
  if v_session.state <> 'locked' then raise exception 'Attendance session is not locked' using errcode = '23514'; end if;
  update public.student_attendance_sessions
  set state = 'open', locked_at = null, locked_by = null, revision = revision + 1
  where id = v_session.id
  returning * into v_session;
  insert into public.student_attendance_revisions (attendance_session_id, action, reason, actor_user_id)
  values (v_session.id, 'unlocked', v_reason, auth.uid());
  return jsonb_build_object('session_id', v_session.id, 'state', v_session.state, 'revision', v_session.revision);
end;
$$;

revoke all on function public.get_student_attendance_roster(uuid,uuid,uuid,date) from public, anon;
revoke all on function public.save_student_attendance(uuid,uuid,uuid,date,integer,jsonb,text) from public, anon;
revoke all on function public.lock_student_attendance_session(uuid,integer) from public, anon;
revoke all on function public.unlock_student_attendance_session(uuid,integer,text) from public, anon;
grant execute on function public.get_student_attendance_roster(uuid,uuid,uuid,date) to authenticated;
grant execute on function public.save_student_attendance(uuid,uuid,uuid,date,integer,jsonb,text) to authenticated;
grant execute on function public.lock_student_attendance_session(uuid,integer) to authenticated;
grant execute on function public.unlock_student_attendance_session(uuid,integer,text) to authenticated;
