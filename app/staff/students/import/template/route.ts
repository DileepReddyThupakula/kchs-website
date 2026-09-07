import { getCurrentStaff } from "@/lib/staff/auth";
import { studentImportTemplate } from "@/lib/student-import";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) return new Response("Unauthorized", { status: 401 });
  if (staff.role !== "admin") return new Response("Forbidden", { status: 403 });

  return new Response(studentImportTemplate(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="kchs-student-import-template.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
