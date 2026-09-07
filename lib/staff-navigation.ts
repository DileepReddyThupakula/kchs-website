export type StaffNavigationIcon =
  | "academic"
  | "archive"
  | "attendance"
  | "backup"
  | "calendar"
  | "dashboard"
  | "document"
  | "event"
  | "fees"
  | "gallery"
  | "homework"
  | "notice"
  | "people"
  | "report"
  | "security"
  | "student"
  | "timetable"
  | "user";

export type StaffNavigationItem = {
  adminOnly?: boolean;
  href: string;
  icon: StaffNavigationIcon;
  label: string;
  match?: string;
};

export type StaffNavigationSection = {
  collapsible?: boolean;
  icon?: StaffNavigationIcon;
  items: StaffNavigationItem[];
  label: string;
};

export const comingSoonModules = {
  "academic-year": {
    description: "Academic-year rollover and student-promotion tools will be available here.",
    detail: "This module will support careful academic-year setup, promotion review and progression records.",
    icon: "academic",
    title: "Academic Year & Promotion",
  },
  audit: {
    description: "Security and audit review will be available here.",
    detail: "This module will provide a controlled record of important administrative activity.",
    icon: "security",
    title: "Security & Audit Log",
  },
  backup: {
    description: "Backup and data-export controls will be available here.",
    detail: "This module will provide carefully controlled export and continuity tools.",
    icon: "backup",
    title: "Backup & Export",
  },
  exams: {
    description: "Examination and marks management will be available here.",
    detail: "This module will support assessment setup, marks entry and results workflows.",
    icon: "academic",
    title: "Exams & Marks",
  },
  fees: {
    description: "Fee collection and payment management will be available here.",
    detail: "No financial numbers are shown until the finance workflow is implemented.",
    icon: "fees",
    title: "Fees Management",
  },
  homework: {
    description: "Homework and classwork management will be available here.",
    detail: "This module will support daily classwork, homework assignments and teacher updates.",
    icon: "homework",
    title: "Homework / Classwork",
  },
  payroll: {
    description: "Staff payroll management will be available here.",
    detail: "This module will support controlled payroll preparation and records.",
    icon: "fees",
    title: "Payroll",
  },
  reports: {
    description: "School reporting will be available here.",
    detail: "This module will provide operational reports once the underlying workflows are in place.",
    icon: "report",
    title: "Reports",
  },
  "staff-attendance": {
    description: "Staff attendance will be available here.",
    detail: "This module will support daily staff attendance without affecting student attendance.",
    icon: "attendance",
    title: "Staff Attendance",
  },
  timetable: {
    description: "Timetable management will be available here.",
    detail: "This module will support class, subject and teacher scheduling.",
    icon: "timetable",
    title: "Timetable",
  },
  users: {
    description: "User and role management will be available here.",
    detail: "This module will provide controlled access administration for authorised school staff.",
    icon: "user",
    title: "User & Role Management",
  },
} as const satisfies Record<string, { description: string; detail: string; icon: StaffNavigationIcon; title: string }>;

export type ComingSoonSlug = keyof typeof comingSoonModules;

export const staffNavigationSections: StaffNavigationSection[] = [
  { label: "Overview", items: [{ href: "/staff", icon: "dashboard", label: "Dashboard" }] },
  { label: "Admissions", items: [{ href: "/staff/admissions", icon: "notice", label: "Enquiries" }] },
  {
    collapsible: true,
    icon: "student",
    label: "Students",
    items: [
      { adminOnly: true, href: "/staff/students", icon: "student", label: "Student Directory" },
      { adminOnly: true, href: "/staff/attendance", icon: "attendance", label: "Attendance" },
      { adminOnly: true, href: "/staff/homework", icon: "homework", label: "Homework / Classwork" },
      { adminOnly: true, href: "/staff/exams", icon: "academic", label: "Exams & Marks" },
    ],
  },
  {
    collapsible: true,
    icon: "academic",
    label: "Academics",
    items: [
      { adminOnly: true, href: "/staff/academics", icon: "academic", label: "Classes & Sections", match: "/staff/academics" },
      { adminOnly: true, href: "/staff/timetable", icon: "timetable", label: "Timetable" },
      { adminOnly: true, href: "/staff/academic-year", icon: "academic", label: "Academic Year & Promotion" },
    ],
  },
  {
    collapsible: true,
    icon: "people",
    label: "Staff",
    items: [
      { adminOnly: true, href: "/staff/staff", icon: "people", label: "Staff Directory" },
      { href: "/staff/faculty", icon: "people", label: "Faculty" },
      { adminOnly: true, href: "/staff/staff-attendance", icon: "attendance", label: "Staff Attendance" },
      { adminOnly: true, href: "/staff/payroll", icon: "fees", label: "Payroll" },
    ],
  },
  { label: "Finance", items: [{ adminOnly: true, href: "/staff/fees", icon: "fees", label: "Fees Management" }] },
  {
    label: "Communication",
    items: [
      { href: "/staff/notices", icon: "notice", label: "Notices", match: "/staff/notices" },
      { href: "/staff/events", icon: "event", label: "Events" },
      { href: "/staff/gallery", icon: "gallery", label: "Gallery" },
    ],
  },
  { label: "Documents", items: [{ href: "/staff/documents", icon: "document", label: "Certificates & Documents", match: "/staff/documents" }] },
  {
    collapsible: true,
    icon: "security",
    label: "Administration",
    items: [
      { adminOnly: true, href: "/staff/reports", icon: "report", label: "Reports" },
      { adminOnly: true, href: "/staff/users", icon: "user", label: "Users & Roles" },
      { adminOnly: true, href: "/staff/audit", icon: "security", label: "Security & Audit" },
      { adminOnly: true, href: "/staff/backup", icon: "backup", label: "Backup & Export" },
    ],
  },
];

export function isComingSoonSlug(value: string): value is ComingSoonSlug {
  return Object.hasOwn(comingSoonModules, value);
}

export function isStaffNavigationActive(pathname: string, item: StaffNavigationItem) {
  if (item.href === "/staff") return pathname === "/staff";
  const match = item.match ?? item.href;
  return pathname === match || pathname.startsWith(`${match}/`);
}
