import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const url = process.env.LOCAL_DATABASE_URL;

async function asAdmin(sql, userId) {
  await sql`set role authenticated`;
  await sql.unsafe(`set request.jwt.claim.sub = '${userId}'`);
  await sql.unsafe(`set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'`);
}

async function fixture() {
  const admin = postgres(url, { max: 2 });
  const adminOne = randomUUID(), adminTwo = randomUUID(), year = randomUUID(), schoolClass = randomUUID(), section = randomUUID();
  const studentOne = randomUUID(), studentTwo = randomUUID(), enrollmentOne = randomUUID(), enrollmentTwo = randomUUID();
  const prefix = randomUUID().slice(0, 8), today = new Date().toISOString().slice(0, 10);
  await admin.begin(async (sql) => {
    await sql`insert into auth.users (id,aud,role) values (${adminOne},'authenticated','authenticated'),(${adminTwo},'authenticated','authenticated')`;
    await sql`insert into public.staff_users (user_id,role,active) values (${adminOne},'admin',true),(${adminTwo},'admin',true)`;
    await sql`insert into public.academic_years (id,label,start_date,end_date,status) values (${year},${`Attendance race ${prefix}`},current_date-10,current_date+10,'planning')`;
    await sql`insert into public.school_classes (id,name,display_order,active) values (${schoolClass},${`Attendance race class ${prefix}`},80,true)`;
    await sql`insert into public.academic_sections (id,academic_year_id,class_id,name,active) values (${section},${year},${schoolClass},'Race A',true)`;
    await sql`insert into public.students (id,admission_number,full_name,admission_date,status) values (${studentOne},${`ATT-RACE-${prefix}-1`},'Attendance Race One',current_date-10,'active'),(${studentTwo},${`ATT-RACE-${prefix}-2`},'Attendance Race Two',current_date-10,'active')`;
    await sql`insert into public.student_enrollments (id,student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date) values (${enrollmentOne},${studentOne},${year},${schoolClass},${section},'active',current_date-10),(${enrollmentTwo},${studentTwo},${year},${schoolClass},${section},'active',current_date-10)`;
  });
  const records = JSON.stringify([{ enrollment_id: enrollmentOne, status: "present" }, { enrollment_id: enrollmentTwo, status: "present" }]);
  return { admin, adminOne, adminTwo, year, schoolClass, section, studentOne, studentTwo, enrollmentOne, enrollmentTwo, records, today };
}

async function cleanup(data) {
  const { admin, studentOne, studentTwo, section, schoolClass, year, adminOne, adminTwo } = data;
  await admin`delete from public.student_attendance_revisions where attendance_session_id in (select id from public.student_attendance_sessions where academic_year_id=${year})`;
  await admin`delete from public.student_attendance_records where attendance_session_id in (select id from public.student_attendance_sessions where academic_year_id=${year})`;
  await admin`delete from public.student_attendance_sessions where academic_year_id=${year}`;
  await admin`delete from public.student_enrollments where student_id in (${studentOne},${studentTwo})`;
  await admin`delete from public.students where id in (${studentOne},${studentTwo})`;
  await admin`delete from public.academic_sections where id=${section}`;
  await admin`delete from public.school_classes where id=${schoolClass}`;
  await admin`delete from public.academic_years where id=${year}`;
  await admin`delete from public.staff_users where user_id in (${adminOne},${adminTwo})`;
  await admin`delete from auth.users where id in (${adminOne},${adminTwo})`;
  await admin.end();
}

async function save(data, userId, revision, records = data.records) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, userId);
    return await sql`select public.save_student_attendance(${data.year},${data.schoolClass},${data.section},${data.today},${revision},${sql.json(JSON.parse(records))})`;
  } finally { await sql.end(); }
}

test("concurrent first attendance save produces one session and no mixed records", { skip: !url }, async () => {
  const data = await fixture();
  try {
    const results = await Promise.allSettled([save(data, data.adminOne, 0), save(data, data.adminTwo, 0)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const sessions = await data.admin`select count(*)::int as count from public.student_attendance_sessions where academic_year_id=${data.year}`;
    const records = await data.admin`select count(*)::int as count from public.student_attendance_records r join public.student_attendance_sessions s on s.id=r.attendance_session_id where s.academic_year_id=${data.year}`;
    assert.equal(sessions[0].count, 1);
    assert.equal(records[0].count, 2);
  } finally { await cleanup(data); }
});

test("two admins saving the same revision leave one coherent winner", { skip: !url }, async () => {
  const data = await fixture();
  try {
    await save(data, data.adminOne, 0);
    const absent = JSON.stringify([{ enrollment_id: data.enrollmentOne, status: "absent" }, { enrollment_id: data.enrollmentTwo, status: "present" }]);
    const late = JSON.stringify([{ enrollment_id: data.enrollmentOne, status: "late" }, { enrollment_id: data.enrollmentTwo, status: "present" }]);
    const results = await Promise.allSettled([save(data, data.adminOne, 1, absent), save(data, data.adminTwo, 1, late)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const session = await data.admin`select revision from public.student_attendance_sessions where academic_year_id=${data.year}`;
    const status = await data.admin`select status::text as status from public.student_attendance_records where student_enrollment_id=${data.enrollmentOne}`;
    assert.equal(session[0].revision, 2);
    assert.ok(["absent", "late"].includes(status[0].status));
  } finally { await cleanup(data); }
});

test("lock and save race leaves one valid state", { skip: !url }, async () => {
  const data = await fixture();
  try {
    await save(data, data.adminOne, 0);
    const session = await data.admin`select id from public.student_attendance_sessions where academic_year_id=${data.year}`;
    const lock = async () => {
      const sql = postgres(url, { max: 1 });
      try { await asAdmin(sql, data.adminOne); return await sql`select public.lock_student_attendance_session(${session[0].id},1)`; } finally { await sql.end(); }
    };
    const changed = JSON.stringify([{ enrollment_id: data.enrollmentOne, status: "absent" }, { enrollment_id: data.enrollmentTwo, status: "present" }]);
    const results = await Promise.allSettled([lock(), save(data, data.adminTwo, 1, changed)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const finalSession = await data.admin`select state::text as state,revision from public.student_attendance_sessions where id=${session[0].id}`;
    const count = await data.admin`select count(*)::int as count from public.student_attendance_records where attendance_session_id=${session[0].id}`;
    assert.equal(finalSession[0].revision, 2);
    assert.equal(count[0].count, 2);
    assert.ok(["open", "locked"].includes(finalSession[0].state));
  } finally { await cleanup(data); }
});
