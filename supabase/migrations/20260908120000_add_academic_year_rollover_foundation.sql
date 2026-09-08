-- Phase 4B academic-year rollover database foundation.
--
-- The preflight RPC is read-only. The execution RPC is the only write path for
-- rollover operations and derives operator/idempotency data inside PostgreSQL.
-- The plan fingerprint is md5 over canonical JSONB assembled from authoritative
-- year, placement, student, enrollment, and normalized-plan state. JSONB object
-- keys are canonicalized by PostgreSQL and plan items are ordered by student and
-- source enrollment IDs; client key ordering, counts, timestamps, and hashes are
-- never trusted as authoritative state.

do $$ begin
  create type public.academic_rollover_operation_status as enum ('executing', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.academic_rollover_outcome as enum ('promote', 'repeat', 'graduate', 'exclude');
exception when duplicate_object then null;
end $$;

create table public.academic_year_rollover_operations (
  id uuid primary key default gen_random_uuid(),
  source_academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  target_academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status public.academic_rollover_operation_status not null default 'executing',
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 160),
  plan_fingerprint text not null check (char_length(plan_fingerprint) = 32),
  total_count integer not null default 0 check (total_count >= 0),
  promote_count integer not null default 0 check (promote_count >= 0),
  repeat_count integer not null default 0 check (repeat_count >= 0),
  graduate_count integer not null default 0 check (graduate_count >= 0),
  exclude_count integer not null default 0 check (exclude_count >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (source_academic_year_id <> target_academic_year_id),
  check (total_count = promote_count + repeat_count + graduate_count + exclude_count),
  check ((status = 'executing' and completed_at is null) or (status = 'completed' and completed_at is not null)),
  unique (source_academic_year_id, target_academic_year_id)
);

create index academic_year_rollover_operations_source_idx
  on public.academic_year_rollover_operations (source_academic_year_id, created_at desc);
create index academic_year_rollover_operations_target_idx
  on public.academic_year_rollover_operations (target_academic_year_id, created_at desc);

create table public.academic_year_rollover_items (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.academic_year_rollover_operations(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  source_enrollment_id uuid not null references public.student_enrollments(id) on delete restrict,
  outcome public.academic_rollover_outcome not null,
  target_class_id uuid references public.school_classes(id) on delete restrict,
  target_section_id uuid references public.academic_sections(id) on delete restrict,
  target_roll_number text check (target_roll_number is null or char_length(target_roll_number) between 1 and 30),
  reason text check (reason is null or char_length(reason) <= 500),
  result_enrollment_id uuid references public.student_enrollments(id) on delete restrict,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (operation_id, student_id),
  check (
    (outcome in ('promote', 'repeat') and target_class_id is not null and target_section_id is not null)
    or (outcome in ('graduate', 'exclude') and target_class_id is null and target_section_id is null and target_roll_number is null)
  ),
  check (outcome in ('promote', 'repeat') or result_enrollment_id is null),
  check (outcome in ('graduate', 'exclude') or result_enrollment_id is not null or executed_at is null),
  check (outcome = 'exclude' or executed_at is not null or result_enrollment_id is null)
);

create index academic_year_rollover_items_operation_idx
  on public.academic_year_rollover_items (operation_id, student_id);
create index academic_year_rollover_items_student_idx
  on public.academic_year_rollover_items (student_id, created_at desc);

alter table public.academic_year_rollover_operations enable row level security;
alter table public.academic_year_rollover_items enable row level security;

revoke all on public.academic_year_rollover_operations, public.academic_year_rollover_items from public, anon, authenticated;
grant select on public.academic_year_rollover_operations, public.academic_year_rollover_items to authenticated;

create policy "Active admins can read rollover operations"
  on public.academic_year_rollover_operations
  for select to authenticated
  using (public.is_active_admin());

create policy "Active admins can read rollover items"
  on public.academic_year_rollover_items
  for select to authenticated
  using (public.is_active_admin());

create or replace function public.prevent_completed_rollover_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Academic rollover audit records are immutable' using errcode = '42501';
  end if;
  if old.status = 'completed' then
    raise exception 'Completed academic rollover records are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger academic_year_rollover_operations_immutable
before update or delete on public.academic_year_rollover_operations
for each row execute function public.prevent_completed_rollover_mutation();

create or replace function public.prevent_completed_rollover_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare operation_status public.academic_rollover_operation_status;
begin
  select status into operation_status
  from public.academic_year_rollover_operations
  where id = coalesce(new.operation_id, old.operation_id);
  if tg_op = 'DELETE' or operation_status = 'completed' then
    raise exception 'Academic rollover items are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger academic_year_rollover_items_immutable
before update or delete on public.academic_year_rollover_items
for each row execute function public.prevent_completed_rollover_item_mutation();

create or replace function public.academic_year_rollover_build_plan(
  p_source_academic_year_id uuid,
  p_target_academic_year_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  source_year public.academic_years%rowtype;
  target_year public.academic_years%rowtype;
  raw_item jsonb;
  canonical_item jsonb;
  canonical_items jsonb := '[]'::jsonb;
  ordered_items jsonb;
  authoritative_items jsonb;
  errors jsonb := '[]'::jsonb;
  item_record record;
  source_enrollment public.student_enrollments%rowtype;
  source_student public.students%rowtype;
  target_class public.school_classes%rowtype;
  target_section public.academic_sections%rowtype;
  source_class public.school_classes%rowtype;
  source_active_count integer := 0;
  item_count integer := 0;
  promote_count integer := 0;
  repeat_count integer := 0;
  graduate_count integer := 0;
  exclude_count integer := 0;
  duplicate_count integer := 0;
  fingerprint text;
  item_student_id uuid;
  item_source_enrollment_id uuid;
  item_target_class_id uuid;
  item_target_section_id uuid;
  item_outcome text;
  item_roll_number text;
  item_reason text;
begin
  if p_source_academic_year_id is null or p_target_academic_year_id is null or p_source_academic_year_id = p_target_academic_year_id then
    raise exception 'Source and target academic years must be different' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 2000 then
    raise exception 'Academic rollover plan must contain between 1 and 2,000 items' using errcode = '22023';
  end if;

  select * into source_year from public.academic_years where id = p_source_academic_year_id;
  select * into target_year from public.academic_years where id = p_target_academic_year_id;
  if source_year.id is null then errors := errors || jsonb_build_array(jsonb_build_object('code', 'source_year_not_found')); end if;
  if target_year.id is null then errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_year_not_found')); end if;

  if source_year.id is not null and source_year.status <> 'current' then
    errors := errors || jsonb_build_array(jsonb_build_object('code', 'source_year_not_current'));
  end if;
  if target_year.id is not null and target_year.status <> 'planning' then
    errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_year_not_planning'));
  end if;
  if source_year.id is not null and target_year.id is not null and target_year.start_date <= source_year.start_date then
    errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_year_order_invalid'));
  end if;

  for raw_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(raw_item) <> 'object' then
      raise exception 'Every academic rollover item must be an object' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(raw_item) as keys(key_name)
      where key_name not in ('student_id', 'source_enrollment_id', 'outcome', 'target_class_id', 'target_section_id', 'target_roll_number', 'reason')
    ) then
      raise exception 'Academic rollover item contains an unsupported field' using errcode = '22023';
    end if;
    if not (raw_item ? 'student_id') or not (raw_item ? 'source_enrollment_id') or not (raw_item ? 'outcome') then
      raise exception 'Academic rollover item is missing a required field' using errcode = '22023';
    end if;
    if jsonb_typeof(raw_item->'student_id') <> 'string' or jsonb_typeof(raw_item->'source_enrollment_id') <> 'string' or jsonb_typeof(raw_item->'outcome') <> 'string' then
      raise exception 'Academic rollover item has an invalid required field type' using errcode = '22023';
    end if;
    if (raw_item ? 'target_class_id') and jsonb_typeof(raw_item->'target_class_id') not in ('string', 'null') then
      raise exception 'Academic rollover target class has an invalid type' using errcode = '22023';
    end if;
    if (raw_item ? 'target_section_id') and jsonb_typeof(raw_item->'target_section_id') not in ('string', 'null') then
      raise exception 'Academic rollover target section has an invalid type' using errcode = '22023';
    end if;
    if (raw_item ? 'target_roll_number') and jsonb_typeof(raw_item->'target_roll_number') not in ('string', 'null') then
      raise exception 'Academic rollover target roll has an invalid type' using errcode = '22023';
    end if;
    begin
      item_student_id := (raw_item->>'student_id')::uuid;
      item_source_enrollment_id := (raw_item->>'source_enrollment_id')::uuid;
      item_target_class_id := nullif(raw_item->>'target_class_id', '')::uuid;
      item_target_section_id := nullif(raw_item->>'target_section_id', '')::uuid;
    exception when others then
      raise exception 'Academic rollover item contains an invalid UUID' using errcode = '22023';
    end;
    item_outcome := lower(btrim(raw_item->>'outcome'));
    if item_outcome not in ('promote', 'repeat', 'graduate', 'exclude') then
      raise exception 'Academic rollover item contains an invalid outcome' using errcode = '22023';
    end if;
    item_roll_number := nullif(btrim(raw_item->>'target_roll_number'), '');
    item_reason := nullif(btrim(raw_item->>'reason'), '');
    canonical_item := jsonb_build_object(
      'student_id', item_student_id,
      'source_enrollment_id', item_source_enrollment_id,
      'outcome', item_outcome,
      'target_class_id', item_target_class_id,
      'target_section_id', item_target_section_id,
      'target_roll_number', item_roll_number,
      'reason', item_reason
    );
    canonical_items := canonical_items || jsonb_build_array(canonical_item);
  end loop;

  select coalesce(jsonb_agg(value order by value->>'student_id', value->>'source_enrollment_id'), '[]'::jsonb)
    into ordered_items
  from jsonb_array_elements(canonical_items);

  select count(*) into item_count from jsonb_array_elements(ordered_items);
  if source_year.id is not null then
    select count(*) into source_active_count
    from public.student_enrollments
    where academic_year_id = p_source_academic_year_id and status = 'active';
  end if;
  if item_count <> source_active_count then
    errors := errors || jsonb_build_array(jsonb_build_object('code', 'source_plan_incomplete'));
  end if;

  select count(*) into duplicate_count
  from (
    select value->>'student_id' from jsonb_array_elements(ordered_items) group by value->>'student_id' having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then errors := errors || jsonb_build_array(jsonb_build_object('code', 'duplicate_students')); end if;

  select count(*) into duplicate_count
  from (
    select value->>'source_enrollment_id' from jsonb_array_elements(ordered_items) group by value->>'source_enrollment_id' having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then errors := errors || jsonb_build_array(jsonb_build_object('code', 'duplicate_source_enrollments')); end if;

  for item_record in
    select * from jsonb_to_recordset(ordered_items) as items(
      student_id uuid,
      source_enrollment_id uuid,
      outcome text,
      target_class_id uuid,
      target_section_id uuid,
      target_roll_number text,
      reason text
    )
  loop
    select * into source_enrollment
    from public.student_enrollments e
    where e.id = item_record.source_enrollment_id and e.student_id = item_record.student_id;
    select * into source_student
    from public.students s
    where s.id = item_record.student_id;

    if source_enrollment.id is null then
      errors := errors || jsonb_build_array(jsonb_build_object('code', 'source_enrollment_mismatch', 'student_id', item_record.student_id));
      continue;
    end if;
    if source_enrollment.academic_year_id <> p_source_academic_year_id or source_enrollment.status <> 'active' or source_student.id is null or source_student.status <> 'active' then
      errors := errors || jsonb_build_array(jsonb_build_object('code', 'stale_source_enrollment', 'student_id', item_record.student_id));
    end if;
    if exists (select 1 from public.student_enrollments where student_id = item_record.student_id and academic_year_id = p_target_academic_year_id) then
      errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_year_history_exists', 'student_id', item_record.student_id));
    end if;

    if item_record.outcome in ('promote', 'repeat') then
      if item_record.target_class_id is null or item_record.target_section_id is null then
        errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_placement_required', 'student_id', item_record.student_id));
      else
        select * into target_class from public.school_classes where id = item_record.target_class_id;
        select * into target_section from public.academic_sections where id = item_record.target_section_id;
        select * into source_class from public.school_classes where id = source_enrollment.class_id;
        if target_class.id is null or not target_class.active then
          errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_class_inactive', 'student_id', item_record.student_id));
        end if;
        if target_section.id is null or not target_section.active or target_section.academic_year_id <> p_target_academic_year_id or target_section.class_id <> item_record.target_class_id then
          errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_section_invalid', 'student_id', item_record.student_id));
        end if;
        if item_record.outcome = 'repeat' and source_enrollment.class_id <> item_record.target_class_id then
          errors := errors || jsonb_build_array(jsonb_build_object('code', 'repeat_class_mismatch', 'student_id', item_record.student_id));
        end if;
        if item_record.outcome = 'promote' and (source_class.id is null or target_class.display_order <= source_class.display_order) then
          errors := errors || jsonb_build_array(jsonb_build_object('code', 'promotion_class_order_invalid', 'student_id', item_record.student_id));
        end if;
        if item_record.target_roll_number is not null and char_length(item_record.target_roll_number) > 30 then
          errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_roll_invalid', 'student_id', item_record.student_id));
        end if;
        if item_record.target_roll_number is not null and exists (
          select 1 from public.student_enrollments e
          where e.academic_section_id = item_record.target_section_id
            and e.roll_number is not null
            and lower(btrim(e.roll_number)) = lower(btrim(item_record.target_roll_number))
        ) then
          errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_roll_conflict', 'student_id', item_record.student_id));
        end if;
      end if;
    elsif item_record.target_class_id is not null or item_record.target_section_id is not null or item_record.target_roll_number is not null then
      errors := errors || jsonb_build_array(jsonb_build_object('code', 'target_placement_prohibited', 'student_id', item_record.student_id));
    end if;
  end loop;

  select count(*) into duplicate_count
  from (
    select target_section_id, lower(btrim(target_roll_number))
    from jsonb_to_recordset(ordered_items) as items(student_id uuid, source_enrollment_id uuid, outcome text, target_class_id uuid, target_section_id uuid, target_roll_number text, reason text)
    where outcome in ('promote', 'repeat') and target_roll_number is not null
    group by target_section_id, lower(btrim(target_roll_number))
    having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then errors := errors || jsonb_build_array(jsonb_build_object('code', 'duplicate_target_rolls')); end if;

  select count(*) into promote_count from jsonb_to_recordset(ordered_items) as items(outcome text) where outcome = 'promote';
  select count(*) into repeat_count from jsonb_to_recordset(ordered_items) as items(outcome text) where outcome = 'repeat';
  select count(*) into graduate_count from jsonb_to_recordset(ordered_items) as items(outcome text) where outcome = 'graduate';
  select count(*) into exclude_count from jsonb_to_recordset(ordered_items) as items(outcome text) where outcome = 'exclude';
  if exclude_count > 0 then errors := errors || jsonb_build_array(jsonb_build_object('code', 'unresolved_exclusions')); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', item.student_id,
    'source_enrollment_id', item.source_enrollment_id,
    'outcome', item.outcome,
    'target_class_id', item.target_class_id,
    'target_section_id', item.target_section_id,
    'target_roll_number', item.target_roll_number,
    'reason', item.reason,
    'source_enrollment_updated_at', e.updated_at,
    'student_status', s.status,
    'source_enrollment_status', e.status
  ) order by item.student_id, item.source_enrollment_id), '[]'::jsonb)
  into authoritative_items
  from jsonb_to_recordset(ordered_items) as item(student_id uuid, source_enrollment_id uuid, outcome text, target_class_id uuid, target_section_id uuid, target_roll_number text, reason text)
  left join public.student_enrollments e on e.id = item.source_enrollment_id
  left join public.students s on s.id = item.student_id;

  fingerprint := md5((jsonb_build_object(
    'source_year', jsonb_build_object('id', source_year.id, 'status', source_year.status, 'start_date', source_year.start_date, 'end_date', source_year.end_date),
    'target_year', jsonb_build_object('id', target_year.id, 'status', target_year.status, 'start_date', target_year.start_date, 'end_date', target_year.end_date),
    'items', authoritative_items
  ))::text);

  return jsonb_build_object(
    'ready', jsonb_array_length(errors) = 0,
    'fingerprint', fingerprint,
    'canonical_items', ordered_items,
    'items', authoritative_items,
    'total_count', item_count,
    'promote_count', promote_count,
    'repeat_count', repeat_count,
    'graduate_count', graduate_count,
    'exclude_count', exclude_count,
    'source_active_count', source_active_count,
    'errors', errors
  );
end;
$$;

create or replace function public.preflight_academic_year_rollover(
  p_source_academic_year_id uuid,
  p_target_academic_year_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return public.academic_year_rollover_build_plan(p_source_academic_year_id, p_target_academic_year_id, p_items);
end;
$$;

create or replace function public.execute_academic_year_rollover(
  p_source_academic_year_id uuid,
  p_target_academic_year_id uuid,
  p_items jsonb,
  p_plan_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  initial_plan jsonb;
  final_plan jsonb;
  existing_operation public.academic_year_rollover_operations%rowtype;
  v_operation_id uuid;
  item_record record;
  result_id uuid;
  idempotency_key text;
  source_year public.academic_years%rowtype;
  target_year public.academic_years%rowtype;
  operation_counts record;
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_plan_fingerprint is null or char_length(p_plan_fingerprint) <> 32 then
    raise exception 'A valid rollover plan fingerprint is required' using errcode = '22023';
  end if;

  -- Lock years first, in deterministic UUID order. Closing source before
  -- activating target avoids violating the one-current-year partial index.
  perform 1
  from public.academic_years
  where id in (p_source_academic_year_id, p_target_academic_year_id)
  order by id
  for update;

  select * into source_year from public.academic_years where id = p_source_academic_year_id;
  select * into target_year from public.academic_years where id = p_target_academic_year_id;
  if source_year.id is null or target_year.id is null then
    raise exception 'Academic rollover years were not found' using errcode = 'P0002';
  end if;

  initial_plan := public.academic_year_rollover_build_plan(p_source_academic_year_id, p_target_academic_year_id, p_items);
  idempotency_key := p_source_academic_year_id::text || ':' || p_target_academic_year_id::text || ':' || p_plan_fingerprint;

  select * into existing_operation
  from public.academic_year_rollover_operations
  where source_academic_year_id = p_source_academic_year_id
    and target_academic_year_id = p_target_academic_year_id
  for update;
  if existing_operation.id is not null then
    if existing_operation.plan_fingerprint = p_plan_fingerprint and existing_operation.status = 'completed' then
      return jsonb_build_object(
        'operation_id', existing_operation.id,
        'status', existing_operation.status,
        'source_academic_year_id', existing_operation.source_academic_year_id,
        'target_academic_year_id', existing_operation.target_academic_year_id,
        'plan_fingerprint', existing_operation.plan_fingerprint,
        'total_count', existing_operation.total_count,
        'promote_count', existing_operation.promote_count,
        'repeat_count', existing_operation.repeat_count,
        'graduate_count', existing_operation.graduate_count,
        'exclude_count', existing_operation.exclude_count,
        'idempotent_replay', true
      );
    end if;
    raise exception 'A different rollover operation already exists for this academic-year pair' using errcode = '23505';
  end if;

  -- Lock target entities, students, then source enrollments. This is the
  -- same student-before-enrollment ordering used by existing lifecycle RPCs.
  perform 1
  from public.school_classes c
  where c.id in (
    select distinct (value->>'target_class_id')::uuid
    from jsonb_array_elements(initial_plan->'canonical_items')
    where value->>'outcome' in ('promote', 'repeat')
  )
  order by c.id
  for update;

  perform 1
  from public.academic_sections s
  where s.id in (
    select distinct (value->>'target_section_id')::uuid
    from jsonb_array_elements(initial_plan->'canonical_items')
    where value->>'outcome' in ('promote', 'repeat')
  )
  order by s.id
  for update;

  perform 1
  from public.students s
  where s.id in (
    select distinct (value->>'student_id')::uuid
    from jsonb_array_elements(initial_plan->'canonical_items')
  )
  order by s.id
  for update;

  perform 1
  from public.student_enrollments e
  where e.id in (
    select distinct (value->>'source_enrollment_id')::uuid
    from jsonb_array_elements(initial_plan->'canonical_items')
  )
  order by e.student_id, e.id
  for update;

  final_plan := public.academic_year_rollover_build_plan(p_source_academic_year_id, p_target_academic_year_id, p_items);
  if final_plan->>'fingerprint' <> p_plan_fingerprint then
    raise exception 'Academic rollover preview is stale' using errcode = '40001';
  end if;
  if coalesce((final_plan->>'ready')::boolean, false) is not true then
    raise exception 'Academic rollover preflight failed' using errcode = '23514', detail = final_plan->'errors';
  end if;

  insert into public.academic_year_rollover_operations (
    source_academic_year_id, target_academic_year_id, requested_by, status,
    idempotency_key, plan_fingerprint, total_count, promote_count,
    repeat_count, graduate_count, exclude_count
  ) values (
    p_source_academic_year_id, p_target_academic_year_id, auth.uid(), 'executing',
    idempotency_key, p_plan_fingerprint, (final_plan->>'total_count')::integer,
    (final_plan->>'promote_count')::integer, (final_plan->>'repeat_count')::integer,
    (final_plan->>'graduate_count')::integer, (final_plan->>'exclude_count')::integer
  ) returning id into v_operation_id;

  insert into public.academic_year_rollover_items (
    operation_id, student_id, source_enrollment_id, outcome,
    target_class_id, target_section_id, target_roll_number, reason
  )
  select v_operation_id, item.student_id, item.source_enrollment_id, item.outcome::public.academic_rollover_outcome,
    item.target_class_id, item.target_section_id, item.target_roll_number, item.reason
  from jsonb_to_recordset(final_plan->'canonical_items') as item(
    student_id uuid, source_enrollment_id uuid, outcome text,
    target_class_id uuid, target_section_id uuid, target_roll_number text, reason text
  );

  for item_record in
    select * from public.academic_year_rollover_items
    where operation_id = v_operation_id
    order by student_id, id
    for update
  loop
    if item_record.outcome in ('promote', 'repeat') then
      update public.student_enrollments
      set status = 'completed', ended_on = target_year.start_date,
          status_reason = 'Academic rollover: ' || item_record.outcome,
          status_changed_at = now()
      where id = item_record.source_enrollment_id and status = 'active';
      if not found then
        raise exception 'Source enrollment changed during rollover' using errcode = '40001';
      end if;

      insert into public.student_enrollments (
        student_id, academic_year_id, class_id, academic_section_id,
        roll_number, status, enrollment_date, status_reason
      ) values (
        item_record.student_id, target_year.id, item_record.target_class_id,
        item_record.target_section_id, item_record.target_roll_number,
        'active', target_year.start_date, 'Academic rollover: ' || item_record.outcome
      ) returning id into result_id;

      update public.academic_year_rollover_items
      set result_enrollment_id = result_id, executed_at = now()
      where id = item_record.id;
    elsif item_record.outcome = 'graduate' then
      update public.student_enrollments
      set status = 'completed', ended_on = target_year.start_date,
          status_reason = 'Academic rollover: graduate',
          status_changed_at = now()
      where id = item_record.source_enrollment_id and status = 'active';
      if not found then
        raise exception 'Source enrollment changed during rollover' using errcode = '40001';
      end if;
      update public.students set status = 'graduated' where id = item_record.student_id and status = 'active';
      if not found then
        raise exception 'Student changed during rollover' using errcode = '40001';
      end if;
      update public.academic_year_rollover_items set executed_at = now() where id = item_record.id;
    end if;
  end loop;

  if exists (select 1 from public.student_enrollments where academic_year_id = source_year.id and status = 'active') then
    raise exception 'Source academic year still has unresolved active enrollments' using errcode = '23514';
  end if;

  update public.academic_years set status = 'closed' where id = source_year.id and status = 'current';
  if not found then raise exception 'Source academic year changed during rollover' using errcode = '40001'; end if;
  update public.academic_years set status = 'current' where id = target_year.id and status = 'planning';
  if not found then raise exception 'Target academic year changed during rollover' using errcode = '40001'; end if;

  select total_count, promote_count, repeat_count, graduate_count, exclude_count
    into operation_counts
  from public.academic_year_rollover_operations
  where id = v_operation_id;

  update public.academic_year_rollover_operations
  set status = 'completed', completed_at = now()
  where id = v_operation_id;

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'status', 'completed',
    'source_academic_year_id', source_year.id,
    'target_academic_year_id', target_year.id,
    'plan_fingerprint', p_plan_fingerprint,
    'total_count', operation_counts.total_count,
    'promote_count', operation_counts.promote_count,
    'repeat_count', operation_counts.repeat_count,
    'graduate_count', operation_counts.graduate_count,
    'exclude_count', operation_counts.exclude_count,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.academic_year_rollover_build_plan(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.preflight_academic_year_rollover(uuid, uuid, jsonb) from public, anon;
revoke all on function public.execute_academic_year_rollover(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.preflight_academic_year_rollover(uuid, uuid, jsonb) to authenticated;
grant execute on function public.execute_academic_year_rollover(uuid, uuid, jsonb, text) to authenticated;
