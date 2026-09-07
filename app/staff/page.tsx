import Link from "next/link";
import type { ReactNode } from "react";

import { PortalIcon } from "@/components/staff-coming-soon";
import { eventTypeLabels } from "@/lib/events";
import { formatDashboardDate, formatDashboardEventDate, getAdminDashboardOverview } from "@/lib/staff-dashboard";
import type { AdminDashboardOverview } from "@/lib/staff-dashboard";
import { getCurrentStaff } from "@/lib/staff/auth";
import type { StaffNavigationIcon } from "@/lib/staff-navigation";

export default async function StaffDashboardPage() {
  const current = await getCurrentStaff();
  if (current?.role !== "admin") return <StaffAccessDashboard />;

  const dashboard = await getAdminDashboardOverview();
  const attendanceRows = dashboard.attendance.rows;
  const attendancePending = !dashboard.attendance.failed && (attendanceRows.length === 0 || attendanceRows.some((row) => row.state === "open"));
  const attendanceValue = dashboard.attendance.failed ? "Unavailable" : attendanceRows.length === 0 ? "Pending" : `${attendanceRows.length} register${attendanceRows.length === 1 ? "" : "s"}`;
  const attendanceDetail = dashboard.attendance.failed ? "Try again later" : attendancePending ? "Attendance pending · Register needs attention" : "Registers recorded today";
  const attendanceSummary = attendanceRows.reduce(
    (summary, row) => ({
      absent: summary.absent + row.absent,
      pending: summary.pending + (row.state === "open" ? 1 : 0),
      present: summary.present + row.present,
      total: summary.total + row.present + row.absent,
    }),
    { absent: 0, pending: 0, present: 0, total: 0 },
  );

  return <main className="staff-admin-dashboard">
    <header className="staff-admin-dashboard-header">
      <div>
        <p className="staff-dashboard-kicker">Overview</p>
        <h1>Dashboard</h1>
        <p className="staff-dashboard-subtitle">School operations overview</p>
      </div>
      <div className="staff-dashboard-header-meta" aria-label="Dashboard context">
        <span><span aria-hidden="true" className="staff-status-dot" /> <time dateTime={dashboard.attendance.date}>{formatDashboardDate(dashboard.attendance.date)}</time></span>
        <span>Academic year: {dashboard.currentAcademicYear ?? "Not configured"}</span>
      </div>
    </header>

    <section aria-label="School overview" className="staff-admin-dashboard-metrics">
      <MetricBandItem detail="All student records" label="Student records" value={dashboard.metrics.students} />
      <MetricBandItem detail="All staff records" label="Faculty & staff" value={dashboard.metrics.staff} />
      <MetricBandItem detail="Active school classes" label="Active classes" value={dashboard.metrics.classes} />
      <MetricBandItem detail={attendanceDetail} label="Today's attendance" value={attendanceValue} />
    </section>

    <div className="staff-dashboard-main-grid">
      <section aria-labelledby="today-attendance" className="staff-dashboard-section staff-dashboard-attendance-section">
        <DashboardPanelHeader headingId="today-attendance" kicker="Daily register" title="Today's Roll Call Status">
          <div className="staff-dashboard-header-actions">
            <span className={`staff-dashboard-context-status ${dashboard.attendance.failed ? "staff-dashboard-context-status-unavailable" : attendancePending ? "staff-dashboard-context-status-pending" : "staff-dashboard-context-status-recorded"}`}>{dashboard.attendance.failed ? "Unavailable" : attendancePending ? "Attendance pending" : "Recorded today"}</span>
            <Link className="staff-dashboard-primary-link" href="/staff/attendance">{attendancePending ? "Take Attendance" : "View Attendance"}<span aria-hidden="true">→</span></Link>
          </div>
        </DashboardPanelHeader>
        <div className="staff-dashboard-attendance-summary" aria-label="Attendance totals">
          <AttendanceSummaryItem label="Present" value={dashboard.attendance.failed ? "—" : attendanceSummary.present} />
          <AttendanceSummaryItem label="Absent" value={dashboard.attendance.failed ? "—" : attendanceSummary.absent} />
          <AttendanceSummaryItem label="Pending" value={dashboard.attendance.failed ? "—" : attendanceRows.length === 0 ? "—" : attendanceSummary.pending} />
          <AttendanceSummaryItem label="Total" value={dashboard.attendance.failed ? "—" : attendanceRows.length === 0 ? "—" : attendanceSummary.total} />
        </div>
        <AttendanceRegister failed={dashboard.attendance.failed} rows={attendanceRows} />
      </section>

      <DashboardList empty="Published notices and circulars will appear here when available." emptyIcon="notice" emptyTitle="No published notices yet." headingId="recent-notices" heading="Recent Notices & Circulars" href="/staff/notices" kicker="Communication">{dashboard.notices.map((notice) => <li key={notice.id}><Link href={`/staff/notices/${notice.id}/edit`}><span><strong>{notice.title}</strong><small>{notice.published_at ? "Published" : "Updated"}</small></span><time dateTime={notice.published_at ?? notice.updated_at}>{formatDashboardEventDate(notice.published_at ?? notice.updated_at)}</time></Link></li>)}</DashboardList>
    </div>

    <div className="staff-dashboard-lower-grid">
      <section aria-labelledby="quick-actions" className="staff-dashboard-section staff-dashboard-quick-section">
        <DashboardPanelHeader headingId="quick-actions" kicker="Workspace" title="Institutional Actions" />
        <nav aria-label="Institutional actions" className="staff-dashboard-quick-actions">
          <QuickAction description="Open today's class registers" href="/staff/attendance" icon="attendance" label="Take Attendance" />
          <QuickAction description="Create a student record" href="/staff/students/new" icon="student" label="Add Student" />
          <QuickAction description="Add a staff record" href="/staff/staff/new" icon="people" label="Add Staff" />
          <QuickAction description="Draft a school notice" href="/staff/notices/new" icon="notice" label="New Notice" />
          <QuickAction description="Review admissions enquiries" href="/staff/admissions" icon="notice" label="Admissions" />
        </nav>
      </section>

      <DashboardList empty="Published events will appear here when available." emptyIcon="event" emptyTitle="No upcoming events yet." headingId="upcoming-events" heading="Upcoming Institutional Events" href="/staff/events" kicker="School calendar">{dashboard.events.map((event) => <li key={event.id}><Link href={`/staff/events/${event.id}/edit`}><span><strong>{event.title}</strong><small>{eventTypeLabels[event.event_type as keyof typeof eventTypeLabels] ?? "School event"}</small></span><time dateTime={event.start_at}>{formatDashboardEventDate(event.start_at)}</time></Link></li>)}</DashboardList>
    </div>
  </main>;
}

