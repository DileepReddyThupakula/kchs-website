import Link from "next/link";
import { getCurrentStaff } from "@/lib/staff/auth";
import { getStaffMembersOverview } from "@/lib/staff-members";

export async function StaffDirectoryDashboardModule() { const current = await getCurrentStaff(); if (current?.role !== "admin") return null; const overview = await getStaffMembersOverview(); return <section className="staff-dashboard-module"><header><p className="staff-dashboard-section-kicker">School management</p><h2>Staff</h2><p><strong>{overview.active}</strong> active · <strong>{overview.teachers}</strong> teacher{overview.teachers === 1 ? "" : "s"} · <strong>{overview.nonTeaching}</strong> non-teaching</p></header><Link href="/staff/staff">Manage staff <span aria-hidden="true">→</span></Link></section>; }
