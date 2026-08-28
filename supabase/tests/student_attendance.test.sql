begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(43);

insert into auth.users (id, aud, role) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated');
insert into public.staff_users (user_id, role, active) values
  ('10000000-0000-4000-8000-000000000001', 'admin', true),
  ('10000000-0000-4000-8000-000000000002', 'admin', true),
  ('10000000-0000-4000-8000-000000000003', 'staff', true);

insert into public.academic_years (id, label, start_date, end_date, status) values
  ('10000000-0000-4000-8000-000000003001', 'Attendance Test Year A', current_date - 30, current_date + 30, 'planning'),
  ('10000000-0000-4000-8000-000000003002', 'Attendance Test Year B', current_date - 30, current_date + 30, 'planning');
insert into public.school_classes (id, name, display_order, active) values
  ('10000000-0000-4000-8000-000000004001', 'Attendance Test Class', 70, true),
  ('10000000-0000-4000-8000-000000004002', 'Attendance Inactive Class', 71, false);
insert into public.academic_sections (id, academic_year_id, class_id, name, active) values
  ('10000000-0000-4000-8000-000000005001', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', 'Attendance A', true),
  ('10000000-0000-4000-8000-000000005002', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', 'Attendance B', true),
  ('10000000-0000-4000-8000-000000005003', '10000000-0000-4000-8000-000000003002', '10000000-0000-4000-8000-000000004001', 'Attendance C', true),
  ('10000000-0000-4000-8000-000000005004', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004002', 'Attendance Inactive', true);

insert into public.students (id, admission_number, full_name, admission_date, status) values
  ('10000000-0000-4000-8000-000000001001', 'ATT-001', 'Attendance One', current_date - 10, 'active'),
  ('10000000-0000-4000-8000-000000001002', 'ATT-002', 'Attendance Two', current_date - 10, 'active'),
  ('10000000-0000-4000-8000-000000001003', 'ATT-003', 'Attendance Starts Today', current_date, 'active'),
  ('10000000-0000-4000-8000-000000001004', 'ATT-004', 'Attendance Ended Today', current_date - 10, 'transferred'),
  ('10000000-0000-4000-8000-000000001005', 'ATT-005', 'Attendance Other Section', current_date - 10, 'active'),
  ('10000000-0000-4000-8000-000000001006', 'ATT-006', 'Attendance Other Year', current_date - 10, 'active'),
  ('10000000-0000-4000-8000-000000001007', 'ATT-007', 'Attendance Promoted Student', current_date - 10, 'active');
insert into public.student_enrollments (id, student_id, academic_year_id, class_id, academic_section_id, status, enrollment_date, ended_on) values
  ('10000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000001001', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005001', 'active', current_date - 10, null),
  ('10000000-0000-4000-8000-000000002002', '10000000-0000-4000-8000-000000001002', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005001', 'active', current_date - 10, null),
  ('10000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000001003', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005001', 'active', current_date, null),
  ('10000000-0000-4000-8000-000000002004', '10000000-0000-4000-8000-000000001004', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005001', 'transferred', current_date - 10, current_date),
  ('10000000-0000-4000-8000-000000002005', '10000000-0000-4000-8000-000000001005', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005002', 'active', current_date - 10, null),
  ('10000000-0000-4000-8000-000000002006', '10000000-0000-4000-8000-000000001006', '10000000-0000-4000-8000-000000003002', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005003', 'active', current_date - 10, null),
  ('10000000-0000-4000-8000-000000002007', '10000000-0000-4000-8000-000000001007', '10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005001', 'completed', current_date - 10, current_date - 5),
  ('10000000-0000-4000-8000-000000002008', '10000000-0000-4000-8000-000000001007', '10000000-0000-4000-8000-000000003002', '10000000-0000-4000-8000-000000004001', '10000000-0000-4000-8000-000000005003', 'active', current_date - 5, null);

select extensions.ok(not has_function_privilege('anon', 'public.get_student_attendance_roster(uuid,uuid,uuid,date)', 'execute'), 'anon cannot retrieve attendance roster');
select extensions.ok(not has_function_privilege('anon', 'public.save_student_attendance(uuid,uuid,uuid,date,integer,jsonb,text)', 'execute'), 'anon cannot save attendance');
select extensions.ok(has_function_privilege('authenticated', 'public.get_student_attendance_roster(uuid,uuid,uuid,date)', 'execute'), 'authenticated has the restricted roster RPC grant');
select extensions.ok(has_function_privilege('authenticated', 'public.save_student_attendance(uuid,uuid,uuid,date,integer,jsonb,text)', 'execute'), 'authenticated has the restricted save RPC grant');
select extensions.ok(has_function_privilege('authenticated', 'public.lock_student_attendance_session(uuid,integer)', 'execute'), 'authenticated has the restricted lock RPC grant');
select extensions.ok(has_function_privilege('authenticated', 'public.unlock_student_attendance_session(uuid,integer,text)', 'execute'), 'authenticated has the restricted unlock RPC grant');

set local role anon;
select extensions.throws_ok($$ select public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date) $$, '42501', null, 'anonymous caller cannot retrieve attendance');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.throws_ok($$ select public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date) $$, '42501', null, 'ordinary staff cannot retrieve attendance');
select extensions.throws_ok($$ select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,0,'[]'::jsonb) $$, '42501', null, 'ordinary staff cannot save attendance');
select extensions.is((select count(*)::integer from public.student_attendance_sessions), 0, 'RLS hides attendance sessions from ordinary staff');
select extensions.throws_ok($$ insert into public.student_attendance_sessions (attendance_date,academic_year_id,class_id,academic_section_id) values (current_date,'10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001') $$, '42501', null, 'ordinary staff cannot directly create attendance sessions');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is(jsonb_array_length(public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date)->'rows'), 3, 'admin roster includes exactly current eligible enrollments');
select extensions.ok(not (public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date - 1)->'rows' @> '[{"student_enrollment_id":"10000000-0000-4000-8000-000000002003"}]'::jsonb), 'enrollment start date is inclusive');
select extensions.ok(not (public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date)->'rows' @> '[{"student_enrollment_id":"10000000-0000-4000-8000-000000002004"}]'::jsonb), 'ended_on is exclusive from attendance eligibility');
select extensions.ok(public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date - 6)->'rows' @> '[{"student_enrollment_id":"10000000-0000-4000-8000-000000002007"}]'::jsonb, 'promotion source placement is eligible before its effective end date');
select extensions.ok(public.get_student_attendance_roster('10000000-0000-4000-8000-000000003002','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005003',current_date - 5)->'rows' @> '[{"student_enrollment_id":"10000000-0000-4000-8000-000000002008"}]'::jsonb, 'promotion target placement is eligible on its effective start date');
select extensions.throws_ok($$ insert into public.student_attendance_records (attendance_session_id,student_enrollment_id,status) values ('10000000-0000-4000-8000-000000009999','10000000-0000-4000-8000-000000002001','present') $$, '42501', null, 'admin has no direct attendance record DML grant');

select extensions.lives_ok($$
  select public.save_student_attendance(
    '10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,0,
    '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"absent","remark":"Medical"},{"enrollment_id":"10000000-0000-4000-8000-000000002003","status":"late"}]'::jsonb
  )
$$, 'active admin can save the complete authoritative roster');
select extensions.is((select count(*)::integer from public.student_attendance_sessions), 1, 'one attendance session is created');
select extensions.is((select count(*)::integer from public.student_attendance_records), 3, 'one attendance record is stored per eligible enrollment');
select extensions.is((select revision from public.student_attendance_sessions limit 1), 1, 'initial save increments session revision');
reset role;
select extensions.throws_ok($$ insert into public.student_attendance_records (attendance_session_id,student_enrollment_id,status) select id,'10000000-0000-4000-8000-000000002001','present' from public.student_attendance_sessions where attendance_date=current_date $$, '23505', null, 'database uniqueness prevents duplicate session enrollment records');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"}]'::jsonb)
$$, '23514', null, 'omitted eligible roster member is rejected');
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"absent"},{"enrollment_id":"10000000-0000-4000-8000-000000002003","status":"late"}]'::jsonb)
$$, '23514', null, 'duplicate submitted enrollment IDs are rejected');
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002005","status":"present"}]'::jsonb)
$$, '23514', null, 'cross-section enrollment injection is rejected');
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002006","status":"present"}]'::jsonb)
$$, '23514', null, 'cross-year enrollment injection is rejected');
select extensions.is((select count(*)::integer from public.student_attendance_records), 3, 'invalid full-roster submissions leave persisted records unchanged');
select extensions.throws_ok($$ select public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004002','10000000-0000-4000-8000-000000005004',current_date) $$, '23514', null, 'inactive academic configuration is rejected');
select extensions.throws_ok($$ select public.get_student_attendance_roster('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date + 1) $$, '23514', null, 'future attendance date is rejected');

select extensions.lives_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002003","status":"late"}]'::jsonb
  )
$$, 'same-day attendance correction succeeds without a reason');
select extensions.is((select count(*)::integer from public.student_attendance_revisions), 0, 'same-day correction does not create a mandatory revision');

select extensions.lives_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date - 2,0,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002004","status":"present"}]'::jsonb
  )
