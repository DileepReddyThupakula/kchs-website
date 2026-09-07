begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(49);

insert into auth.users (id, aud, role) values
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated'),
  ('90000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated');
insert into public.staff_users (user_id, role, active) values
  ('90000000-0000-4000-8000-000000000001', 'admin', true),
  ('90000000-0000-4000-8000-000000000002', 'staff', true),
  ('90000000-0000-4000-8000-000000000003', 'admin', false);

insert into public.academic_years (id, label, start_date, end_date, status) values
  ('90000000-0000-4000-8000-000000003001', 'Bulk Test Year', '2026-06-01', '2027-04-30', 'current');
insert into public.school_classes (id, name, display_order, active) values
  ('90000000-0000-4000-8000-000000004001', 'Bulk Test Class', 90, true),
  ('90000000-0000-4000-8000-000000004002', 'Bulk Inactive Class', 91, false);
insert into public.academic_sections (id, academic_year_id, class_id, name, active) values
  ('90000000-0000-4000-8000-000000005001', '90000000-0000-4000-8000-000000003001', '90000000-0000-4000-8000-000000004001', 'Bulk A', true),
  ('90000000-0000-4000-8000-000000005002', '90000000-0000-4000-8000-000000003001', '90000000-0000-4000-8000-000000004002', 'Bulk Inactive', true);

