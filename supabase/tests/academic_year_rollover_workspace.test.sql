begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(24);

insert into auth.users (id, aud, role) values
  ('60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated'),
  ('60000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated');
insert into public.staff_users (user_id, role, active) values
  ('60000000-0000-4000-8000-000000000001', 'admin', true),
  ('60000000-0000-4000-8000-000000000002', 'staff', true),
  ('60000000-0000-4000-8000-000000000003', 'admin', false);

update public.academic_years set status = 'planning' where status = 'current';

insert into public.academic_years (id, label, start_date, end_date, status) values
  ('60000000-0000-4000-8000-000000001001', 'Workspace Source', '2026-06-01', '2027-04-30', 'current'),
  ('60000000-0000-4000-8000-000000001002', 'Workspace Target', '2027-06-01', '2028-04-30', 'planning'),
  ('60000000-0000-4000-8000-000000001003', 'Workspace Future', '2028-06-01', '2029-04-30', 'planning'),
  ('60000000-0000-4000-8000-000000001004', 'Workspace Old', '2025-06-01', '2026-04-30', 'planning'),
  ('60000000-0000-4000-8000-000000001005', 'Workspace Closed', '2029-06-01', '2030-04-30', 'closed');
insert into public.school_classes (id, name, display_order, active) values
  ('60000000-0000-4000-8000-000000002001', 'Workspace Class A', 60, true),
  ('60000000-0000-4000-8000-000000002002', 'Workspace Class B', 61, true),
  ('60000000-0000-4000-8000-000000002003', 'Workspace Inactive', 62, false);
insert into public.academic_sections (id, academic_year_id, class_id, name, active) values
  ('60000000-0000-4000-8000-000000003001', '60000000-0000-4000-8000-000000001001', '60000000-0000-4000-8000-000000002001', 'Source A', true),
  ('60000000-0000-4000-8000-000000003002', '60000000-0000-4000-8000-000000001002', '60000000-0000-4000-8000-000000002002', 'Target A', true),
  ('60000000-0000-4000-8000-000000003003', '60000000-0000-4000-8000-000000001003', '60000000-0000-4000-8000-000000002001', 'Future A', true),
  ('60000000-0000-4000-8000-000000003004', '60000000-0000-4000-8000-000000001004', '60000000-0000-4000-8000-000000002001', 'Old A', true),
  ('60000000-0000-4000-8000-000000003005', '60000000-0000-4000-8000-000000001002', '60000000-0000-4000-8000-000000002002', 'Target Off', false);
insert into public.students (id, admission_number, full_name, admission_date, status) values
  ('60000000-0000-4000-8000-000000004001', 'WORKSPACE-001', 'Workspace Student One', '2026-06-01', 'active'),
  ('60000000-0000-4000-8000-000000004002', 'WORKSPACE-002', 'Workspace Student Two', '2026-06-01', 'inactive');
insert into public.student_enrollments (id, student_id, academic_year_id, class_id, academic_section_id, roll_number, status, enrollment_date) values
  ('60000000-0000-4000-8000-000000005001', '60000000-0000-4000-8000-000000004001', '60000000-0000-4000-8000-000000001001', '60000000-0000-4000-8000-000000002001', '60000000-0000-4000-8000-000000003001', '1', 'active', '2026-06-01'),
  ('60000000-0000-4000-8000-000000005002', '60000000-0000-4000-8000-000000004002', '60000000-0000-4000-8000-000000001001', '60000000-0000-4000-8000-000000002001', '60000000-0000-4000-8000-000000003001', '2', 'inactive', '2026-06-01');

