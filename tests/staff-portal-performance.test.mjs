import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff loading boundary is static, accessible, and lightweight", () => {
  assert.ok(existsSync(new URL("../app/staff/loading.tsx", import.meta.url)));
  const loading = source("app/staff/loading.tsx");
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /role="status"/);
  assert.doesNotMatch(loading, /use client|framer-motion|motion\.|supabase|createClient/);
  assert.match(source("app/staff/layout.tsx"), /staff-loading\.css/);
});

test("academic years uses the narrow loader while full academic views retain academicData", () => {
  const academics = source("lib/academics.ts");
  const management = source("components/academic-management.tsx");
  const yearsStart = academics.indexOf("export async function academicYears");
  const fullDataStart = academics.indexOf("export async function academicData");
  const yearsLoader = academics.slice(yearsStart, fullDataStart);
  assert.ok(yearsStart >= 0);
  assert.ok(fullDataStart > yearsStart);
  assert.match(yearsLoader, /from\("academic_years"\)/);
  assert.doesNotMatch(yearsLoader, /school_classes|academic_sections|subjects|staff_members|section_subject_assignments/);
  assert.match(management, /academicYears/);
  assert.ok(management.indexOf('if (view === "years")') < management.indexOf("const data = await academicData()"));
  assert.match(management, /if \(view === "classes"\)/);
  assert.match(management, /if \(view === "sections"\)/);
  assert.match(management, /if \(view === "subjects"\)/);
});

test("staff authorization remains server-side and performance logs expose timing metadata only", () => {
  const auth = source("lib/staff/auth.ts");
  const performance = source("lib/staff/performance.ts");
  assert.match(auth, /server-only/);
  assert.match(auth, /staff_users/);
  assert.match(auth, /staffUser\?\.active/);
  assert.match(auth, /staffUser\.role === "admin" \|\| staffUser\.role === "staff"/);
  assert.match(performance, /durationMs/);
  assert.match(performance, /operation/);
  assert.match(performance, /outcome/);
  assert.match(performance, /stage/);
  assert.doesNotMatch(performance, /password|token|cookie|secret|service_role|student|email|userId|claims/i);
});

test("diagnostic timing coverage exists for the audited staff loaders", () => {
  const files = [
    "lib/staff/auth.ts",
    "proxy.ts",
    "lib/academics.ts",
    "lib/students.ts",
    "lib/staff-dashboard.ts",
    "lib/academic-year-rollover.ts",
  ].map(source).join("\n");
  for (const label of [
    "staff-authorisation",
    "staff-proxy-identity-verification",
    "academic-years-loader",
    "student-directory-loader",
    "staff-dashboard-loader",
    "academic-rollover-workspace-loader",
  ]) assert.match(files, new RegExp(label));
  assert.match(files, /query-wave/);
});

test("performance logging failures do not propagate to the request", () => {
  const result = spawnSync(process.execPath, [
    "--conditions=react-server",
    "--experimental-strip-types",
    "--input-type=module",
    "-e",
    `import { logStaffTiming } from "./lib/staff/performance.ts";
const originalInfo = console.info;
console.info = () => { throw new Error("synthetic logging sink failure"); };
try {
  logStaffTiming("test-operation", performance.now(), "success", "operation");
} finally {
  console.info = originalInfo;
}`,
  ], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "development", STAFF_PERFORMANCE_LOGGING: "true" },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
});

test("staff navigation remains Next Link based and rollover discovery remains intact", () => {
  const navigation = source("components/staff-navigation.tsx");
  const navigationConfig = source("lib/staff-navigation.ts");
  const years = source("app/staff/academics/years/page.tsx");
  const navigationLink = navigation.slice(navigation.indexOf("function NavigationLink"), navigation.indexOf("export function StaffNavigation"));
  const publicNavigation = navigation.slice(navigation.indexOf("staff-nav-public"));
  assert.match(navigation, /import Link from "next\/link"/);
  assert.match(navigationLink, /<Link[\s\S]*href=\{item\.href\}[\s\S]*prefetch=\{false\}/);
  assert.match(navigationLink, /prefetch=\{false\}/);
  assert.doesNotMatch(publicNavigation, /prefetch=\{false\}/);
  assert.doesNotMatch(navigation, /<a\b/);
  assert.match(navigationConfig, /href: "\/staff\/academics\/years"/);
  assert.match(navigationConfig, /"\/staff\/academics\/rollover"/);
  assert.match(years, /\/staff\/academics\/rollover/);
});
