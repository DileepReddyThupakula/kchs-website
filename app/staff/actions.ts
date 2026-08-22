"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { admissionStatusSchema } from "@/lib/staff/admissions";
import { requireStaff } from "@/lib/staff/auth";
import { eventStatusSchema, eventTypeSchema } from "@/lib/events";
import { noticePrioritySchema, noticeStatusSchema } from "@/lib/notices";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const notesSchema = z.string().trim().max(4000).transform((value) => value || null);
const noticeIdSchema = z.string().uuid();
const eventIdSchema = z.string().uuid();
const noticeFormSchema = z.object({
  content: z.string().trim().min(1, "Content is required.").max(6000, "Content must be 6,000 characters or fewer."),
  expiresAt: z.string().trim().max(32),
  priority: noticePrioritySchema,
  publishedAt: z.string().trim().max(32),
  status: noticeStatusSchema,
  summary: z.string().trim().max(400, "Summary must be 400 characters or fewer."),
  title: z.string().trim().min(1, "Title is required.").max(180, "Title must be 180 characters or fewer."),
});
const eventFormSchema = z.object({
  description: z.string().trim().max(6000, "Description must be 6,000 characters or fewer."),
  endAt: z.string().trim().max(32),
  eventType: eventTypeSchema,
  location: z.string().trim().max(240, "Location must be 240 characters or fewer."),
  startAt: z.string().trim().min(1, "Start date and time are required.").max(32),
  status: eventStatusSchema,
  title: z.string().trim().min(1, "Title is required.").max(180, "Title must be 180 characters or fewer."),
});

