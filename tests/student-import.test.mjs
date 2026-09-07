import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseStudentImportCsv,
  summarizeStudentAdmissionNumbers,
  studentImportTemplate,
  STUDENT_IMPORT_HEADERS,
  STUDENT_IMPORT_MAX_BYTES,
  STUDENT_IMPORT_MAX_ROWS,
  validateStudentImportRows,
} from "../lib/student-import.ts";

const header = STUDENT_IMPORT_HEADERS.join(",");
const validRow = "Asha Rao,ADM-001,2026-06-01,2014-02-03,female,1,2026-06-01";
const placement = {
  academicYear: { id: "11111111-1111-4111-8111-111111111111", label: "2026-27", status: "current", start_date: "2026-06-01", end_date: "2027-04-30" },
  class: { id: "22222222-2222-4222-8222-222222222222", name: "Class 5", active: true },
  section: { id: "33333333-3333-4333-8333-333333333333", name: "A", academic_year_id: "11111111-1111-4111-8111-111111111111", class_id: "22222222-2222-4222-8222-222222222222", active: true },
};

function parse(text) {
  const result = parseStudentImportCsv(text);
  assert.equal(result.success, true);
  if (!result.success) throw new Error(result.message);
  return result;
}

test("parses the finalized headers and preserves source row numbers", () => {
  const result = parse(`${header}\n${validRow}\n`);
  assert.deepEqual(result.headers, [...STUDENT_IMPORT_HEADERS]);
  assert.equal(result.rows[0].sourceRow, 2);
  assert.equal(result.rows[0].values.full_name, "Asha Rao");
});

test("accepts UTF-8 BOM, CRLF, LF, whitespace, quoted commas, and escaped quotes", () => {
  const result = parse(`\ufeff ${header.replace("full_name", "full name")} \r\n "Rao, Asha" , ADM-002 , 2026-06-01 , , , , 2026-06-01 \r\n"O""Brien",ADM-003,2026-06-01,,,,2026-06-01\n`);
  assert.equal(result.rows[0].values.full_name, "Rao, Asha");
  assert.equal(result.rows[0].values.admission_number, "ADM-002");
  assert.equal(result.rows[1].values.full_name, 'O"Brien');
});

test("rejects malformed CSV and preserves the offending source row", () => {
  const result = parseStudentImportCsv(`${header}\n"Unclosed,ADM-004,2026-06-01,,,,2026-06-01`);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.message, /unclosed/i);
  assert.equal(result.sourceRow, 2);
});

test("rejects duplicate, unknown, and missing required headers", () => {
  const duplicate = parseStudentImportCsv("full_name,full name,admission_number,admission_date,enrollment_date\n");
  const unknown = parseStudentImportCsv("full_name,admission_number,admission_date,enrollment_date,secret\n");
  const missing = parseStudentImportCsv("full_name,admission_number,admission_date\n");
  assert.equal(duplicate.success, false);
  assert.equal(unknown.success, false);
  assert.equal(missing.success, false);
  if (!duplicate.success) assert.match(duplicate.message, /duplicate/i);
  if (!unknown.success) assert.match(unknown.message, /unknown/i);
  if (!missing.success) assert.match(missing.message, /missing/i);
});

test("rejects an empty file and accepts a headers-only template without data rows", () => {
  const empty = parseStudentImportCsv("\ufeff  \r\n");
  const template = parseStudentImportCsv(studentImportTemplate());
  assert.equal(empty.success, false);
  assert.equal(template.success, true);
  if (template.success) assert.equal(template.rows.length, 0);
});

test("ignores trailing blank lines but reports interior blank rows", () => {
  const result = parse(`${header}\n${validRow}\n\nBala Rao,ADM-008,2026-06-01,,,,2026-06-01\n\n`);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[1].blank, true);
  assert.equal(result.rows[1].sourceRow, 3);
});

test("rejects oversized files and more than 2,000 data rows", () => {
  const oversized = parseStudentImportCsv("x".repeat(STUDENT_IMPORT_MAX_BYTES + 1));
  const manyRows = `${header}\n${Array.from({ length: STUDENT_IMPORT_MAX_ROWS + 1 }, (_, index) => `Student ${index},ADM-${index},2026-06-01,,,${index},2026-06-01`).join("\n")}`;
  const tooMany = parseStudentImportCsv(manyRows);
  assert.equal(oversized.success, false);
  assert.equal(tooMany.success, false);
  if (!oversized.success) assert.match(oversized.message, /2 MB/i);
  if (!tooMany.success) assert.match(tooMany.message, /2,000/);
});

