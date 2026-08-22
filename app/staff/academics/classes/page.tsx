import Link from "next/link";

import { AcademicFeedback, AcademicManagement } from "@/components/academic-management";

export default async function Page({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const feedback = await searchParams;
  return <><Link className="staff-back" href="/staff/academics">← Academic structure</Link><AcademicFeedback feedback={feedback} successMessage="Class status updated successfully." /><AcademicManagement view="classes" /></>;
}
