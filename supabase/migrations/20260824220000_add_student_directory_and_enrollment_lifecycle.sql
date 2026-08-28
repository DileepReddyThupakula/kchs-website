-- Student directory scalability and append-only enrollment lifecycle.
-- Additive migration: aborts on invariant violations and never repairs history.

create extension if not exists pg_trgm with schema extensions;

do $$
declare
  violation_count bigint;
begin
  select count(*) into violation_count from (
    select student_id, academic_year_id from public.student_enrollments group by student_id, academic_year_id having count(*) > 1
  ) violations;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('duplicate_student_year_groups=%s', violation_count); end if;

  select count(*) into violation_count from (
    select student_id from public.student_enrollments where status = 'active' group by student_id having count(*) > 1
  ) violations;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('multiple_active_enrollment_groups=%s', violation_count); end if;

  select count(*) into violation_count
  from public.student_enrollments e join public.students s on s.id = e.student_id
  where e.status = 'active' and s.status <> 'active';
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('active_enrollment_student_status_mismatches=%s', violation_count); end if;

  -- An active student may have one active enrollment, or a most-recent completed
  -- enrollment while awaiting the next academic placement. Other terminal history
  -- without an active placement is ambiguous and must be remediated explicitly.
  select count(*) into violation_count
  from public.students s
  where s.status = 'active'
    and not exists (select 1 from public.student_enrollments e where e.student_id = s.id and e.status = 'active')
    and (select e.status from public.student_enrollments e where e.student_id = s.id order by e.enrollment_date desc, e.created_at desc, e.id desc limit 1)
      is distinct from 'completed'::public.student_enrollment_status;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('active_students_without_active_or_completed_latest_enrollment=%s', violation_count); end if;

  select count(*) into violation_count
  from public.students s
  where s.status = 'inactive'
    and (select e.status from public.student_enrollments e where e.student_id = s.id order by e.enrollment_date desc, e.created_at desc, e.id desc limit 1)
      is distinct from 'inactive'::public.student_enrollment_status;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('inactive_student_latest_enrollment_mismatches=%s', violation_count); end if;

  select count(*) into violation_count
  from public.students s
  where s.status = 'transferred'
    and (select e.status from public.student_enrollments e where e.student_id = s.id order by e.enrollment_date desc, e.created_at desc, e.id desc limit 1)
      is distinct from 'transferred'::public.student_enrollment_status;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('transferred_student_latest_enrollment_mismatches=%s', violation_count); end if;

  select count(*) into violation_count
  from public.students s
  where s.status = 'graduated'
    and (select e.status from public.student_enrollments e where e.student_id = s.id order by e.enrollment_date desc, e.created_at desc, e.id desc limit 1)
      is distinct from 'completed'::public.student_enrollment_status;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('graduated_student_latest_enrollment_mismatches=%s', violation_count); end if;

  select count(*) into violation_count from (
    select academic_section_id, lower(btrim(roll_number))
    from public.student_enrollments where roll_number is not null
    group by academic_section_id, lower(btrim(roll_number)) having count(*) > 1
  ) violations;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('normalized_roll_duplicate_groups=%s', violation_count); end if;

  select count(*) into violation_count from public.student_enrollments where roll_number is not null and roll_number <> btrim(roll_number);
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('untrimmed_roll_numbers=%s', violation_count); end if;

  select count(*) into violation_count
  from public.student_enrollments e join public.academic_sections sec on sec.id=e.academic_section_id
  where sec.academic_year_id <> e.academic_year_id or sec.class_id <> e.class_id;
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('section_tuple_mismatches=%s', violation_count); end if;

  select count(*) into violation_count
  from public.student_enrollments e
  join public.academic_years y on y.id = e.academic_year_id
  join public.school_classes c on c.id = e.class_id
  join public.academic_sections sec on sec.id = e.academic_section_id
  where e.status = 'active' and (y.status = 'closed' or e.enrollment_date not between y.start_date and y.end_date or not c.active or not sec.active or sec.academic_year_id <> e.academic_year_id or sec.class_id <> e.class_id);
  if violation_count > 0 then raise exception 'Enrollment lifecycle preflight failed' using errcode = '23514', detail = format('active_enrollments_on_invalid_academic_entities=%s', violation_count); end if;
end;
$$;

