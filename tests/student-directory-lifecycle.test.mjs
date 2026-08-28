import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { directoryPageHref, directoryRange, parseStudentDirectoryParams } from "../lib/student-directory.ts";

test("directory parameters are validated and clamped", () => {
  assert.deepEqual(parseStudentDirectoryParams({ page: "3", pageSize: "25", q: "  deepu  ", status: "active", year: "11111111-1111-4111-8111-111111111111", class: "bad", section: undefined }), {
    page: 3, pageSize: 25, q: "deepu", status: "active", yearId: "11111111-1111-4111-8111-111111111111", classId: undefined, sectionId: undefined,
  });
  assert.equal(parseStudentDirectoryParams({ page: "-4", pageSize: "999", q: "x".repeat(150) }).page, 1);
  assert.equal(parseStudentDirectoryParams({ page: "-4", pageSize: "999", q: "x".repeat(150) }).pageSize, 25);
  assert.equal(parseStudentDirectoryParams({ page: "-4", pageSize: "999", q: "x".repeat(150) }).q.length, 100);
});

test("directory ranges do not depend on aggregate caps", () => {
  assert.deepEqual(directoryRange(1, 25), { from: 0, to: 24 });
  assert.deepEqual(directoryRange(3, 25), { from: 50, to: 74 });
  assert.deepEqual(directoryRange(21, 25), { from: 500, to: 524 });
});

test("pagination links preserve filters and replace page", () => {
  assert.equal(directoryPageHref({ page: 2, pageSize: 50, q: "Reddy", status: "active", yearId: "22222222-2222-4222-8222-222222222222", classId: "11111111-1111-4111-8111-111111111111", sectionId: undefined }), "/staff/students?page=2&pageSize=50&q=Reddy&status=active&year=22222222-2222-4222-8222-222222222222&class=11111111-1111-4111-8111-111111111111");
});

test("migration hardens lifecycle writes and search", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260824220000_add_student_directory_and_enrollment_lifecycle.sql", import.meta.url), "utf8").toLowerCase();
  for (const required of [
    "security definer",
    "set search_path = pg_catalog, public, extensions",
    "revoke insert, update, delete on public.student_enrollments from authenticated",
    "where status = 'active'",
    "student_directory_current",
    "search_student_directory",
    "p_academic_year_id",
    "security_invoker = true",
    "pg_trgm",
    "promote_student",
    "transfer_student",
    "complete_student_enrollment",
    "deactivate_student",
    "reactivate_student",
    "active_students_without_active_or_completed_latest_enrollment",
    "inactive_student_latest_enrollment_mismatches",
    "transferred_student_latest_enrollment_mismatches",
    "graduated_student_latest_enrollment_mismatches",
  ]) assert.ok(sql.includes(required), `missing migration contract: ${required}`);
  assert.ok(!sql.includes("p_existing_enrollment_id"), "reactivation must not reopen historical enrollments");
});

test("lifecycle server actions use RPCs instead of rewriting placement", () => {
  const source = readFileSync(new URL("../app/staff/students/actions.ts", import.meta.url), "utf8");
  for (const rpc of ["promote_student", "transfer_student", "complete_student_enrollment", "deactivate_student", "reactivate_student"]) assert.ok(source.includes(`rpc(\"${rpc}\"`), `missing RPC action: ${rpc}`);
  assert.doesNotMatch(source, /from\("student_enrollments"\)\.update\(\{academic_year_id/);
});

test("directory data access uses exact ranged counts without legacy caps", () => {
  const data = readFileSync(new URL("../lib/students.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/student-management.tsx", import.meta.url), "utf8");
  assert.match(data, /student_directory_current/);
  assert.match(data, /rpc\("search_student_directory"/);
  assert.match(data, /filtered_count/);
  assert.match(data, /p_academic_year_id/);
  assert.match(ui, /name="year"/);
  assert.match(ui, /Clear filters/);
  assert.doesNotMatch(data, /limit\(500\)|limit\(1000\)/);
  assert.match(ui, /activeFilters\.page>d\.totalPages/);
});
