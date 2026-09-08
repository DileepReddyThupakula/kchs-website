import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/staff/academics/rollover/page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/academic-year-rollover-workspace.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/staff/academics/rollover/actions.ts", import.meta.url), "utf8");
const years = readFileSync(new URL("../app/staff/academics/years/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/staff/staff-academic-rollover.css", import.meta.url), "utf8");

test("rollover route exists and uses the server-side workspace loader", () => {
  assert.ok(existsSync(new URL("../app/staff/academics/rollover/loading.tsx", import.meta.url)));
  assert.match(route, /getAcademicYearRolloverWorkspaceData/);
  assert.match(route, /AcademicYearRolloverWorkspace/);
});

test("client workspace uses Phase 4B.4 server actions and no browser Supabase client", () => {
  assert.match(workspace, /["']use client["']/);
  assert.match(workspace, /preflightAcademicYearRolloverAction/);
  assert.match(workspace, /executeAcademicYearRolloverAction/);
  assert.doesNotMatch(workspace, /createClient|supabase|preflight_academic_year_rollover|execute_academic_year_rollover/);
  assert.match(actions, /["']use server["']/);
});

test("source year comes from the loader and only planning targets are selectable", () => {
  assert.match(workspace, /data\.sourceYear\.id/);
  assert.match(workspace, /data\.targetYears\.map/);
  assert.match(workspace, /Target planning academic year/);
  assert.doesNotMatch(workspace, /sourceAcademicYearId.*select|select.*sourceAcademicYearId/);
});

test("the four authoritative outcomes are present", () => {
  for (const outcome of ["promote", "repeat", "graduate", "exclude"]) assert.match(workspace, new RegExp(`value: "${outcome}"`));
});

test("promote and repeat require placement while graduate and exclude clear it", () => {
  assert.match(workspace, /summary\.incomplete/);
  assert.match(workspace, /row\.outcome === "promote" \|\| row\.outcome === "repeat"/);
  assert.match(workspace, /nextOutcome === "graduate" \|\| nextOutcome === "exclude"/);
  assert.match(workspace, /targetClassId: "", targetSectionId: "", targetRollNumber: ""/);
  assert.match(workspace, /Exclude leaves a student unresolved/);
});

test("target sections are constrained by selected target year and class", () => {
  assert.match(workspace, /section\.academic_year_id === targetYearId/);
  assert.match(workspace, /section\.class_id === row\.targetClassId/);
  assert.match(workspace, /onChange=.*targetClassId: event\.target\.value, targetSectionId: ""/);
});

test("bulk actions and filters update visible rows without executing", () => {
  assert.match(workspace, /Search students/);
  assert.match(workspace, /sourceClassId/);
  assert.match(workspace, /sourceSectionId/);
  assert.match(workspace, /outcomeFilter/);
  assert.match(workspace, /applyBulkOutcome/);
  assert.match(workspace, /it never executes the rollover/);
});

test("summary includes total, four outcomes, and incomplete counts", () => {
  for (const label of ["total", "promote", "repeat", "graduate", "exclude", "incomplete"]) assert.match(workspace, new RegExp(`summary\\.${label}|"${label}"`));
  assert.match(workspace, /Rollover plan summary/);
});

test("successful preflight produces one consistent current preview state", () => {
  assert.match(workspace, /preflightAcademicYearRolloverAction\(plan\)/);
  assert.match(workspace, /setPreview\(result\.data\)/);
  assert.match(workspace, /setPreflightPlan\(plan\)/);
  assert.match(workspace, /setPreviewInvalidated\(false\)/);
  assert.match(workspace, /preflightStatusLabel = previewInvalidated \? "Preview invalidated by edits" : preview\?\.ready \? "Preview current"/);
  assert.doesNotMatch(workspace, /preview \? "Preview invalidated by edits"/);
  assert.match(workspace, /preview\.fingerprint/);
});

test("only an execution-relevant edit after a ready preview shows invalidation", () => {
  assert.match(workspace, /const hadReadyPreview = Boolean\(preview\?\.ready && preflightPlan\)/);
  assert.match(workspace, /setPreviewInvalidated\(hadReadyPreview\)/);
  assert.match(workspace, /function editRows\(updater/);
  assert.match(workspace, /editRows\(\(current\) => current\.map/);
});

test("execution requires a ready preview and the stored plan", () => {
  assert.match(workspace, /if \(!preview\?\.ready \|\| !preflightPlan\) return/);
  assert.match(workspace, /executeAcademicYearRolloverAction\(\{ \.\.\.preflightPlan, expectedFingerprint: preview\.fingerprint \}\)/);
  assert.match(workspace, /setPreviewInvalidated\(false\)/);
});

test("an edit-invalidated preview cannot execute", () => {
  assert.match(workspace, /setPreview\(null\);\n    setPreflightPlan\(null\);/);
  assert.match(workspace, /if \(!preview\?\.ready \|\| !preflightPlan\) return/);
});

test("any plan edit invalidates the preflight", () => {
  assert.match(workspace, /function invalidatePreview/);
  assert.match(workspace, /setPreview\(null\)/);
  assert.match(workspace, /setPreflightPlan\(null\)/);
  assert.match(workspace, /function editRows/);
});

test("confirmation is explicit and accessible", () => {
  assert.match(workspace, /setConfirmationOpen\(true\)/);
  assert.match(workspace, /role="dialog"/);
  assert.match(workspace, /aria-modal="true"/);
  assert.match(workspace, /Final confirmation/);
  assert.match(workspace, /autoFocus/);
});

test("pending states prevent repeated interaction", () => {
  assert.match(workspace, /disabled=\{pending !== null\}/);
  assert.match(workspace, /pending === "execute" \? "Executing…"/);
  assert.match(workspace, /pending === "preflight" \? "Running preflight…"/);
  assert.match(workspace, /pending === "execute" \? "Executing"/);
  assert.match(workspace, /confirmationOpen \? "Confirming execution"/);
});

test("stale previews invalidate state without automatic retry", () => {
  assert.match(workspace, /result\.error\.category === "stale_preview"/);
  assert.match(workspace, /setPreview\(null\)/);
  assert.match(workspace, /Review plan again/);
  assert.doesNotMatch(workspace, /executeAcademicYearRolloverAction\(.*catch.*executeAcademicYearRolloverAction/s);
});

test("sanitized failures and authoritative blockers are surfaced", () => {
  assert.match(workspace, /role="alert"/);
  assert.match(workspace, /blockerLabel\(item\.code\)/);
  assert.match(workspace, /Authoritative blocker:/);
  assert.match(workspace, /safeError/);
});

test("successful execution renders a durable completion summary", () => {
  assert.match(workspace, /setCompleted\(\{ result: result\.data, sourceLabel, targetLabel \}\)/);
  assert.match(workspace, /if \(!data\.targetYears\.length && !completed\)/);
  assert.match(workspace, /Academic rollover complete/);
  assert.match(workspace, /result\.status/);
  assert.match(workspace, /result\.idempotent_replay/);
  assert.match(workspace, /Review enrollments/);
});

test("completion feedback uses the validated server result and preserves captured labels", () => {
  assert.match(workspace, /if \(result\.ok\)/);
  assert.match(workspace, /result: AcademicRolloverExecutionResult/);
  assert.match(workspace, /<CompletionSummary result=\{completed\.result\} sourceLabel=\{completed\.sourceLabel\} targetLabel=\{completed\.targetLabel\}/);
  assert.match(workspace, /result\.total_count/);
  assert.match(workspace, /result\.graduate_count/);
});

test("student display remains limited to administrative identifiers", () => {
  assert.match(workspace, /admission_number/);
  assert.match(workspace, /full_name/);
  assert.doesNotMatch(workspace, /guardian|phone|address|email/);
});

test("academic-year management exposes the rollover workspace", () => {
  assert.match(years, /\/staff\/academics\/rollover/);
  assert.match(years, /Open rollover workspace/);
});

test("responsive treatment preserves dense-table usability", () => {
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /min-width:1120px/);
  assert.match(css, /@media\(max-width:700px\)/);
});

test("labels, status regions, and reduced-motion treatment are present", () => {
  assert.match(workspace, /aria-label=/);
  assert.match(workspace, /aria-live="polite"/);
  assert.match(workspace, /role="status"/);
  assert.match(css, /prefers-reduced-motion/);
});

test("rollover UI does not introduce direct mutation or lifecycle RPC paths", () => {
  assert.doesNotMatch(workspace, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|promote_student|transfer_student|complete_student_enrollment/);
  assert.doesNotMatch(workspace, /service_role|SERVICE_ROLE/);
});
