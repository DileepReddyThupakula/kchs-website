import { StudentAttendanceWorkspace } from "@/components/student-attendance-workspace";
import { getAttendanceWorkspace, parseAttendanceSelection } from "@/lib/student-attendance";

export default async function StaffAttendancePage({ searchParams }: { searchParams: Promise<{ year?: string; class?: string; section?: string; date?: string }> }) {
  const params = await searchParams;
  const workspace = await getAttendanceWorkspace(parseAttendanceSelection(params));
  return <StudentAttendanceWorkspace {...workspace} />;
}
