"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { attendanceStatuses } from "@/lib/student-attendance";
import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const date = z.string().date();
const revision = z.coerce.number().int().nonnegative();
const records = z.array(z.object({
  enrollment_id: z.string().uuid(),
  status: z.enum(attendanceStatuses),
  remark: z.string().trim().max(500).optional(),
})).min(1);
const reason = z.string().trim().max(1000).optional();

export type AttendanceActionState = {
  kind: "idle" | "success" | "error" | "stale" | "locked";
  message?: string;
  revision?: number;
  state?: "open" | "locked";
  sessionId?: string;
};

export const initialAttendanceActionState: AttendanceActionState = { kind: "idle" };

function failure(operation: string, error: { code?: string; message?: string; details?: string; hint?: string }): AttendanceActionState {
  console.error("Student attendance operation failed.", { operation, code: error.code, message: error.message, details: error.details, hint: error.hint });
  if (error.code === "40001") return { kind: "stale", message: "Attendance was changed by another administrator. Reload the roster before continuing." };
  if (error.code === "23514") return { kind: "locked", message: "This attendance session cannot be changed. Reload the roster and try again." };
  return { kind: "error", message: "Attendance could not be saved. Please try again." };
}

function baseFormData(formData: FormData) {
  const parsed = z.object({
    academic_year_id: uuid,
    class_id: uuid,
    academic_section_id: uuid,
    attendance_date: date,
    expected_revision: revision,
  }).safeParse(Object.fromEntries(formData));
  return parsed;
}

function parseRecords(formData: FormData) {
  const raw = formData.get("records");
  if (typeof raw !== "string") return null;
  try { return records.safeParse(JSON.parse(raw)); } catch { return null; }
}

export async function saveStudentAttendance(_previousState: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  await requireAdmin();
  const base = baseFormData(formData);
  const submittedRecords = parseRecords(formData);
  const correctionReason = reason.safeParse(formData.get("correction_reason") ?? "");
  if (!base.success || !submittedRecords?.success || !correctionReason.success) return { kind: "error", message: "Review the attendance selection and roster before saving." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_student_attendance", {
    p_academic_year_id: base.data.academic_year_id,
    p_class_id: base.data.class_id,
    p_academic_section_id: base.data.academic_section_id,
    p_attendance_date: base.data.attendance_date,
    p_expected_revision: base.data.expected_revision,
    p_records: submittedRecords.data,
    p_correction_reason: correctionReason.data || null,
  });
  if (error) return failure("saveStudentAttendance", error);
  const result = z.object({ session_id: uuid, state: z.enum(["open", "locked"]), revision: z.number().int().nonnegative() }).safeParse(data);
  if (!result.success) return { kind: "error", message: "Attendance was saved, but the current session could not be confirmed. Reload the roster." };
  revalidatePath("/staff/attendance");
  return { kind: "success", message: "Attendance saved successfully.", sessionId: result.data.session_id, state: result.data.state, revision: result.data.revision };
}

function sessionFormData(formData: FormData) {
  return z.object({ session_id: uuid, expected_revision: revision }).safeParse(Object.fromEntries(formData));
}

export async function lockStudentAttendance(_previousState: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  await requireAdmin();
  const parsed = sessionFormData(formData);
  if (!parsed.success) return { kind: "error", message: "Attendance could not be locked. Reload the roster and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lock_student_attendance_session", { p_session_id: parsed.data.session_id, p_expected_revision: parsed.data.expected_revision });
  if (error) return failure("lockStudentAttendance", error);
  const result = z.object({ session_id: uuid, state: z.literal("locked"), revision: z.number().int().nonnegative() }).safeParse(data);
  if (!result.success) return { kind: "error", message: "Attendance was locked, but the current session could not be confirmed. Reload the roster." };
  revalidatePath("/staff/attendance");
  return { kind: "success", message: "Attendance session locked.", sessionId: result.data.session_id, state: result.data.state, revision: result.data.revision };
}

export async function unlockStudentAttendance(_previousState: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  await requireAdmin();
  const parsed = sessionFormData(formData);
  const unlockReason = reason.safeParse(formData.get("unlock_reason") ?? "");
  if (!parsed.success || !unlockReason.success || !unlockReason.data) return { kind: "error", message: "Enter a reason before unlocking attendance." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlock_student_attendance_session", { p_session_id: parsed.data.session_id, p_expected_revision: parsed.data.expected_revision, p_reason: unlockReason.data });
  if (error) return failure("unlockStudentAttendance", error);
  const result = z.object({ session_id: uuid, state: z.literal("open"), revision: z.number().int().nonnegative() }).safeParse(data);
  if (!result.success) return { kind: "error", message: "Attendance was unlocked, but the current session could not be confirmed. Reload the roster." };
  revalidatePath("/staff/attendance");
  return { kind: "success", message: "Attendance session unlocked.", sessionId: result.data.session_id, state: result.data.state, revision: result.data.revision };
}