alter table public.student_enrollments
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists ended_on date,
  add column if not exists status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  add constraint student_enrollments_end_date_check check (ended_on is null or ended_on >= enrollment_date),
  add constraint student_enrollments_roll_number_trimmed_check check (roll_number is null or roll_number = btrim(roll_number));

alter table public.academic_sections
  add constraint academic_sections_id_year_class_key unique (id, academic_year_id, class_id);

alter table public.student_enrollments
  add constraint student_enrollments_section_tuple_fkey
  foreign key (academic_section_id, academic_year_id, class_id)
  references public.academic_sections (id, academic_year_id, class_id)
  on delete restrict;

create unique index student_enrollments_one_active_per_student_idx
  on public.student_enrollments (student_id) where status = 'active';
create unique index student_enrollments_section_roll_normalized_idx
  on public.student_enrollments (academic_section_id, lower(btrim(roll_number))) where roll_number is not null;
create index student_enrollments_year_status_student_idx
  on public.student_enrollments (academic_year_id, status, student_id);
create index student_enrollments_year_class_section_status_student_idx
  on public.student_enrollments (academic_year_id, class_id, academic_section_id, status, student_id);
create index students_full_name_trgm_idx on public.students using gin (lower(full_name) extensions.gin_trgm_ops);
create index students_admission_number_trgm_idx on public.students using gin (lower(admission_number) extensions.gin_trgm_ops);
create index student_enrollments_roll_number_trgm_idx on public.student_enrollments using gin (lower(roll_number) extensions.gin_trgm_ops) where roll_number is not null;

alter policy "Active admins manage students" on public.students using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
alter policy "Active admins manage student enrollments" on public.student_enrollments using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
alter policy "Admins manage academic years" on public.academic_years using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
alter policy "Admins manage school classes" on public.school_classes using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
alter policy "Admins manage academic sections" on public.academic_sections using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

create or replace view public.student_directory_current
with (security_invoker = true)
as
select
  s.id,
  s.admission_number,
  s.full_name,
  lower(s.full_name) as search_full_name,
  lower(s.admission_number) as search_admission_number,
  s.gender,
  s.date_of_birth,
  s.status as student_status,
  e.academic_year_id,
  y.label as academic_year_label,
  e.id as enrollment_id,
  e.status as enrollment_status,
  e.class_id,
  c.name as class_name,
  e.academic_section_id as section_id,
  sec.name as section_name,
  e.roll_number,
  lower(e.roll_number) as search_roll_number
from public.students s
left join public.student_enrollments e on e.student_id = s.id and e.status = 'active'
left join public.academic_years y on y.id = e.academic_year_id
left join public.school_classes c on c.id = e.class_id
left join public.academic_sections sec on sec.id = e.academic_section_id;

revoke all on public.student_directory_current from public, anon;
grant select on public.student_directory_current to authenticated;

create or replace function public.search_student_directory(
  p_query text, p_status public.student_status, p_academic_year_id uuid, p_class_id uuid, p_section_id uuid,
  p_offset integer, p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare result jsonb; pattern text;
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  pattern := case when nullif(btrim(p_query),'') is null then null else '%'||replace(replace(replace(lower(btrim(p_query)),chr(92),' '),'%',' '),'_',' ')||'%' end;
  with filtered as materialized (
    select s.id,s.admission_number,s.full_name,s.gender,s.date_of_birth,s.status as student_status,
      e.academic_year_id,y.label as academic_year_label,e.id as enrollment_id,e.status as enrollment_status,
      e.class_id,c.name as class_name,e.academic_section_id as section_id,sec.name as section_name,e.roll_number,
      lower(s.full_name) as sort_name
    from public.students s
    left join public.student_enrollments e on e.student_id=s.id
      and ((p_academic_year_id is null and e.status='active') or e.academic_year_id=p_academic_year_id)
    left join public.academic_years y on y.id=e.academic_year_id
    left join public.school_classes c on c.id=e.class_id
    left join public.academic_sections sec on sec.id=e.academic_section_id
    where (pattern is null or lower(s.full_name) like pattern or lower(s.admission_number) like pattern or lower(e.roll_number) like pattern)
      and (p_status is null or s.status=p_status)
      and (p_academic_year_id is null or e.id is not null)
      and (p_class_id is null or e.class_id=p_class_id)
      and (p_section_id is null or e.academic_section_id=p_section_id)
  ), paged as (
    select * from filtered order by sort_name,admission_number,id offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(paged)-'sort_name' order by sort_name,admission_number,id) from paged),'[]'::jsonb),
    'filtered_count',(select count(*) from filtered)
  ) into result;
  return result;
