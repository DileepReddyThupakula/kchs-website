import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../lib/academic-year-rollover.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/staff/academics/rollover/actions.ts", import.meta.url), "utf8");
const preflight = source.slice(source.indexOf("export async function preflightAcademicYearRollover"), source.indexOf("function revalidateRolloverPaths"));
const execution = source.slice(source.indexOf("export async function executeAcademicYearRollover"), source.indexOf("export type AcademicRolloverWorkspaceData"));

test("rollover integration is server-only and uses the authoritative admin guard", () => {
  assert.match(source, /import ["']server-only["']/);
  assert.match(source, /await requireAdmin\(\)/g);
  assert.equal((source.match(/await requireAdmin\(\)/g) ?? []).length, 3);
  assert.match(actions, /["']use server["']/);
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 3);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role|SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(actions, /SERVICE_ROLE|service_role|SUPABASE_SERVICE_ROLE/);
});

test("non-admin server entry points are guarded before reaching rollover services", () => {
  for (const functionName of ["preflightAcademicYearRolloverAction", "executeAcademicYearRolloverAction", "getAcademicYearRolloverWorkspaceDataAction"]) {
    const start = actions.indexOf(`export async function ${functionName}`);
    const end = actions.indexOf("\n}", start) + 2;
    assert.match(actions.slice(start, end), /await requireAdmin\(\)/);
  }
});

test("client input validates UUIDs and prevents source-target self rollover", () => {
  assert.match(source, /z\.string\(\)\.uuid\(\)/);
  assert.match(source, /sourceAcademicYearId === plan\.targetAcademicYearId/);
  assert.match(source, /academicRolloverPlanSchema/);
});

test("only the four supported outcomes are accepted", () => {
  assert.match(source, /z\.enum\(\["promote", "repeat", "graduate", "exclude"\]\)/);
});

test("promotion and repeat require target placement while graduate and exclude prohibit it", () => {
  assert.match(source, /targetClassId == null \|\| item\.targetSectionId == null/);
  assert.match(source, /item\.outcome === "graduate" \|\| item\.outcome === "exclude"/);
  assert.match(source, /This outcome cannot include a target placement or roll number/);
});

test("preflight calls the authoritative RPC with normalized snake-case payload", () => {
  assert.match(preflight, /rpc\("preflight_academic_year_rollover"/);
  assert.match(preflight, /p_source_academic_year_id: parsed\.data\.sourceAcademicYearId/);
  assert.match(preflight, /p_target_academic_year_id: parsed\.data\.targetAcademicYearId/);
  assert.match(preflight, /p_items: toRpcPlan\(parsed\.data\)/);
});

test("preflight preserves the authoritative fingerprint and performs no execution call", () => {
  assert.match(source, /fingerprint: z\.string\(\)\.regex\(\/\^\[0-9a-f\]\{32\}/);
  assert.doesNotMatch(preflight, /execute_academic_year_rollover/);
});

test("execution requires an expected preflight fingerprint", () => {
  assert.match(source, /expectedFingerprint: z\.string\(\)\.trim\(\)\.regex/);
  assert.match(execution, /academicRolloverExecutionSchema\.safeParse\(input\)/);
  assert.match(execution, /p_plan_fingerprint: parsed\.data\.expectedFingerprint/);
});

test("execution invokes the authoritative RPC exactly once and never loops per student", () => {
  assert.equal((execution.match(/rpc\("execute_academic_year_rollover"/g) ?? []).length, 1);
  assert.doesNotMatch(execution, /promote_student|for \(.*student|forEach\(.*student/);
});

test("stale previews map to an actionable sanitized error", () => {
  assert.match(source, /case "40001"/);
  assert.match(source, /category: "stale_preview"/);
  assert.match(source, /Run preflight again before executing/);
});

test("database blockers and conflicts remain distinguishable", () => {
  assert.match(source, /case "23514"/);
  assert.match(source, /category: "blocker"/);
  assert.match(source, /case "23505"/);
  assert.match(source, /category: "conflict"/);
});

test("unexpected database failures are sanitized and only safe error codes are logged", () => {
  assert.match(source, /category: "database", message: "The academic rollover could not be completed/);
  assert.match(source, /code: error\.code/);
  assert.doesNotMatch(source, /message: error\.message|details: error\.details|hint: error\.hint/);
});

test("idempotent replay is part of the validated execution result", () => {
  assert.match(source, /idempotent_replay: z\.boolean\(\)/);
  assert.match(execution, /executionResultSchema\.safeParse\(data\)/);
});

test("successful execution revalidates only affected staff academic and student routes", () => {
  for (const path of ["/staff", "/staff/academics", "/staff/academics/years", "/staff/academics/classes", "/staff/academics/sections", "/staff/students", "/staff/students/enrollments"]) {
    assert.match(source, new RegExp(path.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(source, /revalidatePath\("\/"\)/);
});

test("workspace loader is admin-only and minimizes student data", () => {
  assert.match(source, /getAcademicYearRolloverWorkspaceData/);
  assert.match(source, /select\("id,admission_number,full_name,status"\)/);
  assert.doesNotMatch(source, /guardian|phone|address|email/);
});

test("workspace data is read-only and limited to current/planning academic structure", () => {
  assert.match(source, /\.in\("status", \["current", "planning"\]\)/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("rollover integration has no direct enrollment mutation path", () => {
  assert.doesNotMatch(source, /from\("student_enrollments"\)\.(insert|update|delete|upsert)/);
  assert.doesNotMatch(source, /promote_student|transfer_student|complete_student_enrollment/);
  assert.match(source, /rpc\("preflight_academic_year_rollover"/);
  assert.match(source, /rpc\("execute_academic_year_rollover"/);
});