function parseIndianDateTime(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getNoticeInput(formData: FormData) {
  const parsed = noticeFormSchema.safeParse({
    content: formData.get("content"),
    expiresAt: formData.get("expiresAt"),
    priority: formData.get("priority"),
    publishedAt: formData.get("publishedAt"),
    status: formData.get("status"),
    summary: formData.get("summary"),
    title: formData.get("title"),
  });
  if (!parsed.success) return null;

  const enteredPublishedAt = parseIndianDateTime(parsed.data.publishedAt);
  const expiresAt = parseIndianDateTime(parsed.data.expiresAt);
  if (enteredPublishedAt === undefined || expiresAt === undefined) return null;
  const publishedAt = parsed.data.status === "published" ? enteredPublishedAt ?? new Date().toISOString() : enteredPublishedAt;
  if (publishedAt && expiresAt && new Date(expiresAt) <= new Date(publishedAt)) return null;

  return {
    content: parsed.data.content,
    expires_at: expiresAt,
    priority: parsed.data.priority,
    published_at: publishedAt,
    status: parsed.data.status,
    summary: parsed.data.summary || null,
    title: parsed.data.title,
  };
}

function getEventInput(formData: FormData) {
  const parsed = eventFormSchema.safeParse({
    description: formData.get("description"),
    endAt: formData.get("endAt"),
    eventType: formData.get("eventType"),
    location: formData.get("location"),
    startAt: formData.get("startAt"),
    status: formData.get("status"),
    title: formData.get("title"),
  });
  if (!parsed.success) return null;
  const startAt = parseIndianDateTime(parsed.data.startAt);
  const endAt = parseIndianDateTime(parsed.data.endAt);
  if (!startAt || endAt === undefined || (endAt && new Date(endAt) < new Date(startAt))) return null;
  return { description: parsed.data.description || null, end_at: endAt, event_type: parsed.data.eventType, is_public: formData.get("isPublic") === "on", location: parsed.data.location || null, start_at: startAt, status: parsed.data.status, title: parsed.data.title };
}

export async function signOutStaff() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateAdmissionStatus(formData: FormData) {
  await requireStaff();
  const id = idSchema.safeParse(formData.get("id"));
  const status = admissionStatusSchema.safeParse(formData.get("status"));
  if (!id.success || !status.success) redirect("/staff/admissions?error=update");

  const supabase = await createClient();
  const { error } = await supabase.from("admission_enquiries").update({ status: status.data }).eq("id", id.data);
  if (error) {
    console.error("Staff admission status update failed.", { category: "database-query", code: error.code });
    redirect(`/staff/admissions/${id.data}?error=update`);
  }

  revalidatePath("/staff");
  revalidatePath("/staff/admissions");
  revalidatePath(`/staff/admissions/${id.data}`);
  redirect(`/staff/admissions/${id.data}?updated=status`);
}

export async function updateAdmissionNotes(formData: FormData) {
  await requireStaff();
  const id = idSchema.safeParse(formData.get("id"));
  const notes = notesSchema.safeParse(formData.get("staffNotes"));
  if (!id.success || !notes.success) redirect("/staff/admissions?error=update");

  const supabase = await createClient();
  const { error } = await supabase.from("admission_enquiries").update({ staff_notes: notes.data }).eq("id", id.data);
  if (error) {
    console.error("Staff admission notes update failed.", { category: "database-query", code: error.code });
    redirect(`/staff/admissions/${id.data}?error=update`);
  }

  revalidatePath("/staff");
  revalidatePath("/staff/admissions");
  revalidatePath(`/staff/admissions/${id.data}`);
  redirect(`/staff/admissions/${id.data}?updated=notes`);
}

export async function createNotice(formData: FormData) {
  await requireStaff();
  const input = getNoticeInput(formData);
  if (!input) redirect("/staff/notices/new?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.from("notices").insert(input).select("id").single();
  if (error || !data) {
    console.error("Staff notice creation failed.", { category: "database-query", code: error?.code });
    redirect("/staff/notices/new?error=save");
  }

  revalidatePath("/");
  revalidatePath("/staff");
  revalidatePath("/staff/notices");
  redirect(`/staff/notices/${data.id}/edit?created=1`);
}

export async function updateNotice(formData: FormData) {
  await requireStaff();
  const id = noticeIdSchema.safeParse(formData.get("id"));
  const input = getNoticeInput(formData);
  if (!id.success) redirect("/staff/notices?error=update");
  if (!input) redirect(`/staff/notices/${id.data}/edit?error=invalid`);

  const supabase = await createClient();
  const { error } = await supabase.from("notices").update(input).eq("id", id.data);
  if (error) {
    console.error("Staff notice update failed.", { category: "database-query", code: error.code });
    redirect(`/staff/notices/${id.data}/edit?error=save`);
  }

  revalidatePath("/");
  revalidatePath("/staff");
  revalidatePath("/staff/notices");
  redirect(`/staff/notices/${id.data}/edit?updated=1`);
}

export async function archiveNotice(formData: FormData) {
  await requireStaff();
  const id = noticeIdSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/staff/notices?error=update");

  const supabase = await createClient();
  const { error } = await supabase.from("notices").update({ status: "archived" }).eq("id", id.data);
  if (error) {
    console.error("Staff notice archive failed.", { category: "database-query", code: error.code });
    redirect(`/staff/notices/${id.data}/edit?error=save`);
  }

  revalidatePath("/");
  revalidatePath("/staff");
  revalidatePath("/staff/notices");
  redirect(`/staff/notices/${id.data}/edit?updated=archived`);
}

export async function createEvent(formData: FormData) {
  await requireStaff();
  const input = getEventInput(formData);
  if (!input) redirect("/staff/events/new?error=invalid");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert(input).select("id").single();
  if (error || !data) { console.error("Staff event creation failed.", { category: "database-query", code: error?.code }); redirect("/staff/events/new?error=save"); }
  revalidatePath("/"); revalidatePath("/staff"); revalidatePath("/staff/events");
  redirect(`/staff/events/${data.id}/edit?created=${input.status}`);
}

export async function updateEvent(formData: FormData) {
  await requireStaff();
  const id = eventIdSchema.safeParse(formData.get("id")); const input = getEventInput(formData);
  if (!id.success) redirect("/staff/events?error=update");
  if (!input) redirect(`/staff/events/${id.data}/edit?error=invalid`);
  const { error } = await (await createClient()).from("events").update(input).eq("id", id.data);
  if (error) { console.error("Staff event update failed.", { category: "database-query", code: error.code }); redirect(`/staff/events/${id.data}/edit?error=save`); }
  revalidatePath("/"); revalidatePath("/staff"); revalidatePath("/staff/events");
  redirect(`/staff/events/${id.data}/edit?updated=${input.status}`);
}

export async function archiveEvent(formData: FormData) {
  await requireStaff(); const id = eventIdSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/staff/events?error=update");
  const { error } = await (await createClient()).from("events").update({ status: "archived" }).eq("id", id.data);
  if (error) { console.error("Staff event archive failed.", { category: "database-query", code: error.code }); redirect(`/staff/events/${id.data}/edit?error=save`); }
  revalidatePath("/"); revalidatePath("/staff"); revalidatePath("/staff/events");
  redirect(`/staff/events/${id.data}/edit?updated=archived`);
}
