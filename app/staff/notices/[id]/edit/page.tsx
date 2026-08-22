import Link from "next/link";
import { notFound } from "next/navigation";

import { StaffNoticeForm } from "@/components/staff-notice-form";
import { formatNoticeDateTime, getNoticePresentationStatus, getStaffNotice, noticePresentationLabels } from "@/lib/notices";

export default async function EditStaffNoticePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string; updated?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const notice = await getStaffNotice(id);
  if (!notice) notFound();
  const presentation = getNoticePresentationStatus(notice);

  return <><Link className="staff-back" href="/staff/notices">← Back to notice management</Link><header className="staff-page-header staff-notice-editor-header"><div><p className="eyebrow">Communication</p><h1>Edit notice</h1><p>Current status: <strong className={`notice-status-badge notice-status-${presentation}`}>{noticePresentationLabels[presentation]}</strong>{presentation === "published" && <> · Published on {formatNoticeDateTime(notice.published_at)}</>}{presentation === "scheduled" && <> · Scheduled for {formatNoticeDateTime(notice.published_at)} IST</>}</p></div></header>{feedback.error && <p className="staff-feedback" role="status">We couldn&apos;t save this notice. Please try again.</p>}{feedback.created && <p className="staff-feedback staff-feedback-success" role="status">Notice created successfully.</p>}{feedback.updated && <p className="staff-feedback staff-feedback-success" role="status">{feedback.updated === "archived" ? "Notice archived." : "Notice updated successfully."}</p>}<StaffNoticeForm notice={notice} /></>;
}
