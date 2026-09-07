-- Atomic student bulk-import database foundation.
-- This migration preserves existing values and aborts on normalized admission collisions.

do $$
declare
  violation_count bigint;
begin
  select count(*) into violation_count
  from public.students
  where nullif(btrim(admission_number), '') is null;
  if violation_count > 0 then
    raise exception 'Student bulk-import preflight failed'
      using errcode = '23514',
            detail = format('blank_normalized_admission_numbers=%s', violation_count);
  end if;

  select count(*) into violation_count
  from (
    select lower(btrim(admission_number))
    from public.students
    group by lower(btrim(admission_number))
    having count(*) > 1
  ) violations;
  if violation_count > 0 then
    raise exception 'Student bulk-import preflight failed'
      using errcode = '23505',
            detail = format('normalized_admission_duplicate_groups=%s', violation_count);
  end if;
end;
$$;

alter table public.students
  add constraint students_admission_number_normalized_nonblank_check
  check (nullif(btrim(admission_number), '') is not null);

create unique index students_admission_number_normalized_idx
  on public.students (lower(btrim(admission_number)));

create or replace function public.create_students_with_enrollments(
  p_rows jsonb,
  p_academic_year_id uuid,
  p_class_id uuid,
  p_academic_section_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_row jsonb;
  v_row_number integer;
  v_count integer;
  v_full_name text;
  v_admission_number text;
  v_date_of_birth date;
  v_gender text;
  v_admission_date date;
  v_roll_number text;
  v_enrollment_date date;
  v_year_status text;
  v_year_start date;
  v_year_end date;
  v_class_active boolean;
  v_section_active boolean;
  v_student_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Bulk student rows must be a JSON array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_rows);
  if v_count = 0 then
    raise exception 'Bulk student rows cannot be empty' using errcode = '22023';
  end if;
  if v_count > 2000 then
    raise exception 'Bulk student rows cannot exceed 2,000 records' using errcode = '22023';
  end if;

  select y.status::text, y.start_date, y.end_date, c.active, sec.active
    into v_year_status, v_year_start, v_year_end, v_class_active, v_section_active
  from public.academic_years y
  join public.school_classes c on c.id = p_class_id
  join public.academic_sections sec
    on sec.id = p_academic_section_id
   and sec.academic_year_id = y.id
   and sec.class_id = c.id
  where y.id = p_academic_year_id
  for update of y, c, sec;

  if not found
     or v_year_status not in ('planning', 'current')
     or not v_class_active
     or not v_section_active then
    raise exception 'Selected academic placement is not eligible' using errcode = '23514';
  end if;

  v_row_number := 0;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_number := v_row_number + 1;

    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'Bulk student row % must be an object', v_row_number using errcode = '23514';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_row) as key_names(key_name)
      where key_name not in ('full_name', 'admission_number', 'admission_date', 'date_of_birth', 'gender', 'roll_number', 'enrollment_date')
    ) then
      raise exception 'Bulk student row % contains an unsupported field', v_row_number using errcode = '23514';
    end if;

    if not (v_row ? 'full_name')
       or not (v_row ? 'admission_number')
       or not (v_row ? 'admission_date')
       or not (v_row ? 'enrollment_date') then
      raise exception 'Bulk student row % is missing a required field', v_row_number using errcode = '23514';
    end if;

    if jsonb_typeof(v_row->'full_name') <> 'string'
       or jsonb_typeof(v_row->'admission_number') <> 'string'
       or jsonb_typeof(v_row->'admission_date') <> 'string'
       or jsonb_typeof(v_row->'enrollment_date') <> 'string' then
      raise exception 'Bulk student row % has an invalid required field type', v_row_number using errcode = '23514';
    end if;

    if (v_row ? 'date_of_birth') and jsonb_typeof(v_row->'date_of_birth') not in ('string', 'null') then
      raise exception 'Bulk student row % has an invalid date_of_birth field type', v_row_number using errcode = '23514';
    end if;
    if (v_row ? 'gender') and jsonb_typeof(v_row->'gender') not in ('string', 'null') then
      raise exception 'Bulk student row % has an invalid gender field type', v_row_number using errcode = '23514';
    end if;
    if (v_row ? 'roll_number') and jsonb_typeof(v_row->'roll_number') not in ('string', 'null') then
      raise exception 'Bulk student row % has an invalid roll_number field type', v_row_number using errcode = '23514';
    end if;

    v_full_name := btrim(v_row->>'full_name');
    v_admission_number := btrim(v_row->>'admission_number');
    v_gender := nullif(btrim(v_row->>'gender'), '');
    v_roll_number := nullif(btrim(v_row->>'roll_number'), '');

    if char_length(v_full_name) not between 1 and 160 then
      raise exception 'Bulk student row % has an invalid full_name', v_row_number using errcode = '23514';
    end if;
    if char_length(v_admission_number) not between 1 and 50 then
      raise exception 'Bulk student row % has an invalid admission_number', v_row_number using errcode = '23514';
    end if;
    if v_gender is not null and v_gender not in ('male', 'female', 'other', 'not_specified') then
      raise exception 'Bulk student row % has an invalid gender', v_row_number using errcode = '23514';
    end if;
    if v_roll_number is not null and char_length(v_roll_number) not between 1 and 30 then
      raise exception 'Bulk student row % has an invalid roll_number', v_row_number using errcode = '23514';
    end if;

    begin
      v_admission_date := (v_row->>'admission_date')::date;
      v_enrollment_date := (v_row->>'enrollment_date')::date;
      v_date_of_birth := nullif(v_row->>'date_of_birth', '')::date;
    exception when others then
      raise exception 'Bulk student row % has an invalid date', v_row_number using errcode = '22007';
    end;

    if v_enrollment_date not between v_year_start and v_year_end then
      raise exception 'Bulk student row % enrollment date is outside the academic year', v_row_number using errcode = '23514';
    end if;
  end loop;

  if exists (
    select lower(btrim(item->>'admission_number'))
    from jsonb_array_elements(p_rows) as item
    group by lower(btrim(item->>'admission_number'))
    having count(*) > 1
  ) then
    raise exception 'Bulk student rows contain duplicate normalized admission numbers' using errcode = '23505';
  end if;

  if exists (
    select lower(btrim(item->>'roll_number'))
    from jsonb_array_elements(p_rows) as item
    where nullif(btrim(item->>'roll_number'), '') is not null
    group by lower(btrim(item->>'roll_number'))
    having count(*) > 1
  ) then
    raise exception 'Bulk student rows contain duplicate normalized roll numbers' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.students s
    where exists (
      select 1
      from jsonb_array_elements(p_rows) as item
      where lower(btrim(s.admission_number)) = lower(btrim(item->>'admission_number'))
    )
  ) then
    raise exception 'A normalized admission number already exists' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.student_enrollments e
    where e.academic_section_id = p_academic_section_id
      and e.roll_number is not null
      and exists (
        select 1
        from jsonb_array_elements(p_rows) as item
        where nullif(btrim(item->>'roll_number'), '') is not null
          and lower(btrim(e.roll_number)) = lower(btrim(item->>'roll_number'))
      )
  ) then
    raise exception 'A normalized roll number already exists in the selected section' using errcode = '23505';
  end if;

  v_row_number := 0;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_number := v_row_number + 1;
    v_full_name := btrim(v_row->>'full_name');
    v_admission_number := btrim(v_row->>'admission_number');
    v_gender := nullif(btrim(v_row->>'gender'), '');
    v_roll_number := nullif(btrim(v_row->>'roll_number'), '');
    v_admission_date := (v_row->>'admission_date')::date;
    v_enrollment_date := (v_row->>'enrollment_date')::date;
    v_date_of_birth := nullif(v_row->>'date_of_birth', '')::date;

    insert into public.students (admission_number, full_name, date_of_birth, gender, admission_date, status)
    values (v_admission_number, v_full_name, v_date_of_birth, v_gender, v_admission_date, 'active')
    returning id into v_student_id;

    insert into public.student_enrollments (
      student_id, academic_year_id, class_id, academic_section_id, roll_number, status, enrollment_date
    ) values (
      v_student_id, p_academic_year_id, p_class_id, p_academic_section_id, v_roll_number, 'active', v_enrollment_date
    );
  end loop;

  return jsonb_build_object('imported_count', v_count);
end;
$$;

revoke all on function public.create_students_with_enrollments(jsonb, uuid, uuid, uuid) from public, anon;
grant execute on function public.create_students_with_enrollments(jsonb, uuid, uuid, uuid) to authenticated;
