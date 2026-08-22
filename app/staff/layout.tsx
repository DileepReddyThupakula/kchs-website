import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutStaff } from "@/app/staff/actions";
import { StaffNavigation } from "@/components/staff-navigation";
import { requireStaff } from "@/lib/staff/auth";

import "../staff.css";
import "./staff-detail.css";
import "./staff-mobile.css";
import "./staff-status-summary.css";
import "./staff-dashboard.css";
import "./staff-navigation.css";
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
import "./staff-cosmetics.css";
import "./staff-academic-feedback.css";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return <main className="staff-shell"><aside className="staff-sidebar"><Link href="/staff" className="staff-brand" aria-label="Krishna Chaitanya High School staff portal"><Image src="/images/krishna-chaitanya-logo.png" alt="Krishna Chaitanya High School" width={64} height={64} priority /><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL</small><em>Staff Portal</em></span></Link><StaffNavigation role={staff.role}/><div className="staff-sidebar-footer"><div className="staff-account"><span aria-hidden="true">{staff.role === "admin" ? "AD" : "ST"}</span><div><strong>{staff.email ?? "Authorised staff"}</strong><small>{staff.role === "admin" ? "Administrator" : "Staff member"}</small></div></div><form action={signOutStaff}><button type="submit" aria-label="Sign out">Sign out <span aria-hidden="true">→</span></button></form></div></aside><section className="staff-main">{children}</section></main>;
}