function MetricBandItem({ detail, label, value }: { detail: string; label: string; value: number | string | null }) {
  return <div className="staff-admin-dashboard-metric">
    <span>{label}</span>
    <strong>{value === null ? "Unavailable" : value}</strong>
    <small>{detail}</small>
  </div>;
}

function AttendanceSummaryItem({ label, value }: { label: string; value: number | string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function AttendanceRegister({ failed, rows }: Pick<AdminDashboardOverview["attendance"], "failed" | "rows">) {
  return <div className="staff-table-wrap staff-dashboard-attendance-register" role="region" aria-label="Today's attendance register" tabIndex={0}><table className="staff-dashboard-attendance-table"><thead><tr><th>Class</th><th>Section</th><th>Present</th><th>Absent</th><th>Status</th></tr></thead><tbody>{failed || rows.length === 0 ? <tr><td className="staff-dashboard-empty-cell" colSpan={5}><AttendanceEmptyState detail={failed ? "Attendance status is temporarily unavailable." : "No class or section has been marked yet."} title={failed ? "Unable to load today's register." : "Attendance hasn't been recorded today."} /></td></tr> : rows.map((row) => <tr key={`${row.className}-${row.sectionName}`}><td><strong>{row.className}</strong></td><td>{row.sectionName}</td><td>{row.present}</td><td>{row.absent}</td><td><span className={`staff-dashboard-attendance-state staff-dashboard-attendance-state-${row.state}`}>{row.state === "locked" ? "Completed" : "Open"}</span></td></tr>)}</tbody></table></div>;
}

function DashboardPanelHeader({ children, headingId, kicker, title }: { children?: ReactNode; headingId: string; kicker: string; title: string }) {
  return <header className="staff-dashboard-panel-header"><div><p className="staff-dashboard-section-kicker">{kicker}</p><h2 id={headingId}>{title}</h2></div>{children}</header>;
}

function AttendanceEmptyState({ detail, title }: { detail: string; title: string }) {
  return <div className="staff-dashboard-empty-state"><span aria-hidden="true" className="staff-dashboard-empty-icon"><PortalIcon icon="attendance" /></span><div><strong>{title}</strong><p>{detail}</p></div><Link className="staff-dashboard-empty-action" href="/staff/attendance">Take Attendance<span aria-hidden="true">→</span></Link></div>;
}

function QuickAction({ description, href, icon, label }: { description: string; href: string; icon: StaffNavigationIcon; label: string }) {
  return <Link href={href}><span aria-hidden="true" className="staff-dashboard-action-icon"><PortalIcon icon={icon} /></span><span><strong>{label}</strong><small>{description}</small></span><span aria-hidden="true" className="staff-dashboard-action-arrow">→</span></Link>;
}

function DashboardList({ children, empty, emptyIcon, emptyTitle, heading, headingId, href, kicker }: { children: ReactNode[]; empty: string; emptyIcon: StaffNavigationIcon; emptyTitle: string; heading: string; headingId: string; href: string; kicker: string }) {
  return <section aria-labelledby={headingId} className="staff-dashboard-section staff-dashboard-list-section"><DashboardPanelHeader headingId={headingId} kicker={kicker} title={heading}><Link className="staff-dashboard-secondary-link" href={href}>View all<span aria-hidden="true">→</span></Link></DashboardPanelHeader>{children.length ? <ul className="staff-dashboard-list">{children}</ul> : <div className="staff-dashboard-list-empty" role="status"><span aria-hidden="true" className="staff-dashboard-list-empty-icon"><PortalIcon icon={emptyIcon} /></span><div><strong>{emptyTitle}</strong><p>{empty}</p></div></div>}</section>;
}

function StaffAccessDashboard() {
  return <main className="staff-admin-dashboard"><header className="staff-admin-dashboard-header"><div><p className="staff-dashboard-kicker">Staff portal</p><h1>Dashboard</h1><p className="staff-dashboard-subtitle">Use the modules available to your staff account.</p></div></header><section aria-labelledby="staff-quick-actions" className="staff-dashboard-section"><DashboardPanelHeader headingId="staff-quick-actions" kicker="Workspace" title="Quick actions" /><div className="staff-dashboard-quick-actions"><QuickAction description="Review admissions enquiries" href="/staff/admissions" icon="notice" label="Admissions" /><QuickAction description="Manage school notices" href="/staff/notices" icon="notice" label="Notices" /><QuickAction description="Review the school calendar" href="/staff/events" icon="event" label="Events" /><QuickAction description="Open school documents" href="/staff/documents" icon="document" label="Documents" /><QuickAction description="View faculty records" href="/staff/faculty" icon="people" label="Faculty" /></div></section></main>;
}