select extensions.ok(not has_function_privilege('anon', 'public.get_academic_year_rollover_workspace()', 'execute'), 'anonymous cannot execute workspace RPC');
select extensions.ok(has_function_privilege('authenticated', 'public.get_academic_year_rollover_workspace()', 'execute'), 'authenticated can execute workspace RPC');
select extensions.ok(not (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_academic_year_rollover_workspace'), 'workspace RPC is security invoker');
select extensions.ok((select provolatile = 's' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_academic_year_rollover_workspace'), 'workspace RPC is stable and read-only');

set local role anon;
select extensions.throws_ok($$ select public.get_academic_year_rollover_workspace() $$, '42501', null, 'anonymous workspace call is rejected');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.throws_ok($$ select public.get_academic_year_rollover_workspace() $$, '42501', null, 'non-admin workspace call is rejected');
set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.throws_ok($$ select public.get_academic_year_rollover_workspace() $$, '42501', null, 'inactive admin workspace call is rejected');

set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';
create temp table workspace_result(payload jsonb) on commit drop;
insert into workspace_result select public.get_academic_year_rollover_workspace();

select extensions.is((select payload->'source_year'->>'id' from workspace_result), '60000000-0000-4000-8000-000000001001', 'current source year is returned');
select extensions.is((
  select count(*)::integer
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'target_years') as target_row(item)
  where target_row.item->>'id' in ('60000000-0000-4000-8000-000000001002', '60000000-0000-4000-8000-000000001003')
), 2, 'fixture future planning target years are returned');
select extensions.is((
  select string_agg(target_row.item->>'id', ',' order by target_row.position)
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'target_years') with ordinality as target_row(item, position)
  where target_row.item->>'id' in ('60000000-0000-4000-8000-000000001002', '60000000-0000-4000-8000-000000001003')
), '60000000-0000-4000-8000-000000001002,60000000-0000-4000-8000-000000001003', 'fixture target years are ordered by start date');
select extensions.ok(not exists (
  select 1
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'target_years') as target_row(item)
  where target_row.item->>'id' in ('60000000-0000-4000-8000-000000001004', '60000000-0000-4000-8000-000000001005')
), 'ineligible fixture target years are excluded');
select extensions.is((
  select count(*)::integer
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'classes') as class_row(item)
  where class_row.item->>'id' in ('60000000-0000-4000-8000-000000002001', '60000000-0000-4000-8000-000000002002')
), 2, 'fixture active classes are returned');
select extensions.is((
  select string_agg(class_row.item->>'id', ',' order by class_row.position)
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'classes') with ordinality as class_row(item, position)
  where class_row.item->>'id' in ('60000000-0000-4000-8000-000000002001', '60000000-0000-4000-8000-000000002002')
), '60000000-0000-4000-8000-000000002001,60000000-0000-4000-8000-000000002002', 'fixture classes are ordered by display order');
select extensions.ok(not exists (
  select 1
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'classes') as class_row(item)
  where class_row.item->>'id' = '60000000-0000-4000-8000-000000002003'
), 'inactive fixture class is excluded');
select extensions.is((
  select count(*)::integer
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'sections') as section_row(item)
  where section_row.item->>'id' in ('60000000-0000-4000-8000-000000003001', '60000000-0000-4000-8000-000000003002', '60000000-0000-4000-8000-000000003003')
), 3, 'fixture active sections for source and eligible target years are returned');
select extensions.is((
  select string_agg(section_row.item->>'id', ',' order by section_row.position)
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'sections') with ordinality as section_row(item, position)
  where section_row.item->>'id' in ('60000000-0000-4000-8000-000000003001', '60000000-0000-4000-8000-000000003002', '60000000-0000-4000-8000-000000003003')
), '60000000-0000-4000-8000-000000003003,60000000-0000-4000-8000-000000003001,60000000-0000-4000-8000-000000003002', 'fixture sections are deterministically ordered by name and id');
select extensions.ok(not exists (
  select 1
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'sections') as section_row(item)
  where section_row.item->>'id' in ('60000000-0000-4000-8000-000000003004', '60000000-0000-4000-8000-000000003005')
), 'ineligible or inactive fixture sections are excluded');
select extensions.is((
  select count(*)::integer
  from workspace_result wr
  cross join lateral jsonb_array_elements(wr.payload->'source_enrollments') as enrollment_row(item)
  where enrollment_row.item->>'id' = '60000000-0000-4000-8000-000000005001'
), 1, 'the active fixture source enrollment is returned');
select extensions.is((select payload->'source_enrollments'->0->'student'->>'admission_number' from workspace_result), 'WORKSPACE-001', 'minimal student display fields are joined');
select extensions.is((
  select count(*)::integer
  from workspace_result wr
  cross join lateral jsonb_object_keys(wr.payload->'source_enrollments'->0->'student') as student_key(key_name)
), 4, 'student payload contains only four display fields');
select extensions.ok(not ((select payload->'source_enrollments'->0->'student' from workspace_result) ? 'email'), 'student payload excludes PII fields');
select extensions.is((select (payload->'source_year'->>'status') from workspace_result), 'current', 'source year status is preserved');

reset role;
update public.student_enrollments set status = 'inactive' where id = '60000000-0000-4000-8000-000000005001';
set local role authenticated;
set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is((select jsonb_array_length(public.get_academic_year_rollover_workspace()->'source_enrollments')), 0, 'empty active enrollment set returns an empty array');
reset role;
update public.student_enrollments set status = 'active' where id = '60000000-0000-4000-8000-000000005001';
set local role authenticated;
set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is((select count(*)::integer from public.academic_years where id = '60000000-0000-4000-8000-000000001001' and status = 'current'), 1, 'workspace read does not mutate academic years');

select * from extensions.finish();
rollback;
