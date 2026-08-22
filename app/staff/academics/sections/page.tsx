import Link from "next/link";
import { AcademicFeedback, AcademicManagement } from "@/components/academic-management";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <Link className="staff-back" href="/staff/academics">
        ← Academic structure
      </Link>
      <AcademicFeedback feedback={params} successMessage={params.updated === "1" ? "Section updated successfully." : "Section created successfully."} />
      <AcademicManagement view="sections" />
    </>
  );
}
