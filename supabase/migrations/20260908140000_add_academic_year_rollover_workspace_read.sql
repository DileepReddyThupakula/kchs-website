-- Phase 4B read-only rollover workspace boundary.
--
-- This function deliberately runs as the caller so the existing admin RLS
-- policies remain authoritative. It only assembles the data already required
-- by the admin workspace; preflight and execution remain separate RPCs.

create or replace function public.get_academic_year_rollover_workspace()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  source_year public.academic_years%rowtype;
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into source_year
  from public.academic_years
  where status = 'current'
  order by start_date, id
  limit 1;

  if source_year.id is null then
    return jsonb_build_object(
      'source_year', null,
      'target_years', '[]'::jsonb,
      'classes', '[]'::jsonb,
      'sections', '[]'::jsonb,
      'source_enrollments', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'source_year', jsonb_build_object(
      'id', source_year.id,
      'label', source_year.label,
      'start_date', source_year.start_date,
      'end_date', source_year.end_date,
      'status', source_year.status::text
    ),
    'target_years', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', year.id,
        'label', year.label,
        'start_date', year.start_date,
        'end_date', year.end_date,
        'status', year.status::text
      ) order by year.start_date, year.id)
      from public.academic_years year
      where year.status = 'planning'
        and year.start_date > source_year.start_date
    ), '[]'::jsonb),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', school_class.id,
        'name', school_class.name,
        'display_order', school_class.display_order,
        'active', school_class.active
      ) order by school_class.display_order, school_class.name, school_class.id)
      from public.school_classes school_class
      where school_class.active = true
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', section.id,
        'name', section.name,
        'academic_year_id', section.academic_year_id,
        'class_id', section.class_id,
        'active', section.active
      ) order by section.name, section.id)
      from public.academic_sections section
      where section.active = true
        and (
          section.academic_year_id = source_year.id
          or section.academic_year_id in (
            select year.id
            from public.academic_years year
            where year.status = 'planning'
              and year.start_date > source_year.start_date
          )
        )
    ), '[]'::jsonb),
    'source_enrollments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', enrollment.id,
        'student_id', enrollment.student_id,
        'class_id', enrollment.class_id,
        'academic_section_id', enrollment.academic_section_id,
        'roll_number', enrollment.roll_number,
        'enrollment_date', enrollment.enrollment_date,
        'student', case when student.id is null then null else jsonb_build_object(
          'id', student.id,
          'admission_number', student.admission_number,
          'full_name', student.full_name,
          'status', student.status::text
        ) end
      ) order by enrollment.student_id, enrollment.id)
      from public.student_enrollments enrollment
      left join public.students student on student.id = enrollment.student_id
      where enrollment.academic_year_id = source_year.id
        and enrollment.status = 'active'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_academic_year_rollover_workspace() from public, anon, authenticated;
grant execute on function public.get_academic_year_rollover_workspace() to authenticated;
