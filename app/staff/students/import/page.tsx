import { StudentBulkImportWorkspace } from "@/components/student-bulk-import-workspace";
import { requireAdmin } from "@/lib/staff/auth";
import { studentFormData } from "@/lib/students";

export default async function Page() {
  await requireAdmin();
  const academicData = await studentFormData();
  return <StudentBulkImportWorkspace {...academicData} />;
}
