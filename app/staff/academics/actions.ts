"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const classRoutePattern = /^\/staff\/academics\/classes\/[0-9a-f-]{36}$/i;

function revalidateAcademicPaths(extraPath?: string) {
  revalidatePath("/staff");
  revalidatePath("/staff/academics");
  revalidatePath("/staff/academics/years");
  revalidatePath("/staff/academics/classes");
  revalidatePath("/staff/academics/sections");
  revalidatePath("/staff/academics/subjects");
  revalidatePath("/staff/academics/assignments");
  if (extraPath) revalidatePath(extraPath);
}

function sectionReturnPath(value: FormDataEntryValue | null) {
  return typeof value === "string" && classRoutePattern.test(value)
    ? value
    : "/staff/academics/sections";
}

function recordEditPath(kind: "years" | "sections" | "subjects" | "assignments", id: string) {
  return `/staff/academics/${kind}/${id}/edit`;
}

function updateErrorPath(kind: "years" | "sections" | "subjects" | "assignments", id: string, error: { code?: string | null }) {
  if (error.code === "23505") {
    const message = kind === "sections" ? "duplicate-section" : kind === "assignments" ? "duplicate-assignment" : kind === "years" ? "current-exists" : "duplicate-subject";
    return `${recordEditPath(kind, id)}?error=${message}`;
  }
  return `${recordEditPath(kind, id)}?error=save`;
}

async function requireExistingRecord(table: "academic_years" | "academic_sections" | "subjects" | "section_subject_assignments", id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  return { supabase, exists: Boolean(data) };
}

