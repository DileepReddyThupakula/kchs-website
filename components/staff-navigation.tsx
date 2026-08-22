"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navigationClass(isActive: boolean) {
  return isActive ? "staff-nav-current" : undefined;
}

export function StaffNavigation() {
  const pathname = usePathname();
  const dashboardActive = pathname === "/staff";
  const admissionsActive = pathname.startsWith("/staff/admissions");
  const noticesActive = pathname.startsWith("/staff/notices");
  const eventsActive = pathname.startsWith("/staff/events");

  return <nav className="staff-nav" aria-label="Staff portal navigation">
    <p className="staff-nav-label">Main</p>
    <Link href="/staff" className={navigationClass(dashboardActive)} aria-current={dashboardActive ? "page" : undefined}><span aria-hidden="true">◆</span> Dashboard</Link>
    <p className="staff-nav-label staff-nav-spacer">Admissions</p>
    <Link href="/staff/admissions" className={navigationClass(admissionsActive)} aria-current={admissionsActive ? "page" : undefined}><span aria-hidden="true">◇</span> Enquiries</Link>
    <p className="staff-nav-label staff-nav-spacer">Communication</p>
    <Link href="/staff/notices" className={navigationClass(noticesActive)} aria-current={noticesActive ? "page" : undefined}><span aria-hidden="true">✦</span> Notices</Link>
    <Link href="/staff/events" className={navigationClass(eventsActive)} aria-current={eventsActive ? "page" : undefined}><span aria-hidden="true">◌</span> Events</Link>
    <p className="staff-nav-label staff-nav-spacer">Public website</p>
    <Link href="/"><span aria-hidden="true">↗</span> View website</Link>
  </nav>;
}
