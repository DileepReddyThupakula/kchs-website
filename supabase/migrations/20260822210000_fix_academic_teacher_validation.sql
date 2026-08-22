create or replace function public.assert_active_section_class_teacher() returns trigger language plpgsql security invoker set search_path=public as $$ begin
  if new.class_teacher_id is not null and not exists (select 1 from public.staff_members where id = new.class_teacher_id and staff_type = 'teacher' and employment_status = 'active') then
    raise exception 'Class teacher assignment requires an active teaching staff member' using errcode = '23514';
  end if;
  return new;
end; $$;
create or replace function public.assert_active_assignment_teacher() returns trigger language plpgsql security invoker set search_path=public as $$ begin
  if new.teacher_id is not null and not exists (select 1 from public.staff_members where id = new.teacher_id and staff_type = 'teacher' and employment_status = 'active') then
    raise exception 'Subject teacher assignment requires an active teaching staff member' using errcode = '23514';
  end if;
  return new;
end; $$;
drop trigger if exists academic_sections_teacher_check on public.academic_sections;
drop trigger if exists assignments_teacher_check on public.section_subject_assignments;
create trigger academic_sections_teacher_check before insert or update on public.academic_sections for each row execute function public.assert_active_section_class_teacher();
create trigger assignments_teacher_check before insert or update on public.section_subject_assignments for each row execute function public.assert_active_assignment_teacher();
