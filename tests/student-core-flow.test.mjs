import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { enrollmentSchema, normalizeStudentFormData, studentEditPatch, studentEditSchema, studentFormStateValues, studentSchema } from "../lib/student-validation.ts";
import { formatStudentAddress, studentContactSummary } from "../lib/student-compat.ts";

function requiredForm() {
  const form = new FormData();
  form.set("admission_number", "KCHS-001");
  form.set("full_name", "Test Student");
  form.set("admission_date", "2026-08-24");
  form.set("status", "active");
  return form;
}

test("unchecked transport normalizes to false and validates", () => {
  const normalized = normalizeStudentFormData(requiredForm());
  assert.equal(normalized.transport_required, false);
  assert.equal(studentSchema.safeParse(normalized).success, true);
});

test("checked transport normalizes to true and validates", () => {
  const form = requiredForm();
  form.set("transport_required", "on");
  const normalized = normalizeStudentFormData(form);
  assert.equal(normalized.transport_required, true);
  assert.equal(studentSchema.safeParse(normalized).success, true);
});

test("replayable create values preserve strings and checkbox state but not files", () => {
  const form = requiredForm();
  form.set("transport_required", "on");
  form.set("photo", new File(["not relevant"], "student.jpg", { type: "image/jpeg" }));
  assert.deepEqual(studentFormStateValues(form), {
    admission_number: "KCHS-001", full_name: "Test Student", admission_date: "2026-08-24", status: "active", transport_required: true,
  });
});

test("edit schema excludes legacy contact fields that are not editable", () => {
  const form = requiredForm();
  const parsed = studentEditSchema.safeParse(normalizeStudentFormData(form));
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  for (const field of ["father_guardian_name", "primary_phone", "secondary_phone", "email", "primary_contact"]) assert.equal(field in parsed.data, false);
  const patch = studentEditPatch(parsed.data, form);
  assert.deepEqual(Object.keys(patch).sort(), ["admission_date", "admission_number", "full_name", "status", "transport_required"]);
});

test("structured address takes precedence over legacy address", () => {
  assert.equal(formatStudentAddress({
    door_number: "12-3", street: "School Road", address_line_2: null, area_locality: "Central Colony", village_town_city: "Yerraguntla", mandal: "Yerraguntla", district: "Kadapa", state: "Andhra Pradesh", postal_code: "516309", address_line_1: "Old address", locality: "Old locality", city: "Old city",
  }), "12-3, School Road, Central Colony, Yerraguntla, Yerraguntla, Kadapa, Andhra Pradesh, 516309");
});

test("legacy-only address remains visible", () => {
  assert.equal(formatStudentAddress({
    door_number: null, street: null, address_line_2: "Near the temple", area_locality: null, village_town_city: null, mandal: null, district: null, state: "Andhra Pradesh", postal_code: "516309", address_line_1: "Main Road", locality: "Old locality", city: "Yerraguntla",
  }), "Main Road, Near the temple, Old locality, Yerraguntla, Andhra Pradesh, 516309");
});

test("partially structured address keeps missing legacy components", () => {
  assert.equal(formatStudentAddress({
    door_number: "12", street: null, address_line_2: "Near the temple", area_locality: null, village_town_city: null, mandal: null, district: null, state: "Andhra Pradesh", postal_code: "516309", address_line_1: "Main Road", locality: "Old locality", city: "Yerraguntla",
  }), "12, Main Road, Near the temple, Old locality, Yerraguntla, Andhra Pradesh, 516309");
  assert.equal(formatStudentAddress({
    door_number: null, street: "School Road", address_line_2: null, area_locality: null, village_town_city: null, mandal: null, district: null, state: "Andhra Pradesh", postal_code: "516309", address_line_1: "Legacy house details", locality: "Old locality", city: "Yerraguntla",
  }), "School Road, Legacy house details, Old locality, Yerraguntla, Andhra Pradesh, 516309");
  assert.equal(formatStudentAddress({
    door_number: null, street: "School Road", address_line_2: null, area_locality: "New Area", village_town_city: null, mandal: null, district: null, state: "Andhra Pradesh", postal_code: "516309", address_line_1: "Legacy house details", locality: "Old locality", city: "Yerraguntla",
  }), "School Road, Legacy house details, New Area, Yerraguntla, Andhra Pradesh, 516309");
  assert.equal(formatStudentAddress({
    door_number: "12", street: null, address_line_2: null, area_locality: "New Area", village_town_city: null, mandal: null, district: null, state: "Andhra Pradesh", postal_code: "516309", address_line_1: "Legacy Street", locality: "Old locality", city: "Yerraguntla",
  }), "12, Legacy Street, New Area, Yerraguntla, Andhra Pradesh, 516309");
});

