begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(45);

insert into auth.users (id, aud, role) values
  ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated'),
  ('50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated');
insert into public.staff_users (user_id, role, active) values
  ('50000000-0000-4000-8000-000000000001', 'admin', true),
  ('50000000-0000-4000-8000-000000000002', 'staff', true);

-- Isolate the fixture from any developer-local current year. This remains
-- transaction-scoped and preserves the production one-current-year invariant.
update public.academic_years
set status = 'planning'
where status = 'current';

insert into public.academic_years (id, label, start_date, end_date, status) values
  ('50000000-0000-4000-8000-000000001001', 'Rollover Source', '2026-06-01', '2027-04-30', 'current'),
  ('50000000-0000-4000-8000-000000001002', 'Rollover Target', '2027-06-01', '2028-04-30', 'planning'),
  ('50000000-0000-4000-8000-000000001003', 'Rollover Wrong', '2027-06-01', '2028-04-30', 'planning'),
  ('50000000-0000-4000-8000-000000001004', 'Rollover Closed', '2025-06-01', '2026-04-30', 'closed');
insert into public.school_classes (id, name, display_order, active) values
  ('50000000-0000-4000-8000-000000002001', 'Rollover Source Class', 50, true),
  ('50000000-0000-4000-8000-000000002002', 'Rollover Next Class', 51, true),
  ('50000000-0000-4000-8000-000000002003', 'Rollover Inactive Class', 52, false);
insert into public.academic_sections (id, academic_year_id, class_id, name, active) values
  ('50000000-0000-4000-8000-000000003001', '50000000-0000-4000-8000-000000001001', '50000000-0000-4000-8000-000000002001', 'Source A', true),
  ('50000000-0000-4000-8000-000000003002', '50000000-0000-4000-8000-000000001001', '50000000-0000-4000-8000-000000002001', 'Source B', true),
  ('50000000-0000-4000-8000-000000003003', '50000000-0000-4000-8000-000000001002', '50000000-0000-4000-8000-000000002002', 'Target A', true),
  ('50000000-0000-4000-8000-000000003004', '50000000-0000-4000-8000-000000001002', '50000000-0000-4000-8000-000000002002', 'Target B', true),
  ('50000000-0000-4000-8000-000000003005', '50000000-0000-4000-8000-000000001002', '50000000-0000-4000-8000-000000002001', 'Repeat A', true),
  ('50000000-0000-4000-8000-000000003006', '50000000-0000-4000-8000-000000001002', '50000000-0000-4000-8000-000000002002', 'Target Inactive', false),
  ('50000000-0000-4000-8000-000000003007', '50000000-0000-4000-8000-000000001003', '50000000-0000-4000-8000-000000002002', 'Wrong Year', true),
  ('50000000-0000-4000-8000-000000003008', '50000000-0000-4000-8000-000000001002', '50000000-0000-4000-8000-000000002003', 'Inactive Class', true);

insert into public.students (id, admission_number, full_name, admission_date, status) values
  ('50000000-0000-4000-8000-000000004001', 'ROLLOVER-001', 'Rollover Promote One', '2026-06-01', 'active'),
  ('50000000-0000-4000-8000-000000004002', 'ROLLOVER-002', 'Rollover Repeat Two', '2026-06-01', 'active'),
  ('50000000-0000-4000-8000-000000004003', 'ROLLOVER-003', 'Rollover Graduate Three', '2026-06-01', 'active'),
  ('50000000-0000-4000-8000-000000004004', 'ROLLOVER-004', 'Rollover Promote Four', '2026-06-01', 'active'),
  ('50000000-0000-4000-8000-000000004005', 'ROLLOVER-HOLDER', 'Rollover Roll Holder', '2026-06-01', 'active');
insert into public.student_enrollments (id, student_id, academic_year_id, class_id, academic_section_id, roll_number, status, enrollment_date) values
  ('50000000-0000-4000-8000-000000005001', '50000000-0000-4000-8000-000000004001', '50000000-0000-4000-8000-000000001001', '50000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000003001', '1', 'active', '2026-06-01'),
  ('50000000-0000-4000-8000-000000005002', '50000000-0000-4000-8000-000000004002', '50000000-0000-4000-8000-000000001001', '50000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000003002', '2', 'active', '2026-06-01'),
  ('50000000-0000-4000-8000-000000005003', '50000000-0000-4000-8000-000000004003', '50000000-0000-4000-8000-000000001001', '50000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000003001', '3', 'active', '2026-06-01'),
  ('50000000-0000-4000-8000-000000005004', '50000000-0000-4000-8000-000000004004', '50000000-0000-4000-8000-000000001001', '50000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000003002', '4', 'active', '2026-06-01'),
  ('50000000-0000-4000-8000-000000005005', '50000000-0000-4000-8000-000000004005', '50000000-0000-4000-8000-000000001002', '50000000-0000-4000-8000-000000002002', '50000000-0000-4000-8000-000000003003', '90', 'active', '2027-06-01');

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.ok(
  not has_function_privilege('anon', 'public.preflight_academic_year_rollover(uuid,uuid,jsonb)', 'execute'),
  'anonymous cannot execute rollover preflight'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.preflight_academic_year_rollover(uuid,uuid,jsonb)', 'execute'),
  'authenticated role has preflight execute grant'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.execute_academic_year_rollover(uuid,uuid,jsonb,text)', 'execute'),
  'authenticated role has execution grant'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.academic_year_rollover_operations', 'INSERT'),
  'authenticated role cannot directly insert rollover operations'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.academic_year_rollover_items', 'UPDATE'),
  'authenticated role cannot directly update rollover items'
);
select extensions.ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'execute_academic_year_rollover'),
  'execution RPC is security definer'
);
select extensions.ok(
  (select proconfig @> array['search_path=pg_catalog, public, extensions'] from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'execute_academic_year_rollover'),
  'execution RPC has a fixed safe search path'
);

