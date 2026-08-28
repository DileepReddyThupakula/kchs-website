"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const cls = (active: boolean) => active ? "staff-nav-current" : undefined;

function Group({ active, label, children }: { active: boolean; label: string; children: React.ReactNode }) {
  return <details className={`staff-nav-academics ${active ? "staff-nav-academics-current" : ""}`} open={active}><summary>{label}</summary><div>{children}</div></details>;
}

export function StaffNavigation({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();
  const is = (route: string) => pathname.startsWith(route);
  const academics = is("/staff/academics");
  const students = is("/staff/students");

  return <nav className="staff-nav" aria-label="Staff portal navigation">
    <p className="staff-nav-label">Main</p><Link href="/staff" className={cls(pathname === "/staff")}>◆ Dashboard</Link>
    <p className="staff-nav-label staff-nav-spacer">Admissions</p><Link href="/staff/admissions" className={cls(is("/staff/admissions"))}>◇ Enquiries</Link>
    {role === "admin" && <>
      <p className="staff-nav-label staff-nav-spacer">School management</p><Link href="/staff/staff" className={cls(is("/staff/staff"))}>◈ Staff</Link>
      <Group active={academics} label="▤ Academic Structure"><Link href="/staff/academics" className={cls(pathname === "/staff/academics")}>Overview</Link><Link href="/staff/academics/years" className={cls(is("/staff/academics/years"))}>Academic Years</Link><Link href="/staff/academics/classes" className={cls(is("/staff/academics/classes"))}>Classes</Link><Link href="/staff/academics/sections" className={cls(is("/staff/academics/sections"))}>Sections</Link><Link href="/staff/academics/subjects" className={cls(is("/staff/academics/subjects"))}>Subjects</Link><Link href="/staff/academics/assignments" className={cls(is("/staff/academics/assignments"))}>Subject Assignments</Link></Group>
      <p className="staff-nav-label staff-nav-spacer">Student management</p><Group active={students} label="◉ Students"><Link href="/staff/students" className={cls(pathname === "/staff/students")}>Overview / All Students</Link><Link href="/staff/students/new" className={cls(is("/staff/students/new"))}>Add Student</Link><Link href="/staff/students/enrollments" className={cls(is("/staff/students/enrollments"))}>Student Enrollments</Link></Group><Link href="/staff/attendance" className={cls(is("/staff/attendance"))}>◷ Attendance</Link>
    </>}
    <p className="staff-nav-label staff-nav-spacer">Communication</p><Link href="/staff/notices" className={cls(is("/staff/notices"))}>✦ Notices</Link><Link href="/staff/events" className={cls(is("/staff/events"))}>◌ Events</Link><Link href="/staff/gallery" className={cls(is("/staff/gallery"))}>▣ Gallery</Link><Link href="/staff/documents" className={cls(is("/staff/documents"))}>▤ Documents</Link>
    <p className="staff-nav-label staff-nav-spacer">School community</p><Link href="/staff/faculty" className={cls(is("/staff/faculty"))}>◇ Faculty</Link>
    <p className="staff-nav-label staff-nav-spacer">Public website</p><Link href="/">↗ View website</Link>
  </nav>;
}
