import Link from "next/link";
import { notFound } from "next/navigation";

import { updateAdmissionNotes, updateAdmissionStatus } from "@/app/staff/actions";
import { admissionStatuses, getAdmission } from "@/lib/staff/admissions";

const statusLabel: Record<(typeof admissionStatuses)[number], string> = { new: "New", contacted: "Contacted", follow_up: "Follow Up", admitted: "Admitted", closed: "Closed" };

export default async function StaffAdmissionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { id } = await params;
  const feedback = await searchParams;
  const enquiry = await getAdmission(id);
  if (!enquiry) notFound();

  const submitted = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short" }).format(new Date(enquiry.created_at));
  return <><Link className="staff-back" href="/staff">← Back to admissions</Link><header className="staff-page-header staff-detail-header"><div><p className="eyebrow">Admissions enquiry</p><h1>{enquiry.student_name}</h1><p>Submitted {submitted}</p></div><span className={`status-badge status-${enquiry.status}`}>{statusLabel[enquiry.status]}</span></header>{feedback.error && <p className="staff-feedback" role="status">We could not save that change. Please try again.</p>}{feedback.updated && <p className="staff-feedback staff-feedback-success" role="status">Saved successfully.</p>}<div className="staff-detail-grid"><section className="staff-card"><h2>Parent details</h2><dl><div><dt>Guardian</dt><dd>{enquiry.guardian_name}</dd></div><div><dt>Class seeking</dt><dd>{enquiry.class_seeking}</dd></div><div><dt>Phone</dt><dd><a href={`tel:${enquiry.phone_number}`}>{enquiry.phone_number}</a></dd></div><div><dt>Email</dt><dd>{enquiry.email_address ? <a href={`mailto:${enquiry.email_address}`}>{enquiry.email_address}</a> : "Not provided"}</dd></div></dl><h2>Parent&apos;s message</h2><p className="staff-message">{enquiry.message || "No additional message was provided."}</p></section><aside className="staff-card staff-actions-card"><form action={updateAdmissionStatus}><input type="hidden" name="id" value={enquiry.id} /><label>Status<select name="status" defaultValue={enquiry.status}>{admissionStatuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label><button type="submit">Update status</button></form><form action={updateAdmissionNotes}><input type="hidden" name="id" value={enquiry.id} /><label>Staff notes<textarea name="staffNotes" defaultValue={enquiry.staff_notes ?? ""} rows={8} maxLength={4000} placeholder="Add a private follow-up note…" /></label><button type="submit">Save notes</button></form></aside></div></>;
}
