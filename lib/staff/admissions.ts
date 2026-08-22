import "server-only";

import { z } from "zod";

import { admissionClasses } from "@/lib/admissions/schema";
import { requireStaff } from "@/lib/staff/auth";
import { logStaffPerformance } from "@/lib/staff/performance";
import { createClient } from "@/lib/supabase/server";

export const admissionStatuses = ["new", "contacted", "follow_up", "admitted", "closed"] as const;
export const admissionStatusSchema = z.enum(admissionStatuses);
export type AdmissionStatus = z.infer<typeof admissionStatusSchema>;
export const admissionStatusLabels: Record<AdmissionStatus, string> = { new: "New", contacted: "Contacted", follow_up: "Follow-up", admitted: "Admitted", closed: "Closed" };

export type StaffAdmission = {
  class_seeking: string;
  created_at: string;
  email_address: string | null;
  guardian_name: string;
  id: string;
  phone_number: string;
  status: AdmissionStatus;
  student_name: string;
};

export type StaffAdmissionDetail = StaffAdmission & {
  message: string | null;
  staff_notes: string | null;
  updated_at: string;
};

export type AdmissionsFilters = { classSeeking?: string; search?: string; status?: string };

export type AdmissionsDashboard = {
  admissions: StaffAdmission[];
  filtersActive: boolean;
  summary: Record<AdmissionStatus, number> & { total: number };
};

function isValidClass(value: string | undefined) {
  return Boolean(value && (admissionClasses as readonly string[]).includes(value));
}

function normaliseSearch(value: string | undefined) {
  return value?.trim().slice(0, 120).toLocaleLowerCase("en-IN") ?? "";
}

function matchesSearch(admission: StaffAdmission, search: string) {
  if (!search) return true;

  return [admission.student_name, admission.guardian_name, admission.phone_number, admission.email_address ?? ""]
    .some((value) => value.toLocaleLowerCase("en-IN").includes(search));
}

export function formatAdmissionDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export function formatAdmissionTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export async function getAdmissionsDashboard(filters: AdmissionsFilters): Promise<AdmissionsDashboard> {
  await requireStaff();
  const supabase = await createClient();
  const queryStartedAt = performance.now();
  const { data, error } = await supabase
    .from("admission_enquiries")
    .select("id, student_name, guardian_name, class_seeking, phone_number, email_address, status, created_at")
    .order("created_at", { ascending: false });
  logStaffPerformance("staff-admissions-query", queryStartedAt, error ? "failed" : "success");
  if (error || !data) {
    console.error("Staff admissions list failed.", { category: "database-query", code: error?.code });
    return { admissions: [], filtersActive: false, summary: { total: 0, new: 0, contacted: 0, follow_up: 0, admitted: 0, closed: 0 } };
  }

  const allAdmissions = data as StaffAdmission[];
  const validStatus = admissionStatusSchema.safeParse(filters.status).success ? filters.status as AdmissionStatus : undefined;
  const validClass = isValidClass(filters.classSeeking) ? filters.classSeeking : undefined;
  const search = normaliseSearch(filters.search);
  const admissions = allAdmissions.filter((admission) =>
    (!validStatus || admission.status === validStatus) &&
    (!validClass || admission.class_seeking === validClass) &&
    matchesSearch(admission, search),
  );
  const summary = allAdmissions.reduce<Record<AdmissionStatus, number> & { total: number }>((counts, admission) => {
    counts.total += 1;
    counts[admission.status] += 1;
    return counts;
  }, { total: 0, new: 0, contacted: 0, follow_up: 0, admitted: 0, closed: 0 });

  return { admissions, filtersActive: Boolean(validStatus || validClass || search), summary };
}

export async function getAdmission(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admission_enquiries")
    .select("id, student_name, guardian_name, class_seeking, phone_number, email_address, message, status, staff_notes, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("Staff admission detail failed.", { category: "database-query", code: error.code });
  return data as StaffAdmissionDetail | null;
}
