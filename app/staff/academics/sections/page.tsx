import Link from "next/link";
import { AcademicManagement } from "@/components/academic-management";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <Link className="staff-back" href="/staff/academics">
        ← Academic structure
      </Link>
      {params.created === "1" && (
        <p className="academic-feedback academic-feedback-success" role="status">
          Section created successfully.
        </p>
      )}
      {params.error === "save" && (
        <p className="academic-feedback academic-feedback-error" role="alert">
          Could not save section. Please try again.
        </p>
      )}
      <AcademicManagement view="sections" />
    </>
  );
}
