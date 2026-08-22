"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { admissionStatusSchema } from "@/lib/staff/admissions";
import { requireStaff } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const notesSchema = z.string().trim().max(4000).transform((value) => value || null);

export async function signOutStaff() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateAdmissionStatus(formData: FormData) {
  await requireStaff();
  const id = idSchema.safeParse(formData.get("id"));
  const status = admissionStatusSchema.safeParse(formData.get("status"));
  if (!id.success || !status.success) redirect("/staff?error=update");

  const supabase = await createClient();
  const { error } = await supabase.from("admission_enquiries").update({ status: status.data }).eq("id", id.data);
  if (error) {
    console.error("Staff admission status update failed.", { category: "database-query", code: error.code });
    redirect(`/staff/admissions/${id.data}?error=update`);
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/admissions/${id.data}`);
  redirect(`/staff/admissions/${id.data}?updated=status`);
}

export async function updateAdmissionNotes(formData: FormData) {
  await requireStaff();
  const id = idSchema.safeParse(formData.get("id"));
  const notes = notesSchema.safeParse(formData.get("staffNotes"));
  if (!id.success || !notes.success) redirect("/staff?error=update");

  const supabase = await createClient();
  const { error } = await supabase.from("admission_enquiries").update({ staff_notes: notes.data }).eq("id", id.data);
  if (error) {
    console.error("Staff admission notes update failed.", { category: "database-query", code: error.code });
    redirect(`/staff/admissions/${id.data}?error=update`);
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/admissions/${id.data}`);
  redirect(`/staff/admissions/${id.data}?updated=notes`);
}
