import Link from "next/link";

import { AcademicFeedback, AcademicManagement } from "@/components/academic-management";

export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; error?: string }> }) {
  const feedback = await searchParams;
  return <><Link className="staff-back" href="/staff/academics">← Academic structure</Link><AcademicFeedback feedback={feedback} successMessage={feedback.updated === "1" ? "Subject assignment updated successfully." : "Subject assignment saved successfully."} /><AcademicManagement view="assignments" /></>;
}
