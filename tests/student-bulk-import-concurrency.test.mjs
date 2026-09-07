import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const configuredUrl = process.env.LOCAL_DATABASE_URL;

function isLocalDatabaseUrl(value) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

const url = isLocalDatabaseUrl(configuredUrl) ? configuredUrl : undefined;

async function asAdmin(sql, userId) {
  await sql`set role authenticated`;
  await sql.unsafe(`set request.jwt.claim.sub = '${userId}'`);
  await sql.unsafe(`set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'`);
}

async function createFixture() {
  const admin = postgres(url, { max: 2 });
  const token = randomUUID().replaceAll("-", "").slice(0, 12);
  const adminId = randomUUID();
  const yearId = randomUUID();
  const classId = randomUUID();
  const sectionId = randomUUID();
  const admissionPrefix = `BULK-RACE-${token}`;

  await admin.begin(async (sql) => {
    await sql`insert into auth.users (id,aud,role) values (${adminId},'authenticated','authenticated')`;
    await sql`insert into public.staff_users (user_id,role,active) values (${adminId},'admin',true)`;
    await sql`insert into public.academic_years (id,label,start_date,end_date,status) values (${yearId},${`Bulk race ${token}`},'2040-06-01','2041-04-30','planning')`;
    const availableOrder = await sql`
      select min(candidate)::int as display_order
      from generate_series(0,100) as candidate
      where not exists (
        select 1 from public.school_classes where display_order = candidate
      )
    `;
    assert.notEqual(availableOrder[0].display_order, null, "fixture requires an available class display order");
    await sql`insert into public.school_classes (id,name,display_order,active) values (${classId},${`Bulk race class ${token}`},${availableOrder[0].display_order},true)`;
    await sql`insert into public.academic_sections (id,academic_year_id,class_id,name,active) values (${sectionId},${yearId},${classId},${`Race ${token.slice(0, 6)}`},true)`;
  });

  return { admin, adminId, yearId, classId, sectionId, admissionPrefix };
}

async function callImport(data, rows) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, data.adminId);
    return await sql`
      select public.create_students_with_enrollments(
        ${sql.json(rows)},
        ${data.yearId},
        ${data.classId},
        ${data.sectionId}
      )
    `;
  } finally {
    await sql.end();
  }
}

async function cleanup(data) {
  const { admin, adminId, yearId, classId, sectionId, admissionPrefix } = data;
  const admissionPattern = `${admissionPrefix.toLowerCase()}%`;
  try {
    await admin`
      delete from public.student_enrollments
      where student_id in (
        select id
        from public.students
        where lower(btrim(admission_number)) like ${admissionPattern}
      )
    `;
    await admin`delete from public.students where lower(btrim(admission_number)) like ${admissionPattern}`;
    await admin`delete from public.academic_sections where id=${sectionId}`;
    await admin`delete from public.school_classes where id=${classId}`;
    await admin`delete from public.academic_years where id=${yearId}`;
    await admin`delete from public.staff_users where user_id=${adminId}`;
    await admin`delete from auth.users where id=${adminId}`;
  } finally {
    await admin.end();
  }
}

function assertOneUniqueViolation(results) {
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason?.code, "23505");
}

test("concurrent normalized admission conflict leaves one complete import", { skip: !url }, async () => {
  const data = await createFixture();
  const normalizedAdmission = `${data.admissionPrefix}-ADM`;
  try {
    const rows = (admissionNumber, name) => [{
      full_name: name,
      admission_number: admissionNumber,
      admission_date: "2040-06-01",
      enrollment_date: "2040-06-01",
    }];
    const results = await Promise.allSettled([
      callImport(data, rows(normalizedAdmission, "Admission Race Winner A")),
      callImport(data, rows(` ${normalizedAdmission.toLowerCase()} `, "Admission Race Winner B")),
    ]);
    assertOneUniqueViolation(results);

    const students = await data.admin`
      select id, admission_number
      from public.students
      where lower(btrim(admission_number)) = lower(${normalizedAdmission})
    `;
    assert.equal(students.length, 1);
    const enrollments = await data.admin`
      select e.id
      from public.student_enrollments e
      where e.student_id=${students[0].id}
    `;
    assert.equal(enrollments.length, 1);
    const partialStudents = await data.admin`
      select count(*)::int as count
      from public.students
      where lower(btrim(admission_number)) like ${`${data.admissionPrefix.toLowerCase()}%`}
    `;
    assert.equal(partialStudents[0].count, 1);
  } finally {
    await cleanup(data);
  }
});

test("concurrent same-section normalized roll conflict rolls back the loser", { skip: !url }, async () => {
  const data = await createFixture();
  const admissionOne = `${data.admissionPrefix}-ROLL-A`;
  const admissionTwo = `${data.admissionPrefix}-ROLL-B`;
  try {
    const rows = (admissionNumber, rollNumber, name) => [{
      full_name: name,
      admission_number: admissionNumber,
      admission_date: "2040-06-01",
      roll_number: rollNumber,
      enrollment_date: "2040-06-01",
    }];
    const results = await Promise.allSettled([
      callImport(data, rows(admissionOne, "7", "Roll Race Student A")),
      callImport(data, rows(admissionTwo, " 7 ", "Roll Race Student B")),
    ]);
    assertOneUniqueViolation(results);

    const students = await data.admin`
      select id, admission_number
      from public.students
      where admission_number in (${admissionOne}, ${admissionTwo})
      order by admission_number
    `;
    assert.equal(students.length, 1);
    const enrollments = await data.admin`
      select e.id, e.student_id, e.roll_number
      from public.student_enrollments e
      where e.academic_section_id=${data.sectionId}
        and lower(btrim(e.roll_number)) = '7'
    `;
    assert.equal(enrollments.length, 1);
    assert.equal(enrollments[0].student_id, students[0].id);
    const partialStudents = await data.admin`
      select count(*)::int as count
      from public.students
      where admission_number in (${admissionOne}, ${admissionTwo})
    `;
    assert.equal(partialStudents[0].count, 1);
  } finally {
    await cleanup(data);
  }
});
