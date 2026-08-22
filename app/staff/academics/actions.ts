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

export async function toggleClass(formData: FormData) {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success) redirect("/staff/academics/classes?error=invalid");
  const { error } = await (await createClient()).from("school_classes").update({ active }).eq("id", id.data);
  if (error) redirect("/staff/academics/classes?error=save");
  revalidateAcademicPaths(`/staff/academics/classes/${id.data}`);
  redirect("/staff/academics/classes?updated=1");
}
