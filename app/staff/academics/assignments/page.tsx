import Link from "next/link";

import { AcademicFeedback, AcademicManagement } from "@/components/academic-management";

export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const feedback = await searchParams;
  return <><Link className="staff-back" href="/staff/academics">← Academic structure</Link><AcademicFeedback feedback={feedback} successMessage="Subject assignment saved successfully." /><AcademicManagement view="assignments" /></>;
}
