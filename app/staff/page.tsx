import Link from "next/link";
import type { ReactNode } from "react";

import { PortalIcon } from "@/components/staff-coming-soon";
import { eventTypeLabels } from "@/lib/events";
import { formatDashboardDate, formatDashboardEventDate, getAdminDashboardOverview } from "@/lib/staff-dashboard";
import { getCurrentStaff } from "@/lib/staff/auth";
import type { StaffNavigationIcon } from "@/lib/staff-navigation";

export default async function StaffDashboardPage() {
  const current = await getCurrentStaff();
  if (current?.role !== "admin") return <StaffAccessDashboard/>;

  const dashboard = await getAdminDashboardOverview();
  const attendancePending = !dashboard.attendance.failed && dashboard.attendance.rows.length === 0;
  const attendanceValue = dashboard.attendance.failed ? "Unavailable" : attendancePending ? "Pending" : `${dashboard.attendance.rows.length} marked`;
  const attendanceDetail = dashboard.attendance.failed ? "Try again later" : attendancePending ? "Attendance pending · Not marked today" : "Class registers recorded";

  return <main className="staff-admin-dashboard">
    <header className="staff-admin-dashboard-header">
      <div>
        <p className="staff-dashboard-kicker">Overview</p>
        <h1>Dashboard</h1>
        <p className="staff-dashboard-subtitle">School operations overview</p>
      </div>
      <div className="staff-dashboard-header-meta" aria-label="Dashboard context">
        <span><span aria-hidden="true" className="staff-status-dot"/> <time dateTime={dashboard.attendance.date}>{formatDashboardDate(dashboard.attendance.date)}</time></span>
        <span>Academic year: {dashboard.currentAcademicYear ?? "Not configured"}</span>
      </div>
    </header>

    <section aria-label="School overview" className="staff-admin-dashboard-metrics">
      <MetricCard detail="All student records" icon="student" label="Students" value={dashboard.metrics.students} />
      <MetricCard detail="All staff records" icon="people" label="Staff" value={dashboard.metrics.staff} />
      <MetricCard detail="Active classes" icon="academic" label="Classes" value={dashboard.metrics.classes} />
      <MetricCard detail={attendanceDetail} icon="attendance" label="Attendance" value={attendanceValue} />
    </section>

    <section aria-labelledby="today-attendance" className="staff-dashboard-panel staff-dashboard-attendance-panel">
      <DashboardPanelHeader headingId="today-attendance" kicker="Daily register" title="Today&apos;s Attendance">
        <Link className="staff-dashboard-primary-link" href="/staff/attendance">{attendancePending ? "Take Attendance" : "View Attendance"}<span aria-hidden="true">→</span></Link>
      </DashboardPanelHeader>
      {dashboard.attendance.failed ? <AttendanceEmptyState detail="Attendance status is temporarily unavailable." title="Unable to load today&apos;s register." /> : attendancePending ? <AttendanceEmptyState detail="No class or section has been marked yet." title="Attendance hasn&apos;t been recorded today." /> : <div className="staff-table-wrap"><table className="staff-dashboard-attendance-table"><thead><tr><th>Class</th><th>Section</th><th>Present</th><th>Absent</th><th>Status</th></tr></thead><tbody>{dashboard.attendance.rows.map((row) => <tr key={`${row.className}-${row.sectionName}`}><td><strong>{row.className}</strong></td><td>{row.sectionName}</td><td>{row.present}</td><td>{row.absent}</td><td><span className={`staff-dashboard-attendance-state staff-dashboard-attendance-state-${row.state}`}>{row.state === "locked" ? "Completed" : "Marked"}</span></td></tr>)}</tbody></table></div>}
    </section>

    <section aria-labelledby="quick-actions" className="staff-dashboard-panel staff-dashboard-quick-panel">
      <DashboardPanelHeader headingId="quick-actions" kicker="Shortcuts" title="Quick actions" />
      <nav aria-label="Quick actions" className="staff-dashboard-quick-actions">
        <QuickAction href="/staff/attendance" icon="attendance" label="Take Attendance" />
        <QuickAction href="/staff/students/new" icon="student" label="Add Student" />
        <QuickAction href="/staff/staff/new" icon="people" label="Add Staff" />
        <QuickAction href="/staff/notices/new" icon="notice" label="New Notice" />
        <QuickAction href="/staff/admissions" icon="notice" label="Admissions" />
      </nav>
    </section>

    <div className="staff-dashboard-lists">
      <DashboardList headingId="recent-notices" heading="Recent Notices" href="/staff/notices" kicker="Communication" empty="No published notices are available yet.">{dashboard.notices.map((notice) => <li key={notice.id}><Link href={`/staff/notices/${notice.id}/edit`}><span><strong>{notice.title}</strong><small>{notice.published_at ? "Published" : "Updated"}</small></span><time dateTime={notice.published_at ?? notice.updated_at}>{formatDashboardEventDate(notice.published_at ?? notice.updated_at)}</time></Link></li>)}</DashboardList>
      <DashboardList headingId="upcoming-events" heading="Upcoming Events" href="/staff/events" kicker="School calendar" empty="No upcoming published events are available yet.">{dashboard.events.map((event) => <li key={event.id}><Link href={`/staff/events/${event.id}/edit`}><span><strong>{event.title}</strong><small>{eventTypeLabels[event.event_type as keyof typeof eventTypeLabels] ?? "School event"}</small></span><time dateTime={event.start_at}>{formatDashboardEventDate(event.start_at)}</time></Link></li>)}</DashboardList>
    </div>
  </main>;
}

