import "server-only";

import { z } from "zod";
import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";
import { employmentStatuses, employmentStatusLabels, staffTypes, staffTypeLabels } from "@/lib/staff-members-shared";

export const staffTypeSchema = z.enum(staffTypes);
export const employmentStatusSchema = z.enum(employmentStatuses);
export { employmentStatuses, employmentStatusLabels, staffTypes, staffTypeLabels } from "@/lib/staff-members-shared";
export type StaffMember = { id: string; employee_code: string; full_name: string; staff_type: (typeof staffTypes)[number]; designation: string; employment_status: (typeof employmentStatuses)[number]; phone: string | null; email: string | null; joining_date: string | null; auth_user_id: string | null; created_at: string; updated_at: string };
const fields = "id,employee_code,full_name,staff_type,designation,employment_status,phone,email,joining_date,auth_user_id,created_at,updated_at";
const escape = (value: string) => value.replace(/[%,_]/g, "\\$&");

export async function getStaffMembers(filters: { q?: string; type?: string; status?: string }) { await requireAdmin(); const supabase = await createClient(); let query = supabase.from("staff_members").select(fields).order("full_name").limit(100); const q = filters.q?.trim().slice(0, 100); const type = staffTypeSchema.safeParse(filters.type); const status = employmentStatusSchema.safeParse(filters.status); if (q) query = query.or(`full_name.ilike.%${escape(q)}%,employee_code.ilike.%${escape(q)}%,designation.ilike.%${escape(q)}%`); if (type.success) query = query.eq("staff_type", type.data); if (status.success) query = query.eq("employment_status", status.data); const { data, error } = await query; return { members: (data ?? []) as StaffMember[], failed: Boolean(error) }; }
export async function getStaffMember(id: string) { await requireAdmin(); if (!z.string().uuid().safeParse(id).success) return null; const { data } = await (await createClient()).from("staff_members").select(fields).eq("id", id).maybeSingle(); return data as StaffMember | null; }
export async function getStaffMembersOverview() { await requireAdmin(); const supabase = await createClient(); const [active, teachers, nonTeaching] = await Promise.all([supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("employment_status", "active"), supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("employment_status", "active").eq("staff_type", "teacher"), supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("employment_status", "active").eq("staff_type", "non_teaching")]); return { active: active.count ?? 0, teachers: teachers.count ?? 0, nonTeaching: nonTeaching.count ?? 0 }; }