test("upgraded primary contact is preferred with legacy fallback", () => {
  assert.deepEqual(studentContactSummary({
    primary_contact: "guardian", father_name: "Father", father_mobile: "1111111", father_email: null, mother_name: "Mother", mother_mobile: "2222222", mother_email: null, guardian_name: "Guardian", guardian_mobile: "3333333", guardian_email: "guardian@example.com", father_guardian_name: "Legacy Guardian", primary_phone: "9999999", email: "legacy@example.com",
  }), { name: "Guardian", phone: "3333333", email: "guardian@example.com" });
  assert.deepEqual(studentContactSummary({
    primary_contact: null, father_name: null, father_mobile: null, father_email: null, mother_name: null, mother_mobile: null, mother_email: null, guardian_name: null, guardian_mobile: null, guardian_email: null, father_guardian_name: "Legacy Guardian", primary_phone: "9999999", email: "legacy@example.com",
  }), { name: "Legacy Guardian", phone: "9999999", email: "legacy@example.com" });
  assert.deepEqual(studentContactSummary({
    primary_contact: "father", father_name: "Father", father_mobile: null, father_email: null, mother_name: null, mother_mobile: null, mother_email: null, guardian_name: null, guardian_mobile: null, guardian_email: null, father_guardian_name: "Legacy Guardian", primary_phone: "9999999", email: "legacy@example.com",
  }), { name: "Father", phone: "9999999", email: "legacy@example.com" });
});

test("every create schema field has an inline-error focus target", () => {
  const source = readFileSync(new URL("../components/student-create-form.tsx", import.meta.url), "utf8");
  const enrollmentSource = readFileSync(new URL("../components/student-enrollment-form.tsx", import.meta.url), "utf8");
  for (const field of [...studentSchema.keyof().options, ...enrollmentSchema.keyof().options, "photo"]) {
    assert.match(source, new RegExp(`\\b${field}:\\s*\"student-`), `missing focus target for ${field}`);
  }
  assert.match(source, /enrollment_status:\s*"student-enrollment-status"/);
  assert.match(enrollmentSource, /id="student-enrollment-status"/);
});

test("student detail query is direct and enrollment history is ordered", () => {
  const source = readFileSync(new URL("../lib/students.ts", import.meta.url), "utf8");
  assert.match(source, /from\("students"\)\.select\(studentDetailFields\)\.eq\("id",id\)\.maybeSingle\(\)/);
  assert.match(source, /eq\("student_id",id\)\.order\("enrollment_date",\{ascending:false\}\)\.order\("created_at",\{ascending:false\}\)/);
  assert.match(source, /if\(failed\)queryFailure\("studentDetail",failed\)/);
});

test("photo-management safety paths remain present", () => {
  const actions = readFileSync(new URL("../app/staff/students/actions.ts", import.meta.url), "utf8");
  const profile = readFileSync(new URL("../components/student-management.tsx", import.meta.url), "utf8");
  assert.match(actions, /validStudentPhoto/);
  assert.match(actions, /upsert:false/);
  assert.match(actions, /remove\(\[newPath\]\)/);
  assert.match(actions, /remove\(\[current\.profile_photo_path\]\)/);
  assert.match(profile, /createSignedUrl\(path,1800\)/);
  assert.match(profile, /photoUrl\?<Image/);
});