test("rejects malformed UTF-8 byte input", () => {
  const result = parseStudentImportCsv(new Uint8Array([0xef, 0xbb, 0x28]));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.message, /UTF-8/i);
});

test("validates required values, lengths, dates, and gender using the existing schema", () => {
  const result = parse(`${header}\n,${"A".repeat(51)},2026-02-30,2014-01-01,unknown,1,2026-06-01\n`);
  const [preview] = validateStudentImportRows(result.rows, placement);
  assert.equal(preview.status, "ERROR");
  assert.ok(preview.fieldErrors.full_name);
  assert.ok(preview.fieldErrors.admission_number);
  assert.ok(preview.fieldErrors.admission_date);
  assert.ok(preview.fieldErrors.gender);
});

test("detects normalized duplicate admission and roll numbers inside the selected class", () => {
  const result = parse(`${header}\nAsha, ADM-005 ,2026-06-01,,, 7 ,2026-06-01\nBala,adm-005,2026-06-01,,,7,2026-06-01\n`);
  const previews = validateStudentImportRows(result.rows, placement);
  assert.equal(previews[0].status, "ERROR");
  assert.equal(previews[1].status, "ERROR");
  assert.ok(previews[0].fieldErrors.admission_number);
  assert.ok(previews[1].fieldErrors.admission_number);
  assert.ok(previews[0].fieldErrors.roll_number);
  assert.ok(previews[1].fieldErrors.roll_number);
});

test("detects read-only database conflicts without returning existing records", () => {
  const result = parse(`${header}\n${validRow}\n`);
  const previews = validateStudentImportRows(result.rows, placement, { admissionNumbers: new Set(["adm-001"]), rollNumbers: new Set(["1"]) });
  assert.equal(previews[0].status, "ERROR");
  assert.ok(previews[0].fieldErrors.admission_number);
  assert.ok(previews[0].fieldErrors.roll_number);
  assert.deepEqual(Object.keys(previews[0].values).sort(), [...STUDENT_IMPORT_HEADERS].sort());
});

test("summarizes the required read-only database preflight without exposing records", () => {
  const preflight = summarizeStudentAdmissionNumbers([" ADM-001 ", "adm-001", "ADM-002", "", null], 5);
  assert.deepEqual(preflight, {
    totalStudents: 5,
    duplicateNormalizedAdmissionNumbers: 1,
    duplicateNormalizedAdmissionNumberRows: 2,
    admissionNumbersWithLeadingOrTrailingWhitespace: 1,
    blankNormalizedAdmissionNumbers: 2,
  });
});

test("rejects enrollment dates outside the selected academic year", () => {
  const result = parse(`${header}\nAsha,ADM-006,2026-06-01,,,1,2027-05-01\n`);
  const [preview] = validateStudentImportRows(result.rows, placement);
  assert.equal(preview.status, "ERROR");
  assert.match(preview.fieldErrors.enrollment_date[0], /academic year/i);
});

test("validation can produce a warning for an allowed blank roll number", () => {
  const result = parse(`${header}\nAsha,ADM-007,2026-06-01,,,,2026-06-01\n`);
  const [preview] = validateStudentImportRows(result.rows, placement);
  assert.equal(preview.status, "WARNING");
  assert.equal(preview.fieldErrors.roll_number, undefined);
});

test("preview action is read-only and protected, and template route is admin-only", () => {
  const action = readFileSync(new URL("../app/staff/students/import/actions.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/staff/students/import/page.tsx", import.meta.url), "utf8");
  const template = readFileSync(new URL("../app/staff/students/import/template/route.ts", import.meta.url), "utf8");
  assert.match(action, /requireAdmin/);
  assert.match(action, /\.select\("admission_number", \{ count: "exact" \}\)/);
  assert.match(action, /databasePreflight/);
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  assert.match(page, /requireAdmin/);
  assert.match(template, /getCurrentStaff/);
  assert.match(template, /staff\.role !== "admin"/);
});

test("existing single-student creation and directory contracts remain present", () => {
  const actions = readFileSync(new URL("../app/staff/students/actions.ts", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../lib/student-directory.ts", import.meta.url), "utf8");
  assert.match(actions, /createStudent/);
  assert.match(actions, /create_student_with_enrollment/);
  assert.match(directory, /directoryRange/);
  assert.match(directory, /directoryPageHref/);
});