function MetricCard({ detail, icon, label, value }: { detail: string; icon: StaffNavigationIcon; label: string; value: number | string | null }) {
  return <article className="staff-admin-dashboard-metric">
    <div className="staff-dashboard-metric-heading"><span aria-hidden="true" className="staff-dashboard-metric-icon"><PortalIcon icon={icon}/></span><span>{label}</span></div>
    <strong>{value === null ? "—" : value}</strong>
    <p>{detail}</p>
  </article>;
}

function DashboardPanelHeader({ children, headingId, kicker, title }: { children?: ReactNode; headingId: string; kicker: string; title: string }) {
  return <header className="staff-dashboard-panel-header"><div><p className="staff-dashboard-section-kicker">{kicker}</p><h2 id={headingId}>{title}</h2></div>{children}</header>;
}

function AttendanceEmptyState({ detail, title }: { detail: string; title: string }) {
  return <div className="staff-dashboard-empty-state"><span aria-hidden="true" className="staff-dashboard-empty-icon"><PortalIcon icon="attendance"/></span><div><strong>{title}</strong><p>{detail}</p></div><Link className="staff-dashboard-empty-action" href="/staff/attendance">Take Attendance<span aria-hidden="true">→</span></Link></div>;
}

function QuickAction({ href, icon, label }: { href: string; icon: StaffNavigationIcon; label: string }) {
  return <Link href={href}><span aria-hidden="true" className="staff-dashboard-action-icon"><PortalIcon icon={icon}/></span><span>{label}</span><span aria-hidden="true" className="staff-dashboard-action-arrow">→</span></Link>;
}

function DashboardList({ children, empty, heading, headingId, href, kicker }: { children: ReactNode[]; empty: string; heading: string; headingId: string; href: string; kicker: string }) {
  return <section aria-labelledby={headingId} className="staff-dashboard-panel staff-dashboard-list-panel"><DashboardPanelHeader headingId={headingId} kicker={kicker} title={heading}><Link className="staff-dashboard-secondary-link" href={href}>View all<span aria-hidden="true">→</span></Link></DashboardPanelHeader>{children.length ? <ul className="staff-dashboard-list">{children}</ul> : <p className="staff-dashboard-list-empty">{empty}</p>}</section>;
}

function StaffAccessDashboard() {
  return <main className="staff-admin-dashboard"><header className="staff-admin-dashboard-header"><div><p className="staff-dashboard-kicker">Staff portal</p><h1>Dashboard</h1><p className="staff-dashboard-subtitle">Use the modules available to your staff account.</p></div></header><section aria-labelledby="staff-quick-actions" className="staff-dashboard-panel"><DashboardPanelHeader headingId="staff-quick-actions" kicker="Workspace" title="Quick actions" /><div className="staff-dashboard-quick-actions"><QuickAction href="/staff/admissions" icon="notice" label="Admissions"/><QuickAction href="/staff/notices" icon="notice" label="Notices"/><QuickAction href="/staff/events" icon="event" label="Events"/><QuickAction href="/staff/documents" icon="document" label="Documents"/><QuickAction href="/staff/faculty" icon="people" label="Faculty"/></div></section></main>;
}
