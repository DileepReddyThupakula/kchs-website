import "server-only";

import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";

type AttendanceSession = { academic_section_id: string; class_id: string; id: string; state: "locked" | "open" };
type AttendanceRecord = { attendance_session_id: string; status: "absent" | "excused" | "late" | "present" };
type AcademicYear = { id: string; label: string };
type SchoolClass = { id: string; name: string };
type AcademicSection = { class_id: string; id: string; name: string };

export type AdminDashboardOverview = {
  attendance: { date: string; failed: boolean; rows: { absent: number; className: string; present: number; sectionName: string; state: "locked" | "open" }[] };
  currentAcademicYear: string | null;
  events: { event_type: string; id: string; start_at: string; title: string }[];
  metrics: { classes: number | null; staff: number | null; students: number | null };
  notices: { id: string; published_at: string | null; title: string; updated_at: string }[];
};

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "Asia/Kolkata", year: "numeric" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function logDashboardError(operation: string, error: { code?: string } | null) {
  if (error) console.error("Admin dashboard query failed.", { operation, category: "database-query", code: error.code });
}

export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  await requireAdmin();
  const supabase = await createClient();
  const date = todayInIndia();
  const [students, staff, classes, currentYear, sessions, notices, events] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("staff_members").select("id", { count: "exact", head: true }),
    supabase.from("school_classes").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("academic_years").select("id,label").eq("status", "current").maybeSingle(),
    supabase.from("student_attendance_sessions").select("id,class_id,academic_section_id,state").eq("attendance_date", date).order("created_at").limit(120),
    supabase.from("notices").select("id,title,published_at,updated_at").eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).limit(3),
    supabase.from("events").select("id,title,event_type,start_at").eq("status", "published").gte("start_at", new Date().toISOString()).order("start_at").limit(3),
  ]);

  logDashboardError("students", students.error);
  logDashboardError("staff", staff.error);
  logDashboardError("classes", classes.error);
  logDashboardError("current-year", currentYear.error);
  logDashboardError("attendance-sessions", sessions.error);
  logDashboardError("notices", notices.error);
  logDashboardError("events", events.error);

  const attendanceSessions = (sessions.data ?? []) as AttendanceSession[];
  const sessionIds = attendanceSessions.map((session) => session.id);
  let records: AttendanceRecord[] = [];
  let attendanceFailed = Boolean(sessions.error);
  let classesById = new Map<string, string>();
  let sectionsById = new Map<string, string>();

  if (sessionIds.length) {
    const [recordsResult, classesResult, sectionsResult] = await Promise.all([
      supabase.from("student_attendance_records").select("attendance_session_id,status").in("attendance_session_id", sessionIds).limit(5000),
      supabase.from("school_classes").select("id,name").in("id", [...new Set(attendanceSessions.map((session) => session.class_id))]),
      supabase.from("academic_sections").select("id,name,class_id").in("id", [...new Set(attendanceSessions.map((session) => session.academic_section_id))]),
    ]);
    logDashboardError("attendance-records", recordsResult.error);
    logDashboardError("attendance-classes", classesResult.error);
    logDashboardError("attendance-sections", sectionsResult.error);
    attendanceFailed ||= Boolean(recordsResult.error ?? classesResult.error ?? sectionsResult.error);
    records = (recordsResult.data ?? []) as AttendanceRecord[];
    classesById = new Map(((classesResult.data ?? []) as SchoolClass[]).map((item) => [item.id, item.name]));
    sectionsById = new Map(((sectionsResult.data ?? []) as AcademicSection[]).map((item) => [item.id, item.name]));
  }

  return {
    attendance: {
      date,
      failed: attendanceFailed,
      rows: attendanceSessions.map((session) => {
        const sessionRecords = records.filter((record) => record.attendance_session_id === session.id);
        return { absent: sessionRecords.filter((record) => record.status === "absent").length, className: classesById.get(session.class_id) ?? "Class", present: sessionRecords.filter((record) => record.status === "present").length, sectionName: sectionsById.get(session.academic_section_id) ?? "Section", state: session.state };
      }),
    },
    currentAcademicYear: (currentYear.data as AcademicYear | null)?.label ?? null,
    events: events.error ? [] : events.data ?? [],
    metrics: { classes: classes.error ? null : classes.count ?? 0, staff: staff.error ? null : staff.count ?? 0, students: students.error ? null : students.count ?? 0 },
    notices: notices.error ? [] : notices.data ?? [],
  };
}

export function formatDashboardDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata", weekday: "long", year: "numeric" }).format(new Date(`${value}T00:00:00+05:30`)); }
export function formatDashboardEventDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
