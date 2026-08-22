import Link from "next/link";
import { notFound } from "next/navigation";

import { StaffNoticeForm } from "@/components/staff-notice-form";
import { getStaffNotice, noticeStatusLabels } from "@/lib/notices";

export default async function EditStaffNoticePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string; updated?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const notice = await getStaffNotice(id);
  if (!notice) notFound();

  return <><Link className="staff-back" href="/staff/notices">← Back to notice management</Link><header className="staff-page-header staff-notice-editor-header"><div><p className="eyebrow">Communication</p><h1>Edit notice</h1><p>Current status: <strong>{noticeStatusLabels[notice.status]}</strong></p></div></header>{feedback.error && <p className="staff-feedback" role="status">We could not save this notice. Please review the dates and required fields.</p>}{feedback.created && <p className="staff-feedback staff-feedback-success" role="status">Notice created successfully.</p>}{feedback.updated && <p className="staff-feedback staff-feedback-success" role="status">{feedback.updated === "archived" ? "Notice archived successfully." : "Notice updated successfully."}</p>}<StaffNoticeForm notice={notice} /></>;
}