export async function saveYear(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({
    label: z.string().trim().min(4).max(30),
    start_date: z.string().date(),
    end_date: z.string().date(),
    status: z.enum(["planning", "current", "closed"]),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success || parsed.data.end_date <= parsed.data.start_date) redirect("/staff/academics/years?error=invalid");
  const supabase = await createClient();
  if (parsed.data.status === "current") await supabase.from("academic_years").update({ status: "planning" }).eq("status", "current");
  const { error } = await supabase.from("academic_years").insert(parsed.data);
  if (error) redirect("/staff/academics/years?error=save");
  revalidateAcademicPaths();
  redirect("/staff/academics/years?created=1");
}

export async function updateYear(formData: FormData) {
  await requireAdmin();
  const rawId = uuid.safeParse(formData.get("id"));
  const parsed = z.object({
    id: uuid,
    label: z.string().trim().min(4).max(30),
    start_date: z.string().date(),
    end_date: z.string().date(),
    status: z.enum(["planning", "current", "closed"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.end_date <= parsed.data.start_date) redirect(rawId.success ? `${recordEditPath("years", rawId.data)}?error=invalid` : "/staff/academics/years?error=invalid");
  const { supabase, exists } = await requireExistingRecord("academic_years", parsed.data.id);
  if (!exists) redirect("/staff/academics/years?error=notfound");
  const { error } = await supabase.from("academic_years").update({
    label: parsed.data.label,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    status: parsed.data.status,
  }).eq("id", parsed.data.id);
  if (error) redirect(updateErrorPath("years", parsed.data.id, error));
  revalidateAcademicPaths();
  redirect("/staff/academics/years?updated=1");
}

export async function saveSection(formData: FormData) {
  await requireAdmin();
  const returnPath = sectionReturnPath(formData.get("return_to"));
  const parsed = z.object({
    academic_year_id: uuid,
    class_id: uuid,
    name: z.string().trim().min(1).max(20),
    class_teacher_id: z.union([uuid, z.literal("")]),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) redirect(`${returnPath}?error=invalid`);
  const { error } = await (await createClient()).from("academic_sections").insert({
    ...parsed.data,
    class_teacher_id: parsed.data.class_teacher_id || null,
  });
  if (error) {
    console.error("Academic section creation failed.", {
      operation: "createAcademicSection",
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    redirect(`${returnPath}?error=save`);
  }
  revalidateAcademicPaths(returnPath);
  redirect(`${returnPath}?created=1`);
}

export async function updateSection(formData: FormData) {
  await requireAdmin();
  const rawId = uuid.safeParse(formData.get("id"));
  const parsed = z.object({
    id: uuid,
    academic_year_id: uuid,
    class_id: uuid,
    name: z.string().trim().min(1).max(20),
    class_teacher_id: z.union([uuid, z.literal("")]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(rawId.success ? `${recordEditPath("sections", rawId.data)}?error=invalid` : "/staff/academics/sections?error=invalid");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("academic_sections").select("id,class_id").eq("id", parsed.data.id).maybeSingle();
  if (!existing) redirect("/staff/academics/sections?error=notfound");
  const { error } = await supabase.from("academic_sections").update({
    academic_year_id: parsed.data.academic_year_id,
    class_id: parsed.data.class_id,
    name: parsed.data.name,
    class_teacher_id: parsed.data.class_teacher_id || null,
  }).eq("id", parsed.data.id);
  if (error) {
    console.error("Academic section update failed.", { operation: "updateAcademicSection", code: error.code, message: error.message, details: error.details, hint: error.hint });
    redirect(updateErrorPath("sections", parsed.data.id, error));
  }
  revalidateAcademicPaths(`/staff/academics/classes/${existing.class_id}`);
  revalidatePath(`/staff/academics/classes/${parsed.data.class_id}`);
  redirect("/staff/academics/sections?updated=1");
}

export async function saveSubject(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(1).max(100),
    code: z.string().trim().max(20),
    display_order: z.coerce.number().int().min(0).max(10000),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/staff/academics/subjects?error=invalid");
  const { error } = await (await createClient()).from("subjects").insert({ ...parsed.data, code: parsed.data.code || null });
  if (error) redirect("/staff/academics/subjects?error=save");
  revalidateAcademicPaths();
  redirect("/staff/academics/subjects?created=1");
}

export async function updateSubject(formData: FormData) {
  await requireAdmin();
  const rawId = uuid.safeParse(formData.get("id"));
  const parsed = z.object({
    id: uuid,
    name: z.string().trim().min(1).max(100),
    code: z.string().trim().max(20),
    display_order: z.coerce.number().int().min(0).max(10000),
    active: z.enum(["true", "false"]).transform((value) => value === "true"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(rawId.success ? `${recordEditPath("subjects", rawId.data)}?error=invalid` : "/staff/academics/subjects?error=invalid");
  const { supabase, exists } = await requireExistingRecord("subjects", parsed.data.id);
  if (!exists) redirect("/staff/academics/subjects?error=notfound");
  const { error } = await supabase.from("subjects").update({
    name: parsed.data.name,
    code: parsed.data.code || null,
    display_order: parsed.data.display_order,
    active: parsed.data.active,
  }).eq("id", parsed.data.id);
  if (error) redirect(updateErrorPath("subjects", parsed.data.id, error));
  revalidateAcademicPaths();
  redirect("/staff/academics/subjects?updated=1");
}

export async function toggleSubject(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: uuid, active: z.enum(["true", "false"]).transform((value) => value === "true") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/staff/academics/subjects?error=invalid");
  const { supabase, exists } = await requireExistingRecord("subjects", parsed.data.id);
  if (!exists) redirect("/staff/academics/subjects?error=notfound");
  const { error } = await supabase.from("subjects").update({ active: parsed.data.active }).eq("id", parsed.data.id);
  if (error) redirect("/staff/academics/subjects?error=save");
  revalidateAcademicPaths();
  redirect("/staff/academics/subjects?updated=1");
}

export async function saveAssignment(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({
    academic_section_id: uuid,
    subject_id: uuid,
    teacher_id: z.union([uuid, z.literal("")]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/staff/academics/assignments?error=invalid");
  const { error } = await (await createClient()).from("section_subject_assignments").insert({
    ...parsed.data,
    teacher_id: parsed.data.teacher_id || null,
  });
  if (error) redirect("/staff/academics/assignments?error=save");
  revalidateAcademicPaths();
  redirect("/staff/academics/assignments?created=1");
}

export async function updateAssignment(formData: FormData) {
  await requireAdmin();
  const rawId = uuid.safeParse(formData.get("id"));
  const parsed = z.object({
    id: uuid,
    academic_section_id: uuid,
    subject_id: uuid,
    teacher_id: z.union([uuid, z.literal("")]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(rawId.success ? `${recordEditPath("assignments", rawId.data)}?error=invalid` : "/staff/academics/assignments?error=invalid");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("section_subject_assignments").select("id,academic_section_id").eq("id", parsed.data.id).maybeSingle();
  if (!existing) redirect("/staff/academics/assignments?error=notfound");
  const { data: targetSection } = await supabase.from("academic_sections").select("class_id").eq("id", parsed.data.academic_section_id).maybeSingle();
  if (!targetSection) redirect(`${recordEditPath("assignments", parsed.data.id)}?error=invalid`);
  const { data: oldSection } = await supabase.from("academic_sections").select("class_id").eq("id", existing.academic_section_id).maybeSingle();
  const { error } = await supabase.from("section_subject_assignments").update({
    academic_section_id: parsed.data.academic_section_id,
    subject_id: parsed.data.subject_id,
    teacher_id: parsed.data.teacher_id || null,
  }).eq("id", parsed.data.id);
  if (error) {
    console.error("Academic assignment update failed.", { operation: "updateAcademicAssignment", code: error.code, message: error.message, details: error.details, hint: error.hint });
    redirect(updateErrorPath("assignments", parsed.data.id, error));
  }
  revalidateAcademicPaths(`/staff/academics/classes/${targetSection.class_id}`);
  if (oldSection) revalidatePath(`/staff/academics/classes/${oldSection.class_id}`);
  redirect("/staff/academics/assignments?updated=1");
}

export async function toggleClass(formData: FormData) {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success) redirect("/staff/academics/classes?error=invalid");
  const supabase = await createClient();
  if (!active) {
    const { data: activeSection } = await supabase.from("academic_sections").select("id").eq("class_id", id.data).eq("active", true).limit(1).maybeSingle();
    if (activeSection) redirect("/staff/academics/classes?error=has-sections");
  }
  const { error } = await supabase.from("school_classes").update({ active }).eq("id", id.data);
  if (error) redirect("/staff/academics/classes?error=save");
  revalidateAcademicPaths(`/staff/academics/classes/${id.data}`);
  redirect("/staff/academics/classes?updated=1");
}
