import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";

export const attendanceStatuses = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export type AttendanceConfiguration = {
  years: { id: string; label: string; start_date: string; end_date: string; status: "planning" | "current" | "closed" }[];
  classes: { id: string; name: string; active: boolean }[];
  sections: { id: string; name: string; academic_year_id: string; class_id: string; active: boolean }[];
};

export type AttendanceRosterRow = {
  attendance_record_id: string | null;
  student_enrollment_id: string;
  student_id: string;
  admission_number: string;
  full_name: string;
  status: AttendanceStatus;
  remark: string | null;
};

export type AttendanceRoster = {
  session_id: string | null;
  state: "open" | "locked";
  revision: number;
  rows: AttendanceRosterRow[];
};

export type AttendanceSelection = {
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  attendanceDate?: string;
};

const uuid = z.string().uuid();
const date = z.string().date();
const rosterSchema = z.object({
  session_id: z.string().uuid().nullable(),
  state: z.enum(["open", "locked"]),
  revision: z.number().int().nonnegative(),
  rows: z.array(z.object({
    attendance_record_id: z.string().uuid().nullable(),
    student_enrollment_id: z.string().uuid(),
    student_id: z.string().uuid(),
    admission_number: z.string(),
    full_name: z.string(),
    status: z.enum(attendanceStatuses),
    remark: z.string().nullable(),
  })),
});

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function logAttendanceFailure(operation: string, error: { code?: string; message?: string; details?: string; hint?: string }) {
  console.error("Student attendance data request failed.", {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export function parseAttendanceSelection(params: { year?: string; class?: string; section?: string; date?: string }): AttendanceSelection {
  return {
    academicYearId: uuid.safeParse(params.year).success ? params.year : undefined,
    classId: uuid.safeParse(params.class).success ? params.class : undefined,
    sectionId: uuid.safeParse(params.section).success ? params.section : undefined,
    attendanceDate: date.safeParse(params.date).success ? params.date : undefined,
  };
}

export async function getAttendanceWorkspace(selection: AttendanceSelection) {
  await requireAdmin();
  const supabase = await createClient();
  const [yearsResult, classesResult, sectionsResult] = await Promise.all([
    supabase.from("academic_years").select("id,label,start_date,end_date,status").in("status", ["planning", "current"]).order("start_date", { ascending: false }).limit(30),
    supabase.from("school_classes").select("id,name,active").eq("active", true).order("display_order").limit(30),
    supabase.from("academic_sections").select("id,name,academic_year_id,class_id,active").eq("active", true).order("name").limit(300),
  ]);
  const configurationError = yearsResult.error ?? classesResult.error ?? sectionsResult.error;
  if (configurationError) {
    logAttendanceFailure("getAttendanceWorkspace.configuration", configurationError);
    throw new Error("Attendance configuration is temporarily unavailable.");
  }

  const configuration: AttendanceConfiguration = {
    years: yearsResult.data as AttendanceConfiguration["years"],
    classes: classesResult.data as AttendanceConfiguration["classes"],
    sections: sectionsResult.data as AttendanceConfiguration["sections"],
  };
  const fallbackYear = configuration.years.find((year) => year.status === "current") ?? configuration.years[0];
  const academicYearId = selection.academicYearId && configuration.years.some((year) => year.id === selection.academicYearId)
    ? selection.academicYearId
    : fallbackYear?.id;
  const classesForYear = academicYearId
    ? new Set(configuration.sections.filter((section) => section.academic_year_id === academicYearId).map((section) => section.class_id))
    : new Set<string>();
  const fallbackClass = configuration.classes.find((item) => classesForYear.has(item.id));
  const classId = selection.classId && configuration.classes.some((item) => item.id === selection.classId && classesForYear.has(item.id))
    ? selection.classId
    : fallbackClass?.id;
  const fallbackSection = configuration.sections.find((section) => section.academic_year_id === academicYearId && section.class_id === classId);
  const sectionId = selection.sectionId && configuration.sections.some((section) => section.id === selection.sectionId && section.academic_year_id === academicYearId && section.class_id === classId)
    ? selection.sectionId
    : fallbackSection?.id;
  const attendanceDate = selection.attendanceDate ?? todayInIndia();
  const resolved = { academicYearId, classId, sectionId, attendanceDate };

  if (!academicYearId || !classId || !sectionId) return { configuration, resolved, roster: null as AttendanceRoster | null };

  const { data, error } = await supabase.rpc("get_student_attendance_roster", {
    p_academic_year_id: academicYearId,
    p_class_id: classId,
    p_academic_section_id: sectionId,
    p_attendance_date: attendanceDate,
  });
  if (error) {
    logAttendanceFailure("getAttendanceWorkspace.roster", error);
    return { configuration, resolved, roster: null as AttendanceRoster | null, rosterError: "Attendance could not be loaded for this selection." };
  }
  const parsed = rosterSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Student attendance roster response was invalid.", { operation: "getAttendanceWorkspace.roster", issueCount: parsed.error.issues.length });
    return { configuration, resolved, roster: null as AttendanceRoster | null, rosterError: "Attendance could not be loaded for this selection." };
  }
  return { configuration, resolved, roster: parsed.data as AttendanceRoster, rosterError: undefined };
}
