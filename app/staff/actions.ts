"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { admissionStatusSchema } from "@/lib/staff/admissions";
import { requireStaff } from "@/lib/staff/auth";
import { eventTypeSchema } from "@/lib/events";
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
const eventIntentSchema = z.enum(["draft", "published"]);
const eventFormSchema = z.object({
  description: z.string().trim().max(6000, "Description must be 6,000 characters or fewer."),
  end_at: z.string().trim().max(32),
  event_type: eventTypeSchema,
  intent: eventIntentSchema,
  is_public: z.boolean(),
  location: z.string().trim().max(240, "Location must be 240 characters or fewer."),
  start_at: z.string().trim().min(1, "Start date and time are required.").max(32),
  title: z.string().trim().min(1, "Title is required.").max(180, "Title must be 180 characters or fewer."),
});

export type EventFormState = { fieldErrors?: Partial<Record<"description" | "end_at" | "event_type" | "location" | "start_at" | "title", string>>; formError?: string };

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

function logEventValidationIssues(issues: z.ZodIssue[]) {
  console.warn("Staff event validation failed.", { category: "validation", issues: issues.map((issue) => ({ issue: issue.message, path: issue.path.join(".") })) });
}

function eventValidationState(fieldErrors: EventFormState["fieldErrors"], formError = "Please review the highlighted event details."): EventFormState {
  return { fieldErrors, formError };
}

function getEventInput(formData: FormData): { input: { description: string | null; end_at: string | null; event_type: z.infer<typeof eventTypeSchema>; is_public: boolean; location: string | null; start_at: string; status: z.infer<typeof eventIntentSchema>; title: string } } | { state: EventFormState } {
  const parsed = eventFormSchema.safeParse({
    description: formData.get("description"),
    end_at: formData.get("end_at"),
    event_type: formData.get("event_type"),
    intent: formData.get("intent"),
    is_public: formData.get("is_public") === "on",
    location: formData.get("location"),
    start_at: formData.get("start_at"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    logEventValidationIssues(parsed.error.issues);
    const fieldErrors = Object.fromEntries(parsed.error.issues.filter((issue) => typeof issue.path[0] === "string" && issue.path[0] !== "intent" && issue.path[0] !== "is_public").map((issue) => [issue.path[0], issue.message])) as EventFormState["fieldErrors"];
    return { state: eventValidationState(fieldErrors) };
  }
  const startAt = parseIndianDateTime(parsed.data.start_at);
  const endAt = parseIndianDateTime(parsed.data.end_at);
  if (!startAt) return { state: eventValidationState({ start_at: "Enter a valid start date and time." }) };
  if (endAt === undefined) return { state: eventValidationState({ end_at: "Enter a valid end date and time." }) };
  if (endAt && new Date(endAt) < new Date(startAt)) return { state: eventValidationState({ end_at: "The end date and time cannot be earlier than the start." }) };
  return { input: { description: parsed.data.description || null, end_at: endAt, event_type: parsed.data.event_type, is_public: parsed.data.is_public, location: parsed.data.location || null, start_at: startAt, status: parsed.data.intent, title: parsed.data.title } };
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

function eventDatabaseErrorState(operation: string, error: { code?: string; details?: string; hint?: string; message?: string }): EventFormState {
  console.error(operation, { code: error.code, details: error.details, hint: error.hint, message: error.message });
  return { formError: "We could not save this event. Please try again." };
}

export async function createEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireStaff();
  const parsed = getEventInput(formData);
  if ("state" in parsed) return parsed.state;
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert(parsed.input).select("id").single();
  if (error || !data) return eventDatabaseErrorState("Staff event creation failed.", error ?? {});
  revalidatePath("/"); revalidatePath("/staff"); revalidatePath("/staff/events");
  redirect(`/staff/events/${data.id}/edit?created=${parsed.input.status}`);
}

export async function updateEvent(_previousState: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireStaff();
  const id = eventIdSchema.safeParse(formData.get("id")); const parsed = getEventInput(formData);
  if (!id.success) redirect("/staff/events?error=update");
  if ("state" in parsed) return parsed.state;
  const { error } = await (await createClient()).from("events").update(parsed.input).eq("id", id.data);
  if (error) return eventDatabaseErrorState("Staff event update failed.", error);
  revalidatePath("/"); revalidatePath("/staff"); revalidatePath("/staff/events");
  redirect(`/staff/events/${id.data}/edit?updated=${parsed.input.status}`);
}

export async function archiveEvent(formData: FormData) {
  await requireStaff(); const id = eventIdSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/staff/events?error=update");
  const { error } = await (await createClient()).from("events").update({ status: "archived" }).eq("id", id.data);
  if (error) { console.error("Staff event archive failed.", { category: "database-query", code: error.code }); redirect(`/staff/events/${id.data}/edit?error=save`); }
  revalidatePath("/"); revalidatePath("/staff"); revalidatePath("/staff/events");
  redirect(`/staff/events/${id.data}/edit?updated=archived`);
}
