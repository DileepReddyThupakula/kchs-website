import "server-only";

import { z } from "zod";

import { requireStaff } from "@/lib/staff/auth";
import { logStaffPerformance } from "@/lib/staff/performance";
import { createClient } from "@/lib/supabase/server";

export const eventStatuses = ["draft", "published", "archived"] as const;
export const eventTypes = ["academic", "exam", "holiday", "meeting", "sports", "cultural", "admissions", "celebration", "other"] as const;
export const eventStatusSchema = z.enum(eventStatuses);
export const eventTypeSchema = z.enum(eventTypes);
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventStatusLabels: Record<EventStatus, string> = { archived: "Archived", draft: "Draft", published: "Published" };
export const eventTypeLabels: Record<EventType, string> = { academic: "Academic", admissions: "Admissions", celebration: "Celebration", cultural: "Cultural", exam: "Examination", holiday: "Holiday", meeting: "Meeting", other: "Other", sports: "Sports" };
export const eventPresentationStatuses = ["draft", "upcoming", "ongoing", "past", "archived"] as const;
export type EventPresentationStatus = (typeof eventPresentationStatuses)[number];
export const eventPresentationLabels: Record<EventPresentationStatus, string> = { archived: "Archived", draft: "Draft", ongoing: "Ongoing", past: "Past", upcoming: "Upcoming" };

export type SchoolEvent = { id: string; title: string; description: string | null; event_type: EventType; start_at: string; end_at: string | null; location: string | null; status: EventStatus; is_public: boolean; created_at: string; updated_at: string };
export type PublicEvent = Pick<SchoolEvent, "end_at" | "event_type" | "id" | "location" | "start_at" | "title">;
export type EventFilters = { search?: string; status?: string };
export type StaffEvents = { events: SchoolEvent[]; filtersActive: boolean; queryFailed: boolean; total: number };
export type StaffEventsOverview = { upcoming: number; next: Pick<SchoolEvent, "event_type" | "id" | "start_at" | "title"> | null };

const eventFields = "id, title, description, event_type, start_at, end_at, location, status, is_public, created_at, updated_at";

function parseEventDate(value: string | null) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; }
function normaliseSearch(value: string | undefined) { return value?.trim().slice(0, 100) ?? ""; }
function escapePostgrestLike(value: string) { return value.replace(/[\\%_(),.]/g, "\\$&"); }
function isPresentationStatus(value: string | undefined): value is EventPresentationStatus { return eventPresentationStatuses.includes(value as EventPresentationStatus); }
function logEventDatabaseError(operation: string, error: { code?: string; details?: string; hint?: string; message?: string }) { console.error(operation, { category: "database-query", code: error.code, details: error.details, hint: error.hint, message: error.message }); }

export function getEventPresentationStatus(event: Pick<SchoolEvent, "end_at" | "start_at" | "status">, now = new Date()): EventPresentationStatus {
  if (event.status === "archived") return "archived";
  if (event.status === "draft") return "draft";
  const startAt = parseEventDate(event.start_at);
  const endAt = parseEventDate(event.end_at) ?? startAt;
  if (!startAt || !endAt) return "past";
  if (startAt > now) return "upcoming";
  if (endAt < now) return "past";
  return "ongoing";
}

export function formatEventDate(value: string | null) { const date = parseEventDate(value); return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date) : "Not set"; }
export function formatEventTime(value: string | null) { const date = parseEventDate(value); return date ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date) : "Not set"; }
export function formatEventDateTime(value: string | null) { const date = parseEventDate(value); return date ? new Intl.DateTimeFormat("en-IN", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short", timeZone: "Asia/Kolkata", year: "numeric" }).format(date) : "Not set"; }
export function formatEventDateTimeInput(value: string | null) { const date = parseEventDate(value); if (!date) return ""; const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", hour: "2-digit", hour12: false, minute: "2-digit", month: "2-digit", timeZone: "Asia/Kolkata", year: "numeric" }).formatToParts(date); const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""; return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`; }

export async function getStaffEvents(filters: EventFilters): Promise<StaffEvents> {
  await requireStaff(); const supabase = await createClient(); const search = normaliseSearch(filters.search); const presentation = isPresentationStatus(filters.status) ? filters.status : undefined; const startedAt = performance.now();
  let listQuery = supabase.from("events").select(eventFields).order("start_at", { ascending: true }).limit(100);
  if (search) { const term = escapePostgrestLike(search); listQuery = listQuery.or(`title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%`); }
  const [listResult, totalResult] = await Promise.all([listQuery, supabase.from("events").select("id", { count: "exact", head: true })]);
  const error = listResult.error ?? totalResult.error; logStaffPerformance("staff-events-list", startedAt, error ? "failed" : "success");
  if (error) { logEventDatabaseError("Staff events list failed.", error); return { events: [], filtersActive: Boolean(search || presentation), queryFailed: true, total: 0 }; }
  const events = (listResult.data ?? []) as SchoolEvent[];
  return { events: presentation ? events.filter((event) => getEventPresentationStatus(event) === presentation) : events, filtersActive: Boolean(search || presentation), queryFailed: false, total: totalResult.count ?? 0 };
}

export async function getStaffEvent(id: string): Promise<SchoolEvent | null> { await requireStaff(); if (!z.string().uuid().safeParse(id).success) return null; const { data, error } = await (await createClient()).from("events").select(eventFields).eq("id", id).maybeSingle(); if (error) logEventDatabaseError("Staff event detail failed.", error); return data as SchoolEvent | null; }

export async function getStaffEventsOverview(): Promise<StaffEventsOverview> {
  await requireStaff(); const supabase = await createClient(); const now = new Date().toISOString(); const startedAt = performance.now();
  const [upcomingResult, nextResult] = await Promise.all([supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published").gte("start_at", now), supabase.from("events").select("id, title, event_type, start_at").eq("status", "published").gte("start_at", now).order("start_at", { ascending: true }).limit(1).maybeSingle()]);
  const error = upcomingResult.error ?? nextResult.error; logStaffPerformance("staff-events-overview", startedAt, error ? "failed" : "success"); if (error) logEventDatabaseError("Staff events overview failed.", error);
  return { upcoming: upcomingResult.count ?? 0, next: nextResult.data as StaffEventsOverview["next"] };
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  const supabase = await createClient(); const now = new Date().toISOString();
  const { data, error } = await supabase.from("events").select("id, title, event_type, start_at, end_at, location").eq("status", "published").eq("is_public", true).or(`start_at.gte.${now},end_at.gte.${now}`).order("start_at", { ascending: true }).limit(4);
  if (error) logEventDatabaseError("Public events list failed.", error); return (data ?? []) as PublicEvent[];
}
