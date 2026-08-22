import "server-only";

import { z } from "zod";

import { admissionClasses } from "@/lib/admissions/schema";
import { requireStaff } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";

export const admissionStatuses = ["new", "contacted", "follow_up", "admitted", "closed"] as const;
export const admissionStatusSchema = z.enum(admissionStatuses);
export type AdmissionStatus = z.infer<typeof admissionStatusSchema>;

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

export async function listAdmissions(filters: { classSeeking?: string; status?: string }) {
  await requireStaff();
  const supabase = await createClient();
  let query = supabase
    .from("admission_enquiries")
    .select("id, student_name, guardian_name, class_seeking, phone_number, email_address, status, created_at")
    .order("created_at", { ascending: false });

  if (filters.status && admissionStatusSchema.safeParse(filters.status).success) query = query.eq("status", filters.status);
  if (filters.classSeeking && (admissionClasses as readonly string[]).includes(filters.classSeeking)) query = query.eq("class_seeking", filters.classSeeking);

  const { data, error } = await query;
  if (error) {
    console.error("Staff admissions list failed.", { category: "database-query", code: error.code });
    return [];
  }

  return data as StaffAdmission[];
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
