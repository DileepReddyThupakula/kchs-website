import Link from "next/link";

import type { StaffNavigationIcon } from "@/lib/staff-navigation";

export function StaffComingSoon({ description, detail, icon, title }: { description: string; detail: string; icon: StaffNavigationIcon; title: string }) {
  return <section className="staff-coming-soon" aria-labelledby="coming-soon-title">
    <div className="staff-coming-soon-icon" aria-hidden="true"><PortalIcon icon={icon}/></div>
    <p className="eyebrow">Admin Portal</p>
    <span className="staff-coming-soon-badge">Coming Soon</span>
    <h1 id="coming-soon-title">{title}</h1>
    <p className="staff-coming-soon-description">{description}</p>
    <p className="staff-coming-soon-detail">{detail}</p>
    <Link className="staff-coming-soon-back" href="/staff">Back to Dashboard <span aria-hidden="true">→</span></Link>
  </section>;
}

export function PortalIcon({ icon }: { icon: StaffNavigationIcon }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.7 };
  const paths: Record<StaffNavigationIcon, React.ReactNode> = {
    academic: <><path {...common} d="M3 9.5 12 4l9 5.5-9 5-9-5Z"/><path {...common} d="M6 11.2v4.3c2.9 2 9.1 2 12 0v-4.3"/></>,
    archive: <><path {...common} d="M4 7h16v13H4z"/><path {...common} d="M3 4h18v3H3zM9 12h6"/></>,
    attendance: <><rect {...common} x="4" y="3" width="16" height="18" rx="2"/><path {...common} d="M8 3v4m8-4v4M7 11h10m-8 4 2 2 4-4"/></>,
    backup: <><path {...common} d="M6 8V5h12v3M5 9h14v10H5zM9 13h6v5H9z"/></>,
    calendar: <><rect {...common} x="4" y="4" width="16" height="16" rx="2"/><path {...common} d="M8 2v4m8-4v4M4 9h16"/></>,
    dashboard: <><rect {...common} x="4" y="4" width="6" height="6" rx="1"/><rect {...common} x="14" y="4" width="6" height="6" rx="1"/><rect {...common} x="4" y="14" width="6" height="6" rx="1"/><rect {...common} x="14" y="14" width="6" height="6" rx="1"/></>,
    document: <><path {...common} d="M7 3h7l4 4v14H7z"/><path {...common} d="M14 3v5h4M10 12h5m-5 4h5"/></>,
    event: <><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M12 8v4l3 2"/></>,
    fees: <><rect {...common} x="4" y="5" width="16" height="14" rx="2"/><path {...common} d="M4 9h16m-9 5h2"/></>,
    gallery: <><rect {...common} x="3" y="4" width="18" height="16" rx="2"/><circle {...common} cx="9" cy="9" r="1.5"/><path {...common} d="m5 18 5-5 3 3 2-2 4 4"/></>,
    homework: <><path {...common} d="M6 3h10l2 2v16H6z"/><path {...common} d="M9 9h6m-6 4h6m-6 4h4"/></>,
    notice: <><path {...common} d="M5 7h14v11H5z"/><path {...common} d="M8 4h8m-5 3v11m3-8h2"/></>,
    people: <><circle {...common} cx="9" cy="8" r="3"/><path {...common} d="M3.5 20c.7-3 2.5-5 5.5-5s4.8 2 5.5 5M17 10a2.5 2.5 0 1 0 0-5m1 15c-.4-1.9-1.3-3.4-2.8-4.2"/></>,
    report: <><path {...common} d="M6 3h9l3 3v15H6z"/><path {...common} d="M15 3v4h3M9 16v-3m3 3v-6m3 6v-4"/></>,
    security: <><path {...common} d="M12 3 19 6v5c0 4.7-3 7.9-7 10-4-2.1-7-5.3-7-10V6z"/><path {...common} d="m9 12 2 2 4-4"/></>,
    student: <><circle {...common} cx="12" cy="8" r="3"/><path {...common} d="M5 20c.7-3.4 3-5.5 7-5.5s6.3 2.1 7 5.5"/></>,
    timetable: <><rect {...common} x="4" y="4" width="16" height="16" rx="2"/><path {...common} d="M4 10h16M10 4v16"/></>,
    user: <><circle {...common} cx="12" cy="8" r="3"/><path {...common} d="M5 20c.7-3.4 3-5.5 7-5.5s6.3 2.1 7 5.5"/><path {...common} d="M18 6v4m-2-2h4"/></>,
  };
  return <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">{paths[icon]}</svg>;
}
