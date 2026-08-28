begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(70);

create or replace function pg_temp.explain_query(query_text text) returns text language plpgsql as $$
declare plan json;
begin execute 'explain (format json) '||query_text into plan; return plan::text; end;
$$;

insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-000000000001','authenticated','authenticated');
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-000000000002','authenticated','authenticated');
insert into public.staff_users (user_id, role, active) values ('00000000-0000-4000-8000-000000000001','admin',true);
insert into public.staff_users (user_id, role, active) values ('00000000-0000-4000-8000-000000000002','staff',true);
insert into public.academic_years (id,label,start_date,end_date,status) values
 ('00000000-0000-4000-8000-000000003001','2025-26','2025-06-01','2026-04-30','closed'),
 ('00000000-0000-4000-8000-000000003002','2026-27','2026-06-01','2027-04-30','current'),
 ('00000000-0000-4000-8000-000000003003','2027-28','2027-06-01','2028-04-30','planning');
insert into public.school_classes (id,name,display_order,active) values
 ('00000000-0000-4000-8000-000000004001','Test Class 1',90,true),
 ('00000000-0000-4000-8000-000000004002','Test Inactive Class',91,false),
 ('00000000-0000-4000-8000-000000004003','Test History Class',92,true);
insert into public.academic_sections (id,academic_year_id,class_id,name,active) values
 ('00000000-0000-4000-8000-000000005001','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','Test A',true),
 ('00000000-0000-4000-8000-000000005002','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','Test B',true),
 ('00000000-0000-4000-8000-000000005003','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','Test Off',false),
 ('00000000-0000-4000-8000-000000005004','00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004001','Test Old',true),
 ('00000000-0000-4000-8000-000000005005','00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004003','Test History',true);
insert into public.students (id,admission_number,full_name,admission_date,status) values
 ('00000000-0000-4000-8000-000000001001','TEST-001','Lifecycle Student','2026-06-01','active'),
 ('00000000-0000-4000-8000-000000001002','TEST-002','Second Student','2026-06-01','active'),
 ('00000000-0000-4000-8000-000000001003','TEST-003','Inactive Student','2026-06-01','inactive'),
 ('00000000-0000-4000-8000-000000001004','TEST-004','Completion Student','2026-06-01','active'),
 ('00000000-0000-4000-8000-000000001005','TEST-005','Graduation Student','2026-06-01','active'),
 ('00000000-0000-4000-8000-000000001006','TEST-006','Deactivation Student','2026-06-01','active'),
 ('00000000-0000-4000-8000-000000001007','TEST-HISTORY','Cross-Year Student','2025-06-01','active');
insert into public.student_enrollments (id,student_id,academic_year_id,class_id,academic_section_id,roll_number,status,enrollment_date) values
 ('00000000-0000-4000-8000-000000002001','00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','1','active','2026-06-01'),
 ('00000000-0000-4000-8000-000000002002','00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','2','active','2026-06-01'),
 ('00000000-0000-4000-8000-000000002003','00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','3','inactive','2026-06-01'),
 ('00000000-0000-4000-8000-000000002004','00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','4','active','2026-06-01'),
 ('00000000-0000-4000-8000-000000002005','00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','5','active','2026-06-01'),
 ('00000000-0000-4000-8000-000000002006','00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','6','active','2026-06-01'),
 ('00000000-0000-4000-8000-000000002007','00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004003','00000000-0000-4000-8000-000000005005','7','completed','2025-06-01'),
 ('00000000-0000-4000-8000-000000002008','00000000-0000-4000-8000-000000001007','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','8','active','2026-06-01');

insert into public.students (admission_number,full_name,admission_date,status)
select 'SCALE-'||n, 'Synthetic Student '||n, '2026-06-01', 'active' from generate_series(1,525) n;
insert into public.student_enrollments (student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date)
select id,'00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','active','2026-06-01' from public.students where admission_number like 'SCALE-%';
insert into public.student_enrollments (student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date)
select id,'00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005004','completed','2025-06-01' from public.students where admission_number like 'SCALE-%' order by admission_number limit 480;

