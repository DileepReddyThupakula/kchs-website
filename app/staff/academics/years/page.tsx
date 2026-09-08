import Link from "next/link";

import { AcademicFeedback, AcademicManagement } from "@/components/academic-management";

export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; error?: string }> }) {
  const feedback = await searchParams;
  return <><Link className="staff-back" href="/staff/academics">← Academic structure</Link><div className="academic-year-discovery"><div><p className="academic-kicker">Next operation</p><strong>Ready to plan progression?</strong><span>Review every active enrollment before closing the current year.</span></div><Link className="rollover-secondary-button" href="/staff/academics/rollover">Open rollover workspace →</Link></div><AcademicFeedback feedback={feedback} successMessage={feedback.updated === "1" ? "Academic year updated successfully." : "Academic year saved successfully."} /><AcademicManagement view="years" /></>;
}