end;
$$;

create or replace function public.assert_student_enrollment_placement_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if row(new.student_id, new.academic_year_id, new.class_id, new.academic_section_id, new.enrollment_date)
     is distinct from row(old.student_id, old.academic_year_id, old.class_id, old.academic_section_id, old.enrollment_date) then
    raise exception 'Enrollment placement history is immutable' using errcode = '23514';
  end if;
  if new.status in ('completed', 'transferred') and new.status is distinct from old.status then
    new.status_changed_at := now();
  elsif new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.assert_active_enrollment_entities()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.status = 'active' then
    perform 1 from public.academic_years y
    join public.school_classes c on c.id = new.class_id and c.active
    join public.academic_sections sec on sec.id = new.academic_section_id and sec.active
    where y.id = new.academic_year_id and y.status in ('planning', 'current')
      and sec.academic_year_id = new.academic_year_id and sec.class_id = new.class_id
      and new.enrollment_date between y.start_date and y.end_date
    for update of y,c,sec;
    if not found then raise exception 'Active enrollment requires eligible academic entities and date' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_active_enrollment_parent_invalidation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if tg_table_name = 'academic_years' then
    if new.status = 'closed' and old.status <> 'closed' and exists (select 1 from public.student_enrollments e where e.academic_year_id=new.id and e.status='active') then
      raise exception 'Cannot close academic year with active enrollments' using errcode='23514';
    end if;
    if exists (select 1 from public.student_enrollments e where e.academic_year_id=new.id and e.status='active' and e.enrollment_date not between new.start_date and new.end_date) then
      raise exception 'Academic year dates must contain active enrollment dates' using errcode='23514';
    end if;
  elsif tg_table_name = 'school_classes' then
    if not new.active and old.active and exists (select 1 from public.student_enrollments e where e.class_id=new.id and e.status='active') then
      raise exception 'Cannot deactivate class with active enrollments' using errcode='23514';
    end if;
  elsif tg_table_name = 'academic_sections' then
    if not new.active and old.active and exists (select 1 from public.student_enrollments e where e.academic_section_id=new.id and e.status='active') then
      raise exception 'Cannot deactivate section with active enrollments' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.assert_active_enrollment_student_status()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.status = 'active' and not exists (select 1 from public.students s where s.id = new.student_id and s.status = 'active') then
    raise exception 'Active enrollment requires active student' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.assert_student_terminal_status()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.status <> 'active' and exists (select 1 from public.student_enrollments e where e.student_id = new.id and e.status = 'active') then
    raise exception 'Non-active student cannot retain active enrollment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger student_enrollments_placement_immutable
before update on public.student_enrollments
for each row execute function public.assert_student_enrollment_placement_immutable();
create trigger student_enrollments_active_entities
before insert or update of status on public.student_enrollments
for each row execute function public.assert_active_enrollment_entities();
create trigger student_enrollments_active_student
before insert or update of status on public.student_enrollments
for each row execute function public.assert_active_enrollment_student_status();
create trigger students_terminal_status_check
before update of status on public.students
for each row execute function public.assert_student_terminal_status();
create trigger academic_years_active_enrollment_guard before update of status, start_date, end_date on public.academic_years for each row execute function public.prevent_active_enrollment_parent_invalidation();
create trigger school_classes_active_enrollment_guard before update of active on public.school_classes for each row execute function public.prevent_active_enrollment_parent_invalidation();
create trigger academic_sections_active_enrollment_guard before update of active on public.academic_sections for each row execute function public.prevent_active_enrollment_parent_invalidation();

alter function public.create_student_with_enrollment(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,date,public.student_status,uuid,uuid,uuid,text,date)
  security definer;
alter function public.create_student_with_enrollment(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,date,public.student_status,uuid,uuid,uuid,text,date)
  set search_path = pg_catalog, public, extensions;