$$, 'historical attendance session can be created from the historical roster');
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date - 2,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"absent"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002004","status":"present"}]'::jsonb
  )
$$, '23514', null, 'previous-day correction requires a reason');
select extensions.lives_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date - 2,1,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"absent"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002004","status":"present"}]'::jsonb,
  'Verified correction')
$$, 'previous-day correction with a reason succeeds');
select extensions.is((select count(*)::integer from public.student_attendance_revisions where action='correction'), 1, 'historical correction creates one immutable revision');
select extensions.throws_ok($$ update public.student_attendance_revisions set reason='changed' $$, '42501', null, 'ordinary authenticated access cannot mutate attendance revisions');

select extensions.lives_ok($$ select public.lock_student_attendance_session((select id from public.student_attendance_sessions where attendance_date=current_date),2) $$, 'admin can lock an attendance session');
select extensions.is((select state::text from public.student_attendance_sessions where attendance_date=current_date), 'locked', 'lock changes the session state');
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,3,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002003","status":"late"}]'::jsonb)
$$, '23514', null, 'normal save is rejected while session is locked');
select extensions.throws_ok($$ select public.unlock_student_attendance_session((select id from public.student_attendance_sessions where attendance_date=current_date),3,'') $$, '23514', null, 'unlock requires a non-empty reason');
select extensions.lives_ok($$ select public.unlock_student_attendance_session((select id from public.student_attendance_sessions where attendance_date=current_date),3,'Correction window') $$, 'admin can unlock with a reason');
select extensions.is((select count(*)::integer from public.student_attendance_revisions where action in ('locked','unlocked')), 2, 'lock and unlock create immutable revisions');
select extensions.throws_ok($$
  select public.save_student_attendance('10000000-0000-4000-8000-000000003001','10000000-0000-4000-8000-000000004001','10000000-0000-4000-8000-000000005001',current_date,3,
  '[{"enrollment_id":"10000000-0000-4000-8000-000000002001","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002002","status":"present"},{"enrollment_id":"10000000-0000-4000-8000-000000002003","status":"late"}]'::jsonb)
$$, '40001', null, 'stale optimistic revision is rejected');

select * from extensions.finish();
rollback;