create temp table rollover_context(plan jsonb, fingerprint text) on commit drop;
insert into rollover_context(plan, fingerprint)
select plan, public.preflight_academic_year_rollover(
  '50000000-0000-4000-8000-000000001001',
  '50000000-0000-4000-8000-000000001002',
  plan
)->>'fingerprint'
from (
  select jsonb_build_array(
    jsonb_build_object('student_id','50000000-0000-4000-8000-000000004001','source_enrollment_id','50000000-0000-4000-8000-000000005001','outcome','promote','target_class_id','50000000-0000-4000-8000-000000002002','target_section_id','50000000-0000-4000-8000-000000003003','target_roll_number','11','reason','Promoted'),
    jsonb_build_object('student_id','50000000-0000-4000-8000-000000004002','source_enrollment_id','50000000-0000-4000-8000-000000005002','outcome','repeat','target_class_id','50000000-0000-4000-8000-000000002001','target_section_id','50000000-0000-4000-8000-000000003005','target_roll_number','21','reason','Repeat'),
    jsonb_build_object('student_id','50000000-0000-4000-8000-000000004003','source_enrollment_id','50000000-0000-4000-8000-000000005003','outcome','graduate','reason','Completed Class 10'),
    jsonb_build_object('student_id','50000000-0000-4000-8000-000000004004','source_enrollment_id','50000000-0000-4000-8000-000000005004','outcome','promote','target_class_id','50000000-0000-4000-8000-000000002002','target_section_id','50000000-0000-4000-8000-000000003004','target_roll_number','12','reason','Promoted')
  ) as plan
) plans;

select extensions.ok(
  ((public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context))->>'ready')::boolean),
  'valid whole-class plan passes read-only preflight'
);
select extensions.is((public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context))->>'promote_count')::integer, 2, 'preflight counts promotions');
select extensions.is((public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context))->>'repeat_count')::integer, 1, 'preflight counts repeats');
select extensions.is((public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context))->>'graduate_count')::integer, 1, 'preflight counts graduates');
select extensions.ok(
  not ((public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,outcome}','"exclude"')) ->>'ready')::boolean),
  'exclude outcome blocks unresolved source closure'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,outcome}','"exclude"')) -> 'errors') @> '[{"code":"unresolved_exclusions"}]'::jsonb,
  'exclude preflight reports a deterministic blocker'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,target_section_id}','"50000000-0000-4000-8000-000000003007"')) -> 'errors') @> '[{"code":"target_section_invalid"}]'::jsonb,
  'wrong target academic year is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,target_class_id}','"50000000-0000-4000-8000-000000002001"')) -> 'errors') @> '[{"code":"promotion_class_order_invalid"}]'::jsonb,
  'wrong target class relationship is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,target_section_id}','"50000000-0000-4000-8000-000000003006"')) -> 'errors') @> '[{"code":"target_section_invalid"}]'::jsonb,
  'inactive target section is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,target_class_id}','"50000000-0000-4000-8000-000000002003"')) -> 'errors') @> '[{"code":"target_class_inactive"}]'::jsonb,
  'inactive target class is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,target_class_id}', 'null')) -> 'errors') @> '[{"code":"target_placement_required"}]'::jsonb,
  'missing target mapping is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{1,target_class_id}','"50000000-0000-4000-8000-000000002002"')) -> 'errors') @> '[{"code":"repeat_class_mismatch"}]'::jsonb,
  'repeat class mismatch is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{2,target_section_id}','"50000000-0000-4000-8000-000000003003"')) -> 'errors') @> '[{"code":"target_placement_prohibited"}]'::jsonb,
  'graduate target placement is prohibited'
);
select extensions.ok(
  (public.preflight_academic_year_rollover(
    '50000000-0000-4000-8000-000000001001',
    '50000000-0000-4000-8000-000000001002',
    jsonb_set(
      jsonb_set((select plan from rollover_context),'{3,target_section_id}','"50000000-0000-4000-8000-000000003003"'),
      '{3,target_roll_number}',
      '" 11 "'
    )
  ) -> 'errors') @> '[{"code":"duplicate_target_rolls"}]'::jsonb,
  'duplicate normalized target rolls inside a batch are rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,target_roll_number}','"90"')) -> 'errors') @> '[{"code":"target_roll_conflict"}]'::jsonb,
  'existing normalized target roll conflict is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,student_id}','"50000000-0000-4000-8000-000000004005"')) -> 'errors') @> '[{"code":"source_enrollment_mismatch"}]'::jsonb,
  'student/source-enrollment mismatch is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,source_enrollment_id}','"50000000-0000-4000-8000-000000005002"')) -> 'errors') @> '[{"code":"source_enrollment_mismatch"}]'::jsonb,
  'already assigned source enrollment is rejected'
);
select extensions.ok(
  (public.preflight_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',jsonb_set((select plan from rollover_context),'{0,outcome}','"graduate"')) -> 'errors') @> '[{"code":"target_placement_prohibited"}]'::jsonb,
  'graduate placement combination is rejected'
);

select extensions.throws_ok(
  $$ select public.execute_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context),'00000000000000000000000000000000') $$,
  '40001', null, 'stale fingerprint is rejected before mutation'
);
select extensions.is((select count(*)::integer from public.academic_year_rollover_operations), 0, 'stale execution creates no operation');
select extensions.is((select count(*)::integer from public.student_enrollments where academic_year_id='50000000-0000-4000-8000-000000001001' and status='active'), 4, 'stale execution preserves source enrollments');

