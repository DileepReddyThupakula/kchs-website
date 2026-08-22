import "server-only";

import { z } from "zod";

import { requireStaff } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";
import { facultyDepartments, facultyDepartmentLabels, type FacultyDepartment } from "@/lib/faculty-shared";

export const facultyDepartmentSchema = z.enum(facultyDepartments);
export { facultyDepartments, facultyDepartmentLabels, type FacultyDepartment } from "@/lib/faculty-shared";
export type FacultyStatus = "active" | "archived";
export type FacultyMember = { id: string; full_name: string; designation: string; department: FacultyDepartment; qualification: string | null; bio: string | null; photo_path: string | null; display_order: number; is_public: boolean; status: FacultyStatus; created_at: string; updated_at: string; signed_url?: string | null };
const fields = "id,full_name,designation,department,qualification,bio,photo_path,display_order,is_public,status,created_at,updated_at";
const withUrls = async (members: FacultyMember[]) => { if (!members.length) return members; const supabase = await createClient(); const paths = members.flatMap((member) => member.photo_path ? [member.photo_path] : []); if (!paths.length) return members; const { data } = await supabase.storage.from("faculty-photos").createSignedUrls(paths, 3600); const urls = new Map((data ?? []).map((item, index) => [paths[index], item.signedUrl])); return members.map((member) => ({ ...member, signed_url: member.photo_path ? urls.get(member.photo_path) ?? null : null })); };
const escape = (value: string) => value.replace(/[%,_]/g, "\\$&");

export async function getStaffFaculty(filters: { q?: string; department?: string; status?: string }) { await requireStaff(); const supabase = await createClient(); let query = supabase.from("faculty_members").select(fields).order("display_order").order("full_name").limit(100); const q = filters.q?.trim().slice(0, 100); const department = facultyDepartmentSchema.safeParse(filters.department); const status = z.enum(["active", "archived"]).safeParse(filters.status); if (q) query = query.or(`full_name.ilike.%${escape(q)}%,designation.ilike.%${escape(q)}%`); if (department.success) query = query.eq("department", department.data); if (status.success) query = query.eq("status", status.data); const { data, error } = await query; return { members: await withUrls((data ?? []) as FacultyMember[]), failed: Boolean(error) }; }
export async function getStaffFacultyMember(id: string) { await requireStaff(); if (!z.string().uuid().safeParse(id).success) return null; const supabase = await createClient(); const { data } = await supabase.from("faculty_members").select(fields).eq("id", id).maybeSingle(); return data ? (await withUrls([data as FacultyMember]))[0] : null; }
export async function getPublicFaculty() { const supabase = await createClient(); const { data } = await supabase.from("faculty_members").select(fields).eq("status", "active").eq("is_public", true).order("display_order").order("full_name").limit(80); return withUrls((data ?? []) as FacultyMember[]); }
export async function getStaffFacultyOverview() { await requireStaff(); const supabase = await createClient(); const [active, publicCount, latest] = await Promise.all([supabase.from("faculty_members").select("id", { count: "exact", head: true }).eq("status", "active"), supabase.from("faculty_members").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_public", true), supabase.from("faculty_members").select("id,full_name").order("updated_at", { ascending: false }).limit(1).maybeSingle()]); return { active: active.count ?? 0, public: publicCount.count ?? 0, latest: latest.data as { id: string; full_name: string } | null }; }
