import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("attendance UI uses only the secured attendance RPC contracts", () => {
  const actions = source("app/staff/attendance/actions.ts");
  for (const rpc of ["save_student_attendance", "lock_student_attendance_session", "unlock_student_attendance_session"]) {
    assert.match(actions, new RegExp(`rpc\\("${rpc}"`));
  }
  assert.doesNotMatch(actions, /from\("student_attendance_(sessions|records|revisions)"\)\.(insert|update|delete)/);
  assert.match(actions, /await requireAdmin\(\)/);
  assert.match(actions, /p_expected_revision/);
});

test("attendance roster is loaded server-side through the authoritative RPC", () => {
  const data = source("lib/student-attendance.ts");
  assert.match(data, /await requireAdmin\(\)/);
  assert.match(data, /rpc\("get_student_attendance_roster"/);
  assert.match(data, /academic_year_id === academicYearId && section\.class_id === classId/);
  assert.doesNotMatch(data, /from\("student_attendance_(sessions|records)"\)\.(insert|update|delete)/);
});

test("attendance workspace preserves the required operational safeguards", () => {
  const component = source("components/student-attendance-workspace.tsx");
  for (const text of ["Mark all present", "correction_reason", "unlock_reason", "beforeunload", "Reload roster", "expected_revision"]) {
    assert.match(component, new RegExp(text));
  }
  assert.match(component, /setSelectedYear/);
  assert.match(component, /setSelectedClass/);
  assert.match(component, /setSelectedSection/);
  assert.match(component, /defaults to Present/);
  assert.match(component, /disabled=\{locked/);
  assert.match(component, /aria-label=\{`Attendance status for/);
});

test("attendance is exposed only in the admin navigation and dashboard", () => {
  const navigation = source("components/staff-navigation.tsx");
  const dashboard = source("app/staff/page.tsx");
  assert.match(navigation, /role === "admin" &&/);
  assert.match(navigation, /href="\/staff\/attendance"/);
  assert.match(dashboard, /title="Attendance"/);
  assert.match(dashboard, /href="\/staff\/attendance"/);
});
