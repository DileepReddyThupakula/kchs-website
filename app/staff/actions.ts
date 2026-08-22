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
export type GalleryFormState = { fieldErrors?: Partial<Record<"description" | "event_date" | "title", string>>; formError?: string };
const galleryFormSchema = z.object({ description: z.string().trim().max(2000), event_date: z.string().trim().max(10), intent: z.enum(["draft", "published"]), is_public: z.boolean(), title: z.string().trim().min(1, "Title is required.").max(180, "Title must be 180 characters or fewer.") });
const galleryImageIdSchema = z.string().uuid();
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxGalleryImageSize = 4 * 1024 * 1024;

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

function galleryInput(formData: FormData): { input: { description: string | null; event_date: string | null; is_public: boolean; status: "draft" | "published"; title: string }; state?: never } | { input?: never; state: GalleryFormState } {
  const parsed = galleryFormSchema.safeParse({ description: formData.get("description"), event_date: formData.get("event_date"), intent: formData.get("intent"), is_public: formData.get("is_public") === "on", title: formData.get("title") });
  if (!parsed.success) { console.warn("Staff gallery validation failed.", { category: "validation", issues: parsed.error.issues.map((issue) => ({ issue: issue.message, path: issue.path.join(".") })) }); return { state: { fieldErrors: Object.fromEntries(parsed.error.issues.filter((issue) => ["title", "description", "event_date"].includes(String(issue.path[0]))).map((issue) => [issue.path[0], issue.message])) } }; }
  if (parsed.data.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.event_date)) return { state: { fieldErrors: { event_date: "Enter a valid event date." } } };
  return { input: { description: parsed.data.description || null, event_date: parsed.data.event_date || null, is_public: parsed.data.is_public, status: parsed.data.intent, title: parsed.data.title } };
}
function galleryFiles(formData: FormData) { const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0); if (files.some((file) => !imageMimeTypes.has(file.type) || file.size > maxGalleryImageSize)) return null; return files; }
function filePath(albumId: string, file: File) { const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"; return `${albumId}/${crypto.randomUUID()}.${extension}`; }
async function uploadGalleryFiles(albumId: string, files: File[], captions: string[], altTexts: string[]) { const supabase = await createClient(); const records: { album_id: string; alt_text: string; caption: string | null; display_order: number; storage_path: string }[] = []; const paths: string[] = []; for (let index = 0; index < files.length; index += 1) { const file = files[index]; const altText = altTexts[index]?.trim(); if (!altText) { if (paths.length) await supabase.storage.from("gallery-media").remove(paths); return { error: "Every uploaded photo needs alt text." }; } const storage_path = filePath(albumId, file); const { error } = await supabase.storage.from("gallery-media").upload(storage_path, file, { contentType: file.type, upsert: false }); if (error) { if (paths.length) await supabase.storage.from("gallery-media").remove(paths); console.error("Gallery image upload failed.", { code: error.message }); return { error: "We could not upload one of the images. Please try again." }; } paths.push(storage_path); records.push({ album_id: albumId, alt_text: altText.slice(0, 300), caption: captions[index]?.trim().slice(0, 500) || null, display_order: index, storage_path }); } if (records.length) { const { error } = await supabase.from("gallery_images").insert(records); if (error) { await supabase.storage.from("gallery-media").remove(paths); console.error("Gallery image record creation failed.", { code: error.code, details: error.details, hint: error.hint, message: error.message }); return { error: "We could not save the image records. Please try again." }; } return { firstPath: records[0]?.storage_path }; }
  return {};
}
export async function createGalleryAlbum(_previous: GalleryFormState, formData: FormData): Promise<GalleryFormState> { await requireStaff(); const parsed = galleryInput(formData); if ("state" in parsed) return parsed.state ?? { formError: "Please review the album details." }; const files = galleryFiles(formData); if (!files) return { formError: "Upload JPEG, PNG or WebP images up to 4 MB each." }; const supabase = await createClient(); const { data, error } = await supabase.from("gallery_albums").insert(parsed.input).select("id").single(); if (error || !data) { console.error("Gallery album creation failed.", { code: error?.code, details: error?.details, hint: error?.hint, message: error?.message }); return { formError: "We could not save this album. Please try again." }; } const uploaded = await uploadGalleryFiles(data.id, files, formData.getAll("caption").map(String), formData.getAll("alt_text").map(String)); if (uploaded.error) return { formError: uploaded.error }; if (uploaded.firstPath) await supabase.from("gallery_albums").update({ cover_image_path: uploaded.firstPath }).eq("id", data.id); revalidatePath("/"); revalidatePath("/gallery"); revalidatePath("/staff"); revalidatePath("/staff/gallery"); redirect(`/staff/gallery/${data.id}/edit?created=${parsed.input.status}`); }
export async function updateGalleryAlbum(_previous: GalleryFormState, formData: FormData): Promise<GalleryFormState> { await requireStaff(); const id = z.string().uuid().safeParse(formData.get("id")); if (!id.success) redirect("/staff/gallery"); const parsed = galleryInput(formData); if ("state" in parsed) return parsed.state ?? { formError: "Please review the album details." }; const files = galleryFiles(formData); if (!files) return { formError: "Upload JPEG, PNG or WebP images up to 4 MB each." }; const supabase = await createClient(); const { error } = await supabase.from("gallery_albums").update(parsed.input).eq("id", id.data); if (error) { console.error("Gallery album update failed.", { code: error.code, details: error.details, hint: error.hint, message: error.message }); return { formError: "We could not save this album. Please try again." }; } const uploaded = await uploadGalleryFiles(id.data, files, formData.getAll("caption").map(String), formData.getAll("alt_text").map(String)); if (uploaded.error) return { formError: uploaded.error }; if (uploaded.firstPath) await supabase.from("gallery_albums").update({ cover_image_path: uploaded.firstPath }).eq("id", id.data); revalidatePath("/"); revalidatePath("/gallery"); revalidatePath(`/gallery/${id.data}`); revalidatePath("/staff"); revalidatePath("/staff/gallery"); redirect(`/staff/gallery/${id.data}/edit?updated=${parsed.input.status}`); }
export async function archiveGalleryAlbum(formData: FormData) { await requireStaff(); const id = z.string().uuid().safeParse(formData.get("id")); if (!id.success) redirect("/staff/gallery"); const { error } = await (await createClient()).from("gallery_albums").update({ status: "archived" }).eq("id", id.data); if (error) redirect(`/staff/gallery/${id.data}/edit?error=save`); revalidatePath("/"); revalidatePath("/gallery"); revalidatePath("/staff"); revalidatePath("/staff/gallery"); redirect(`/staff/gallery/${id.data}/edit?updated=archived`); }
export async function removeGalleryImage(formData: FormData) { await requireStaff(); const id = galleryImageIdSchema.safeParse(formData.get("id")); const albumId = z.string().uuid().safeParse(formData.get("albumId")); if (!id.success || !albumId.success) redirect("/staff/gallery"); const supabase = await createClient(); const { data } = await supabase.from("gallery_images").select("storage_path").eq("id", id.data).maybeSingle(); if (!data) redirect(`/staff/gallery/${albumId.data}/edit`); const removed = await supabase.storage.from("gallery-media").remove([data.storage_path]); if (removed.error) { console.error("Gallery media removal failed.", { message: removed.error.message }); redirect(`/staff/gallery/${albumId.data}/edit?error=save`); } const { error } = await supabase.from("gallery_images").delete().eq("id", id.data); if (error) redirect(`/staff/gallery/${albumId.data}/edit?error=save`); revalidatePath("/"); revalidatePath("/gallery"); revalidatePath(`/gallery/${albumId.data}`); revalidatePath(`/staff/gallery/${albumId.data}/edit`); redirect(`/staff/gallery/${albumId.data}/edit?updated=image`); }
