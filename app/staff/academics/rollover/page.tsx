import Link from "next/link";

import { AcademicYearRolloverWorkspace } from "@/components/academic-year-rollover-workspace";
import { getAcademicYearRolloverWorkspaceData } from "@/lib/academic-year-rollover";

export default async function Page() {
  const data = await getAcademicYearRolloverWorkspaceData();

  return <main className="rollover-page">
    <Link className="staff-back" href="/staff/academics/years">← Academic years</Link>
    <AcademicYearRolloverWorkspace data={data} />
  </main>;
}
