import Link from "next/link";

import { StaffNoticeForm } from "@/components/staff-notice-form";

export default async function NewStaffNoticePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const feedback = await searchParams;
  return <><Link className="staff-back" href="/staff/notices">← Back to notice management</Link><header className="staff-page-header staff-notice-editor-header"><div><p className="eyebrow">Communication</p><h1>Create notice</h1><p>Prepare a school update for review, scheduling or publication.</p></div></header>{feedback.error && <p className="staff-feedback" role="status">We could not save this notice. Please review the dates and required fields.</p>}<StaffNoticeForm /></>;
}