select extensions.lives_ok(
  $$ select public.execute_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context),(select fingerprint from rollover_context)) $$,
  'valid whole-class rollover executes atomically'
);
select extensions.is((select count(*)::integer from public.academic_year_rollover_operations where status='completed'), 1, 'one completed rollover operation is recorded');
select extensions.is((select count(*)::integer from public.academic_year_rollover_items), 4, 'all outcome items are recorded');
select extensions.is((select count(*)::integer from public.student_enrollments where academic_year_id='50000000-0000-4000-8000-000000001001' and status='active'), 0, 'source year has no unresolved active enrollments');
select extensions.is((select status::text from public.academic_years where id='50000000-0000-4000-8000-000000001001'), 'closed', 'source year closes after successful rollover');
select extensions.is((select status::text from public.academic_years where id='50000000-0000-4000-8000-000000001002'), 'current', 'target year activates after successful rollover');
select extensions.is((select count(*)::integer from public.academic_years where status='current'), 1, 'single-current-year invariant remains true');
select extensions.is((select count(*)::integer from public.student_enrollments where student_id in ('50000000-0000-4000-8000-000000004001','50000000-0000-4000-8000-000000004002','50000000-0000-4000-8000-000000004004') and status='active'), 3, 'promote and repeat create active target enrollments');
select extensions.is((select status::text from public.students where id='50000000-0000-4000-8000-000000004003'), 'graduated', 'graduate outcome changes student status');
select extensions.is((select count(*)::integer from public.student_enrollments where student_id='50000000-0000-4000-8000-000000004003'), 1, 'graduate preserves historical enrollment without target enrollment');
select extensions.is((select count(*)::integer from public.student_enrollments where student_id in ('50000000-0000-4000-8000-000000004001','50000000-0000-4000-8000-000000004002','50000000-0000-4000-8000-000000004004') and status='active'), 3, 'one-active-enrollment invariant holds after rollover');
select extensions.ok(
  (public.execute_academic_year_rollover('50000000-0000-4000-8000-000000001001','50000000-0000-4000-8000-000000001002',(select plan from rollover_context),(select fingerprint from rollover_context))->>'idempotent_replay')::boolean,
  'identical completed execution is idempotent'
);
select extensions.is((select count(*)::integer from public.academic_year_rollover_operations), 1, 'idempotent retry creates no second operation');
select extensions.is((select count(*)::integer from public.academic_year_rollover_items), 4, 'idempotent retry creates no duplicate items');
select extensions.throws_ok(
  $$ insert into public.academic_year_rollover_operations(source_academic_year_id,target_academic_year_id,requested_by,idempotency_key,plan_fingerprint) values ('50000000-0000-4000-8000-000000001004','50000000-0000-4000-8000-000000001003','50000000-0000-4000-8000-000000000001','direct','00000000000000000000000000000000') $$,
  '42501', null, 'authenticated clients cannot directly insert operations'
);
select extensions.throws_ok(
  $$ update public.academic_year_rollover_items set reason='tampered' $$,
  '42501', null, 'authenticated clients cannot directly update items'
);
select extensions.ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name in ('academic_year_rollover_operations','academic_year_rollover_items')
      and column_name in ('full_name','admission_number','guardian_name','phone','address')
  ),
  'rollover audit tables do not duplicate student PII'
);

select * from extensions.finish();
rollback;
