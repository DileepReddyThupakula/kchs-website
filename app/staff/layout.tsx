import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutStaff } from "@/app/staff/actions";
import { requireStaff } from "@/lib/staff/auth";

import "../staff.css";
import "./staff-detail.css";
import "./staff-mobile.css";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return <main className="staff-shell"><aside className="staff-sidebar"><Link href="/staff" className="staff-brand" aria-label="Krishna Chaitanya High School staff portal"><Image src="/images/krishna-chaitanya-logo.png" alt="Krishna Chaitanya High School" width={64} height={64} priority /><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL</small><em>Staff Portal</em></span></Link><nav className="staff-nav" aria-label="Staff portal navigation"><p className="staff-nav-label">Admissions</p><Link href="/staff" className="staff-nav-current"><span aria-hidden="true">◆</span> Enquiries</Link><p className="staff-nav-label staff-nav-spacer">Public website</p><Link href="/"><span aria-hidden="true">↗</span> View website</Link></nav><div className="staff-sidebar-footer"><div className="staff-account"><span aria-hidden="true">{staff.role === "admin" ? "AD" : "ST"}</span><div><strong>{staff.email ?? "Authorised staff"}</strong><small>{staff.role === "admin" ? "Administrator" : "Staff member"}</small></div></div><form action={signOutStaff}><button type="submit">Sign out <span aria-hidden="true">→</span></button></form></div></aside><section className="staff-main">{children}</section></main>;
}