create or replace function public.promote_student(
  p_student_id uuid, p_source_enrollment_id uuid, p_target_academic_year_id uuid,
  p_target_class_id uuid, p_target_section_id uuid, p_roll_number text, p_enrollment_date date
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
declare source_row public.student_enrollments%rowtype; new_id uuid;
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  perform 1 from public.students s where s.id = p_student_id and s.status = 'active' for update;
  if not found then raise exception 'Active student not found' using errcode = 'P0002'; end if;
  select * into source_row from public.student_enrollments e where e.id = p_source_enrollment_id and e.student_id = p_student_id for update;
  if not found or source_row.status not in ('active','completed') then raise exception 'Promotable source enrollment not found' using errcode = '23514'; end if;
  if source_row.academic_year_id = p_target_academic_year_id then raise exception 'Promotion requires a different academic year' using errcode = '23514'; end if;
  if not exists (select 1 from public.academic_years y where y.id = p_target_academic_year_id and y.status in ('planning','current'))
     or not exists (select 1 from public.school_classes c where c.id = p_target_class_id and c.active)
     or not exists (select 1 from public.academic_sections sec where sec.id = p_target_section_id and sec.academic_year_id = p_target_academic_year_id and sec.class_id = p_target_class_id and sec.active) then
    raise exception 'Target academic placement is not eligible' using errcode = '23514';
  end if;
  if source_row.status = 'active' then
    update public.student_enrollments set status = 'completed', ended_on = p_enrollment_date, status_reason = 'Promoted', status_changed_at = now() where id = source_row.id;
  end if;
  insert into public.student_enrollments (student_id, academic_year_id, class_id, academic_section_id, roll_number, status, enrollment_date)
  values (p_student_id, p_target_academic_year_id, p_target_class_id, p_target_section_id, nullif(btrim(p_roll_number),''), 'active', p_enrollment_date)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.transfer_student(p_student_id uuid, p_enrollment_id uuid, p_effective_date date, p_reason text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  perform 1 from public.students s where s.id = p_student_id and s.status = 'active' for update;
  if not found then raise exception 'Active student not found' using errcode = 'P0002'; end if;
  update public.student_enrollments set status='transferred', ended_on=p_effective_date, status_reason=nullif(btrim(p_reason),''), status_changed_at=now()
  where id=p_enrollment_id and student_id=p_student_id and status='active';
  if not found then raise exception 'Active enrollment not found' using errcode = 'P0002'; end if;
  update public.students set status='transferred' where id=p_student_id;
  return p_enrollment_id;
end;
$$;

create or replace function public.complete_student_enrollment(p_student_id uuid, p_enrollment_id uuid, p_effective_date date, p_reason text, p_graduate boolean default false)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  perform 1 from public.students s where s.id=p_student_id and s.status='active' for update;
  if not found then raise exception 'Active student not found' using errcode='P0002'; end if;
  update public.student_enrollments set status='completed', ended_on=p_effective_date, status_reason=nullif(btrim(p_reason),''), status_changed_at=now()
  where id=p_enrollment_id and student_id=p_student_id and status='active';
  if not found then raise exception 'Active enrollment not found' using errcode='P0002'; end if;
  if p_graduate then update public.students set status='graduated' where id=p_student_id; end if;
  return p_enrollment_id;
end;
$$;

create or replace function public.deactivate_student(p_student_id uuid, p_enrollment_id uuid, p_effective_date date, p_reason text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  perform 1 from public.students s where s.id=p_student_id and s.status='active' for update;
  if not found then raise exception 'Active student not found' using errcode='P0002'; end if;
  update public.student_enrollments set status='inactive', ended_on=p_effective_date, status_reason=nullif(btrim(p_reason),''), status_changed_at=now()
  where id=p_enrollment_id and student_id=p_student_id and status='active';
  if not found then raise exception 'Active enrollment not found' using errcode='P0002'; end if;
  update public.students set status='inactive' where id=p_student_id;
  return p_enrollment_id;
end;
$$;

create or replace function public.reactivate_student(
  p_student_id uuid, p_target_academic_year_id uuid, p_target_class_id uuid,
  p_target_section_id uuid, p_roll_number text, p_enrollment_date date, p_reason text
) returns uuid language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
declare result_id uuid;
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  perform 1 from public.students s where s.id=p_student_id and s.status in ('inactive','transferred') for update;
  if not found then raise exception 'Inactive or transferred student not found' using errcode='P0002'; end if;
  if exists (select 1 from public.student_enrollments e where e.student_id=p_student_id and e.status='active') then raise exception 'Student already has active enrollment' using errcode='23505'; end if;
  if not exists (select 1 from public.academic_years y where y.id=p_target_academic_year_id and y.status in ('planning','current'))
     or not exists (select 1 from public.school_classes c where c.id=p_target_class_id and c.active)
     or not exists (select 1 from public.academic_sections sec where sec.id=p_target_section_id and sec.academic_year_id=p_target_academic_year_id and sec.class_id=p_target_class_id and sec.active) then
    raise exception 'Target academic placement is not eligible' using errcode='23514';
  end if;
  if exists (select 1 from public.student_enrollments e where e.student_id = p_student_id and e.academic_year_id = p_target_academic_year_id) then
    raise exception 'Reactivation cannot reuse an academic year with existing enrollment history' using errcode='23514';
  end if;
  update public.students set status='active' where id=p_student_id;
  insert into public.student_enrollments (student_id,academic_year_id,class_id,academic_section_id,roll_number,status,enrollment_date,status_reason)
  values (p_student_id,p_target_academic_year_id,p_target_class_id,p_target_section_id,nullif(btrim(p_roll_number),''),'active',p_enrollment_date,nullif(btrim(p_reason),'')) returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.correct_student_enrollment_roll(p_student_id uuid, p_enrollment_id uuid, p_roll_number text, p_reason text)
returns uuid language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
begin
  if not public.is_active_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Correction reason is required' using errcode='23514'; end if;
  update public.student_enrollments set roll_number=nullif(btrim(p_roll_number),''), status_reason=btrim(p_reason), status_changed_at=now()
  where id=p_enrollment_id and student_id=p_student_id;
  if not found then raise exception 'Enrollment not found' using errcode='P0002'; end if;
  return p_enrollment_id;
end;
$$;

revoke insert, update, delete on public.student_enrollments from authenticated;
revoke insert on public.students from authenticated;
revoke update on public.students from authenticated;
grant update (admission_number,full_name,photo_path,date_of_birth,gender,father_guardian_name,mother_name,primary_phone,secondary_phone,email,address_line_1,address_line_2,locality,city,state,postal_code,admission_date,profile_photo_path,preferred_name,blood_group,student_category,aadhaar_number,nationality,mother_tongue,previous_school_name,previous_class,previous_school_tc_number,previous_school_location,admission_remarks,father_name,father_mobile,father_email,father_occupation,mother_mobile,mother_email,mother_occupation,guardian_name,guardian_relationship,guardian_mobile,guardian_email,primary_contact,emergency_contact_name,emergency_contact_relationship,emergency_contact_mobile,door_number,street,area_locality,village_town_city,mandal,district,identification_mark_1,identification_mark_2,transport_required,general_notes) on public.students to authenticated;

revoke all on function public.create_student_with_enrollment(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,date,public.student_status,uuid,uuid,uuid,text,date) from public, anon;
revoke all on function public.promote_student(uuid,uuid,uuid,uuid,uuid,text,date) from public, anon;
revoke all on function public.transfer_student(uuid,uuid,date,text) from public, anon;
revoke all on function public.complete_student_enrollment(uuid,uuid,date,text,boolean) from public, anon;
revoke all on function public.deactivate_student(uuid,uuid,date,text) from public, anon;
revoke all on function public.reactivate_student(uuid,uuid,uuid,uuid,text,date,text) from public, anon;
revoke all on function public.correct_student_enrollment_roll(uuid,uuid,text,text) from public, anon;
revoke all on function public.search_student_directory(text,public.student_status,uuid,uuid,uuid,integer,integer) from public, anon;
grant execute on function public.create_student_with_enrollment(text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,date,public.student_status,uuid,uuid,uuid,text,date) to authenticated;
grant execute on function public.promote_student(uuid,uuid,uuid,uuid,uuid,text,date) to authenticated;
grant execute on function public.transfer_student(uuid,uuid,date,text) to authenticated;
grant execute on function public.complete_student_enrollment(uuid,uuid,date,text,boolean) to authenticated;
grant execute on function public.deactivate_student(uuid,uuid,date,text) to authenticated;
grant execute on function public.reactivate_student(uuid,uuid,uuid,uuid,text,date,text) to authenticated;
grant execute on function public.correct_student_enrollment_roll(uuid,uuid,text,text) to authenticated;
grant execute on function public.search_student_directory(text,public.student_status,uuid,uuid,uuid,integer,integer) to authenticated;