select extensions.ok(
  not has_function_privilege('anon', 'public.create_students_with_enrollments(jsonb,uuid,uuid,uuid)', 'execute'),
  'anonymous cannot execute the bulk RPC'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.create_students_with_enrollments(jsonb,uuid,uuid,uuid)', 'execute'),
  'authenticated role has the bulk RPC execute grant'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.students', 'INSERT'),
  'authenticated role cannot directly insert students'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.student_enrollments', 'INSERT'),
  'authenticated role cannot directly insert enrollments'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.student_enrollments', 'UPDATE'),
  'authenticated role cannot directly update enrollments'
);
select extensions.ok(
  (select prosecdef from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_students_with_enrollments'),
  'bulk RPC is security definer'
);
select extensions.ok(
  (select proconfig @> array['search_path=pg_catalog, public, extensions']
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_students_with_enrollments'),
  'bulk RPC has a fixed safe search path'
);
select extensions.has_index('public', 'students', 'students_admission_number_key', 'existing exact admission uniqueness remains');
select extensions.has_index('public', 'students', 'students_admission_number_normalized_idx', 'normalized admission uniqueness index exists');
select extensions.ok(
  (select indexdef ilike '%lower(btrim(admission_number))%'
   from pg_indexes where schemaname = 'public' and indexname = 'students_admission_number_normalized_idx'),
  'normalized admission index uses lower btrim'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'students_admission_number_normalized_nonblank_check'),
  'normalized admission numbers cannot be blank'
);

set local role anon;
select extensions.throws_ok($$ select public.create_students_with_enrollments('[]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '42501', null, 'anonymous call is rejected');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.throws_ok($$ select public.create_students_with_enrollments('[]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '42501', null, 'ordinary staff call is rejected');
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.throws_ok($$ select public.create_students_with_enrollments('[]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '42501', null, 'inactive admin call is rejected');

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.throws_ok($$ insert into public.students (admission_number,full_name,admission_date,status) values ('BULK3G-DIRECT','Direct DML','2026-06-01','active') $$, '42501', null, 'active admin still cannot directly insert students');
select extensions.throws_ok($$ insert into public.student_enrollments (student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date) values ('90000000-0000-4000-8000-000000006001','90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001','active',current_date) $$, '42501', null, 'active admin still cannot directly insert enrollments');

select extensions.is(
  (public.create_students_with_enrollments(
    '[{"full_name":"Bulk Student One","admission_number":"BULK3G-001","admission_date":"2026-06-01","date_of_birth":"2014-02-03","gender":"female","roll_number":"1","enrollment_date":"2026-06-01"}]'::jsonb,
    '90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001'
  )->>'imported_count')::integer,
  1,
  'active admin can create one student and enrollment'
);
select extensions.is((select count(*)::integer from public.students where admission_number like 'BULK3G-%'), 1, 'one-row batch creates exactly one student');
select extensions.is((select count(*)::integer from public.student_enrollments e join public.students s on s.id=e.student_id where s.admission_number like 'BULK3G-%'), 1, 'one-row batch creates exactly one enrollment');

select extensions.is(
  (public.create_students_with_enrollments(
    '[{"full_name":"Bulk Student Two","admission_number":"BULK3G-002","admission_date":"2026-06-02","gender":"male","roll_number":"2","enrollment_date":"2026-06-02"},{"full_name":"Bulk Student Three","admission_number":"BULK3G-003","admission_date":"2026-06-03","gender":"not_specified","roll_number":"3","enrollment_date":"2026-06-03"}]'::jsonb,
    '90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001'
  )->>'imported_count')::integer,
  2,
  'active admin can create a complete multi-row roster'
);
select extensions.is((select count(*)::integer from public.students where admission_number like 'BULK3G-%'), 3, 'multi-row batch creates all students');
select extensions.is((select count(*)::integer from public.student_enrollments e join public.students s on s.id=e.student_id where s.admission_number like 'BULK3G-%' and e.academic_year_id='90000000-0000-4000-8000-000000003001' and e.class_id='90000000-0000-4000-8000-000000004001' and e.academic_section_id='90000000-0000-4000-8000-000000005001'), 3, 'selected placement is applied to every enrollment');
select extensions.is((select string_agg(e.roll_number, ',' order by e.roll_number) from public.student_enrollments e join public.students s on s.id=e.student_id where s.admission_number like 'BULK3G-%'), '1,2,3', 'roll numbers are preserved');
select extensions.is((select count(*)::integer from jsonb_object_keys(public.create_students_with_enrollments('[{"full_name":"Bulk Student Four","admission_number":"BULK3G-004","admission_date":"2026-06-04","enrollment_date":"2026-06-04"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001'))), 1, 'success returns only imported_count');

select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Duplicate Exact","admission_number":"BULK3G-001","admission_date":"2026-06-05","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'exact admission duplicate is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Duplicate Case","admission_number":"bulk3g-001","admission_date":"2026-06-05","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'case-only admission duplicate is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Duplicate Whitespace","admission_number":" BULK3G-001 ","admission_date":"2026-06-05","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'whitespace-normalized admission duplicate is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Duplicate Batch One","admission_number":"BULK3G-005","admission_date":"2026-06-05","enrollment_date":"2026-06-05"},{"full_name":"Duplicate Batch Two","admission_number":" bulk3g-005 ","admission_date":"2026-06-05","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'duplicate normalized admissions inside a batch are rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Duplicate Roll One","admission_number":"BULK3G-006","admission_date":"2026-06-05","roll_number":"6","enrollment_date":"2026-06-05"},{"full_name":"Duplicate Roll Two","admission_number":"BULK3G-007","admission_date":"2026-06-05","roll_number":" 6 ","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'duplicate normalized rolls inside a batch are rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Existing Roll","admission_number":"BULK3G-008","admission_date":"2026-06-05","roll_number":" 1 ","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'existing normalized roll conflict is rejected');

select extensions.throws_ok($$ select public.create_students_with_enrollments(null,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '22023', null, 'null rows input is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('{}'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '22023', null, 'non-array rows input is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '22023', null, 'empty batch is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Missing Fields","admission_number":"BULK3G-009"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23514', null, 'malformed row is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Extra Field","admission_number":"BULK3G-010","admission_date":"2026-06-05","enrollment_date":"2026-06-05","secret":"not accepted"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23514', null, 'unsupported row fields are rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Invalid Gender","admission_number":"BULK3G-011","admission_date":"2026-06-05","gender":"invalid","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23514', null, 'invalid gender is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Impossible Date","admission_number":"BULK3G-012","admission_date":"2026-02-30","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '22007', null, 'impossible dates are rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Outside Year","admission_number":"BULK3G-014","admission_date":"2026-06-05","enrollment_date":"2027-05-01"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23514', null, 'enrollment date outside academic year is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Invalid Placement","admission_number":"BULK3G-015","admission_date":"2026-06-05","enrollment_date":"2026-06-05"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004002','90000000-0000-4000-8000-000000005002') $$, '23514', null, 'inactive placement is rejected');
select extensions.throws_ok($$ select public.create_students_with_enrollments((select jsonb_agg(jsonb_build_object('full_name','Oversized ' || n,'admission_number','BULK3G-OVER-' || n,'admission_date',current_date::text,'enrollment_date',current_date::text)) from generate_series(1,2001) n),'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '22023', null, 'oversized batch is rejected');

select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Atomic First","admission_number":"BULK3G-016","admission_date":"2026-06-06","enrollment_date":"2026-06-06"},{"full_name":"Atomic Later Invalid","admission_number":"BULK3G-017","admission_date":"2026-06-06","gender":"invalid","enrollment_date":"2026-06-06"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23514', null, 'later invalid row aborts the complete batch');
select extensions.is((select count(*)::integer from public.students where admission_number like 'BULK3G-%'), 4, 'invalid later row adds zero students');
select extensions.is((select count(*)::integer from public.student_enrollments e join public.students s on s.id=e.student_id where s.admission_number like 'BULK3G-%'), 4, 'invalid later row adds zero enrollments');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Atomic Admission First","admission_number":"BULK3G-018","admission_date":"2026-06-06","enrollment_date":"2026-06-06"},{"full_name":"Atomic Existing Admission","admission_number":" BULK3G-001 ","admission_date":"2026-06-06","enrollment_date":"2026-06-06"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'later existing admission conflict aborts the complete batch');
select extensions.is((select count(*)::integer from public.students where admission_number like 'BULK3G-%'), 4, 'existing admission conflict adds zero students');
select extensions.is((select count(*)::integer from public.student_enrollments e join public.students s on s.id=e.student_id where s.admission_number like 'BULK3G-%'), 4, 'existing admission conflict adds zero enrollments');
select extensions.throws_ok($$ select public.create_students_with_enrollments('[{"full_name":"Atomic Roll First","admission_number":"BULK3G-019","admission_date":"2026-06-06","roll_number":"19","enrollment_date":"2026-06-06"},{"full_name":"Atomic Existing Roll","admission_number":"BULK3G-020","admission_date":"2026-06-06","roll_number":" 1 ","enrollment_date":"2026-06-06"}]'::jsonb,'90000000-0000-4000-8000-000000003001','90000000-0000-4000-8000-000000004001','90000000-0000-4000-8000-000000005001') $$, '23505', null, 'later existing roll conflict aborts the complete batch');
select extensions.is((select count(*)::integer from public.students where admission_number like 'BULK3G-%'), 4, 'existing roll conflict adds zero students');
select extensions.is((select count(*)::integer from public.student_enrollments e join public.students s on s.id=e.student_id where s.admission_number like 'BULK3G-%'), 4, 'existing roll conflict adds zero enrollments');

select extensions.finish();
rollback;