analyze public.students;
analyze public.student_enrollments;

select extensions.throws_ok($$ update public.student_enrollments set class_id='00000000-0000-4000-8000-000000004002' where id='00000000-0000-4000-8000-000000002001' $$,'23514',null,'placement trigger protects history even for privileged writes');

select extensions.ok(not has_function_privilege('anon','public.promote_student(uuid,uuid,uuid,uuid,uuid,text,date)','execute'),'anon cannot promote');
select extensions.ok(has_function_privilege('authenticated','public.promote_student(uuid,uuid,uuid,uuid,uuid,text,date)','execute'),'authenticated role can invoke secured RPC');
with lifecycle_functions as (
  select p.oid
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array['create_student_with_enrollment','promote_student','transfer_student','complete_student_enrollment','deactivate_student','reactivate_student','correct_student_enrollment_roll','search_student_directory'])
)
select extensions.is((select count(*)::integer from lifecycle_functions where has_function_privilege('anon',oid,'execute')),0,'anonymous role has no lifecycle or directory RPC execute grants');
with lifecycle_functions as (
  select p.oid
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array['create_student_with_enrollment','promote_student','transfer_student','complete_student_enrollment','deactivate_student','reactivate_student','correct_student_enrollment_roll','search_student_directory'])
)
select extensions.is((select count(*)::integer from lifecycle_functions where has_function_privilege('authenticated',oid,'execute')),8,'authenticated role has exactly the intended lifecycle and directory RPC execute grants');
set local role anon;
select extensions.throws_ok($$ select public.promote_student('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000002001','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005002','10','2027-06-01') $$,'42501',null,'anonymous user cannot invoke promotion RPC');
select extensions.throws_ok($$ select count(*) from public.student_directory_current $$,'42501',null,'anonymous user cannot read the directory view');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.throws_ok($$ select public.promote_student('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000002001','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005002','10','2027-06-01') $$,'42501',null,'ordinary staff cannot promote');
select extensions.throws_ok($$ select public.search_student_directory(null,null,null,null,null,0,25) $$,'42501',null,'ordinary staff cannot search student directory');
select extensions.is((select count(*)::integer from public.students),0,'RLS hides student rows from ordinary staff');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.throws_ok($$ insert into public.student_enrollments (student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date) values ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005002','active','2027-06-01') $$,'42501',null,'direct enrollment insert is denied');
select extensions.throws_ok($$ update public.student_enrollments set status='inactive' where id='00000000-0000-4000-8000-000000002001' $$,'42501',null,'direct enrollment status update is denied');
select extensions.throws_ok($$ delete from public.student_enrollments where id='00000000-0000-4000-8000-000000002001' $$,'42501',null,'direct enrollment delete is denied');
select extensions.throws_ok($$ update public.school_classes set active=false where id='00000000-0000-4000-8000-000000004001' $$,'23514',null,'class with active enrollments cannot be deactivated');
select extensions.throws_ok($$ update public.academic_sections set active=false where id='00000000-0000-4000-8000-000000005001' $$,'23514',null,'section with active enrollments cannot be deactivated');
select extensions.throws_ok($$ update public.academic_years set status='closed' where id='00000000-0000-4000-8000-000000003002' $$,'23514',null,'year with active enrollments cannot be closed');
select extensions.throws_ok($$ update public.academic_years set start_date='2026-07-01' where id='00000000-0000-4000-8000-000000003002' $$,'23514',null,'year dates cannot exclude active enrollment dates');
select extensions.throws_ok($$ select public.transfer_student('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000002004','2025-01-01','Impossible date') $$,'23514',null,'effective date before enrollment is rejected');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002004'),'active','invalid effective date rolls back lifecycle change');

select extensions.lives_ok($$ select public.promote_student('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000002001','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005002','10','2027-06-01') $$,'promotion succeeds');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002001'),'completed','promotion completes source');
select extensions.is((select count(*)::integer from public.student_enrollments where student_id='00000000-0000-4000-8000-000000001001' and status='active'),1,'promotion creates one active target');
select extensions.throws_ok($$ select public.promote_student('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000002002','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005003','11','2027-06-01') $$,'23514',null,'inactive section is rejected');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002002'),'active','failed promotion rolls source back');
select extensions.throws_ok($$ update public.student_enrollments set class_id='00000000-0000-4000-8000-000000004002' where id='00000000-0000-4000-8000-000000002002' $$,'42501',null,'direct placement update is denied');
select extensions.lives_ok($$ select public.transfer_student('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000002002','2026-09-01','Transfer out') $$,'transfer succeeds');
select extensions.is((select status::text from public.students where id='00000000-0000-4000-8000-000000001002'),'transferred','transfer synchronizes student');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002002'),'transferred','transfer synchronizes enrollment');
select extensions.lives_ok($$ select public.reactivate_student('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000003003','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005002','3','2027-06-01','Return') $$,'inactive student receives a new enrollment');
select extensions.is((select status::text from public.students where id='00000000-0000-4000-8000-000000001003'),'active','reactivation synchronizes student');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002003'),'inactive','reactivation preserves inactive enrollment history');
select extensions.is((select count(*)::integer from public.student_enrollments where student_id='00000000-0000-4000-8000-000000001003' and status='active'),1,'reactivation inserts one active enrollment');
select extensions.throws_ok($$ select public.reactivate_student('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000003002','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001','2','2026-06-01','Invalid reuse') $$,'23514',null,'same-year re-entry is rejected rather than rewriting history');
select extensions.lives_ok($$ select public.complete_student_enrollment('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000002004','2027-04-30','Year complete',false) $$,'year completion succeeds');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002004'),'completed','completion closes enrollment');
select extensions.is((select status::text from public.students where id='00000000-0000-4000-8000-000000001004'),'active','year completion keeps student active');
select extensions.lives_ok($$ select public.complete_student_enrollment('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000002005','2027-04-30','Graduated',true) $$,'graduation succeeds');
select extensions.is((select status::text from public.students where id='00000000-0000-4000-8000-000000001005'),'graduated','graduation synchronizes student');
select extensions.lives_ok($$ select public.deactivate_student('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000002006','2026-10-01','Temporary leave') $$,'deactivation succeeds');
select extensions.is((select status::text from public.student_enrollments where id='00000000-0000-4000-8000-000000002006'),'inactive','deactivation synchronizes enrollment');
select extensions.is((select status::text from public.students where id='00000000-0000-4000-8000-000000001006'),'inactive','deactivation synchronizes student');
select extensions.throws_ok($$ select public.correct_student_enrollment_roll('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000002003','1','Conflict') $$,'23505',null,'normalized duplicate roll is rejected');
select extensions.throws_ok($$ update public.students set status='transferred' where id='00000000-0000-4000-8000-000000001003' $$,'42501',null,'ordinary status update is denied');
select extensions.is((select count(*)::integer from public.student_directory_current),532,'directory view remains exact beyond 500 students');
select extensions.is((select count(*)::integer from public.student_directory_current where class_id='00000000-0000-4000-8000-000000004001'),528,'directory class filter includes the sole active enrollment across current and planning years');
select extensions.ok((select count(*) from public.student_enrollments)>1000,'enrollment history fixture exceeds 1000 rows');
select extensions.is((select count(*)::integer from (select id from public.student_directory_current order by full_name,admission_number,id offset 500 limit 25) page),25,'directory page after row 500 is complete');
select extensions.is((public.search_student_directory('Synthetic Student 525',null,null,null,null,0,25)->>'filtered_count')::integer,1,'directory RPC search count is exact');
select extensions.is((public.search_student_directory('Synthetic',null,null,null,null,10000,25)->>'filtered_count')::integer,525,'out-of-range RPC page retains exact filtered count');
select extensions.is(jsonb_array_length(public.search_student_directory('Synthetic',null,null,null,null,10000,25)->'rows'),0,'out-of-range RPC page returns empty rows');
select extensions.is((public.search_student_directory(',',null,null,null,null,0,25)->>'filtered_count')::integer,0,'directory RPC safely treats PostgREST syntax characters as text');
select extensions.is((public.search_student_directory(null,null,null,'00000000-0000-4000-8000-000000004001',null,0,25)->>'filtered_count')::integer,528,'directory RPC class filter count is database-backed');
select extensions.is(
  (public.search_student_directory(null,null,null,null,'00000000-0000-4000-8000-000000005001',0,25)->>'filtered_count')::integer,
  (select count(*)::integer from public.student_directory_current where section_id='00000000-0000-4000-8000-000000005001'),
  'directory RPC section filter is database-backed'
);
select extensions.is(
  (public.search_student_directory(null,'active',null,null,null,0,25)->>'filtered_count')::integer,
  (select count(*)::integer from public.student_directory_current where student_status='active'),
  'directory RPC student-status filter is database-backed'
);
select extensions.is(
  (public.search_student_directory('synthetic','active',null,'00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001',0,25)->>'filtered_count')::integer,
  525,
  'directory RPC combines search, status, class, and section filters'
);
select extensions.is((public.search_student_directory(null,null,'00000000-0000-4000-8000-000000003001',null,null,0,25)->>'filtered_count')::integer,481,'academic-year-only filter returns exact historical enrollment count');
select extensions.is((public.search_student_directory('Cross-Year',null,'00000000-0000-4000-8000-000000003001',null,null,0,25)->>'filtered_count')::integer,1,'academic year and search evaluate enrollment history server-side');
select extensions.is((public.search_student_directory(null,'active','00000000-0000-4000-8000-000000003001',null,null,0,25)->>'filtered_count')::integer,481,'academic year and student status filter return exact count');
select extensions.is((public.search_student_directory(null,null,'00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004001',null,0,25)->>'filtered_count')::integer,480,'academic year and class filter use the selected enrollment');
select extensions.is((public.search_student_directory(null,null,'00000000-0000-4000-8000-000000003001',null,'00000000-0000-4000-8000-000000005004',0,25)->>'filtered_count')::integer,480,'academic year and section filter use the selected enrollment');
select extensions.is((public.search_student_directory(null,null,'00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005004',0,25)->>'filtered_count')::integer,480,'academic year with class and section returns exact count');
select extensions.is((public.search_student_directory('Synthetic','active','00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005004',0,25)->>'filtered_count')::integer,480,'academic year combines search, status, class, and section on one enrollment');
select extensions.is((public.search_student_directory('Cross-Year',null,'00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000005001',0,25)->>'filtered_count')::integer,0,'cross-year class and section cannot match a different enrollment');
select extensions.is((public.search_student_directory('Cross-Year',null,'00000000-0000-4000-8000-000000003001','00000000-0000-4000-8000-000000004003','00000000-0000-4000-8000-000000005005',0,25)->>'filtered_count')::integer,1,'cross-year history matches only its selected-year enrollment');
select extensions.is((public.search_student_directory(null,null,'00000000-0000-4000-8000-000000003001',null,null,10000,25)->>'filtered_count')::integer,481,'academic-year out-of-range page retains exact count');
select extensions.is(jsonb_array_length(public.search_student_directory(null,null,'00000000-0000-4000-8000-000000003001',null,null,10000,25)->'rows'),0,'academic-year out-of-range page returns empty rows');
select extensions.has_index('public','students','students_full_name_trgm_idx','full-name trigram index exists');
select extensions.has_index('public','students','students_admission_number_trgm_idx','admission-number trigram index exists');
select extensions.has_index('public','student_enrollments','student_enrollments_roll_number_trgm_idx','roll-number trigram index exists');
reset role;
set local enable_seqscan=off;
select extensions.matches(pg_temp.explain_query($q$select * from public.students where lower(full_name) like '%synthetic student 525%'$q$),'students_full_name_trgm_idx','directory search expression uses matching trigram index');

select * from extensions.finish();
rollback;
