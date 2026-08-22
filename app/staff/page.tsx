import Link from "next/link";

import { admissionClasses } from "@/lib/admissions/schema";
import { admissionStatuses, listAdmissions } from "@/lib/staff/admissions";

const statusLabel: Record<(typeof admissionStatuses)[number], string> = { new: "New", contacted: "Contacted", follow_up: "Follow Up", admitted: "Admitted", closed: "Closed" };

export default async function StaffAdmissionsPage({ searchParams }: { searchParams: Promise<{ class?: string; status?: string }> }) {
  const filters = await searchParams;
  const admissions = await listAdmissions({ classSeeking: filters.class, status: filters.status });

  return <><header className="staff-page-header"><div><p className="eyebrow">Admissions</p><h1>Enquiry inbox</h1><p>Review and follow up on parent admissions enquiries.</p></div><strong>{admissions.length} shown</strong></header><form className="staff-filters" action="/staff"><label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option>{admissionStatuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label><label>Class<select name="class" defaultValue={filters.class ?? ""}><option value="">All classes</option>{admissionClasses.map((item) => <option key={item}>{item}</option>)}</select></label><button type="submit">Apply filters</button><Link href="/staff">Clear</Link></form><section className="staff-table-wrap" aria-label="Admissions enquiries"><table className="staff-table"><thead><tr><th>Student</th><th>Guardian</th><th>Class</th><th>Phone</th><th>Email</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{admissions.length ? admissions.map((enquiry) => <tr key={enquiry.id}><td><Link href={`/staff/admissions/${enquiry.id}`}>{enquiry.student_name}</Link></td><td>{enquiry.guardian_name}</td><td>{enquiry.class_seeking}</td><td><a href={`tel:${enquiry.phone_number}`}>{enquiry.phone_number}</a></td><td>{enquiry.email_address ? <a href={`mailto:${enquiry.email_address}`}>{enquiry.email_address}</a> : "—"}</td><td><span className={`status-badge status-${enquiry.status}`}>{statusLabel[enquiry.status]}</span></td><td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(enquiry.created_at))}</td></tr>) : <tr><td colSpan={7} className="staff-empty">No admissions enquiries match these filters.</td></tr>}</tbody></table></section></>;
}
