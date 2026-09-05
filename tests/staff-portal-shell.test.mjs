import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { isComingSoonSlug, isStaffNavigationActive, staffNavigationSections } from "../lib/staff-navigation.ts";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const allItems = staffNavigationSections.flatMap((section) => section.items);

test("admin navigation covers the approved portal destinations without transport or library", () => {
  const destinations = allItems.map((item) => item.href);
  for (const href of ["/staff", "/staff/admissions", "/staff/students", "/staff/attendance", "/staff/homework", "/staff/exams", "/staff/staff", "/staff/academics", "/staff/timetable", "/staff/fees", "/staff/notices", "/staff/events", "/staff/gallery", "/staff/documents", "/staff/academic-year", "/staff/reports", "/staff/users", "/staff/audit", "/staff/backup", "/staff/staff-attendance", "/staff/payroll"]) assert.ok(destinations.includes(href), `missing ${href}`);
  assert.ok(!destinations.some((href) => /transport|library/.test(href)));
});

test("existing functional destinations remain separate from Coming Soon routes", () => {
  for (const route of ["admissions", "students", "attendance", "staff", "academics", "notices", "events", "gallery", "documents", "faculty"]) assert.ok(existsSync(new URL(`../app/staff/${route}/page.tsx`, import.meta.url)));
  for (const slug of ["homework", "exams", "timetable", "fees", "academic-year", "reports", "users", "audit", "backup", "staff-attendance", "payroll"]) assert.ok(isComingSoonSlug(slug));
  assert.ok(existsSync(new URL("../app/staff/(admin-coming-soon)/[comingSoon]/page.tsx", import.meta.url)));
});

test("navigation active state uses a route prefix without marking dashboard active for every staff page", () => {
  const dashboard = allItems.find((item) => item.href === "/staff");
  const attendance = allItems.find((item) => item.href === "/staff/attendance");
  assert.equal(isStaffNavigationActive("/staff", dashboard), true);
  assert.equal(isStaffNavigationActive("/staff/attendance", dashboard), false);
  assert.equal(isStaffNavigationActive("/staff/attendance", attendance), true);
});

test("dashboard is built from real database reads and expresses pending attendance honestly", () => {
  const data = source("lib/staff-dashboard.ts");
  const page = source("app/staff/page.tsx");
  assert.match(data, /from\("students"\).*count: "exact"/s);
  assert.match(data, /from\("staff_members"\).*count: "exact"/s);
  assert.match(data, /from\("school_classes"\).*eq\("active", true\)/s);
  assert.match(data, /from\("student_attendance_sessions"\)/);
  assert.match(data, /from\("student_attendance_records"\)/);
  assert.match(page, /Attendance pending/);
  assert.doesNotMatch(page, /Fee statistics|Exam statistics|Payroll statistics|performance percentage/i);
});

test("responsive navigation retains bounded grid tracks and independent sidebar scrolling", () => {
  const mobile = source("app/staff/staff-navigation-mobile.css");
  const shell = source("app/staff/staff-portal-shell.css");
  assert.match(mobile, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(shell, /overflow-y:auto/);
  assert.match(shell, /min-width:0/);
});
