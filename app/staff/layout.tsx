import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutStaff } from "@/app/staff/actions";
import { StaffPortalShell } from "@/components/staff-portal-shell";
import { StaffNavigation } from "@/components/staff-navigation";
import { requireStaff } from "@/lib/staff/auth";

import "../staff.css";
import "./staff-detail.css";
import "./staff-status-summary.css";
import "./staff-notices.css";
import "./staff-notice-workflow.css";
import "./staff-events.css";
import "./staff-event-validation.css";
import "./staff-gallery.css";
import "./staff-documents.css";
import "./staff-faculty.css";
import "./staff-members.css";
import "./staff-academics.css";
import "./staff-academic-editors.css";
import "./staff-academic-mobile-actions.css";
import "./staff-students.css";
import "./staff-student-import.css";
import "./staff-student-validation.css";
import "./staff-attendance.css";
import "./staff-cosmetics.css";
import "./staff-academic-feedback.css";
import "./staff-academic-rollover.css";
import "./staff-coming-soon.css";
import "./staff-erp-shell.css";
import "./staff-loading.css";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return <StaffPortalShell accountEmail={staff.email} accountRole={staff.role} sidebar={<>
    <Link href="/staff" className="staff-brand" aria-label="Krishna Chaitanya High School admin portal">
      <Image src="/images/krishna-chaitanya-logo.png" alt="Krishna Chaitanya High School" width={48} height={48} priority />
      <span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL</small><em>Admin Portal</em></span>
    </Link>
    <StaffNavigation role={staff.role}/>
    <div className="staff-sidebar-footer">
      <div className="staff-account">
        <span aria-hidden="true">{staff.role === "admin" ? "AD" : "ST"}</span>
        <div><strong>{staff.email ?? "Authorised staff"}</strong><small>{staff.role === "admin" ? "Administrator" : "Staff member"}</small></div>
      </div>
      <form action={signOutStaff}><button type="submit" aria-label="Sign out">Sign out <span aria-hidden="true">→</span></button></form>
    </div>
  </>}>
    {children}
  </StaffPortalShell>;
}
