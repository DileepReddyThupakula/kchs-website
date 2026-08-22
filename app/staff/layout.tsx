import Link from "next/link";
import type { ReactNode } from "react";

import { signOutStaff } from "@/app/staff/actions";
import { requireStaff } from "@/lib/staff/auth";

import "../staff.css";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return <main className="staff-shell"><aside className="staff-sidebar"><Link href="/staff" className="brand"><span className="crest"><b>K</b><i>CHS</i></span><span><strong>Krishna Chaitanya</strong><small>STAFF PORTAL</small></span></Link><nav className="staff-nav" aria-label="Staff portal navigation"><Link href="/staff">Admissions</Link><Link href="/">View public website</Link></nav><div className="staff-account"><span>{staff.role === "admin" ? "AD" : "ST"}</span><div><strong>{staff.email ?? "Authorised staff"}</strong><small>{staff.role === "admin" ? "Administrator" : "Staff member"}</small></div></div><form action={signOutStaff}><button type="submit">Sign out</button></form></aside><section className="staff-main">{children}</section></main>;
}
