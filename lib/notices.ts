import "server-only";

import { z } from "zod";

import { requireStaff } from "@/lib/staff/auth";
import { logStaffPerformance } from "@/lib/staff/performance";
import { createClient } from "@/lib/supabase/server";

export const noticeStatuses = ["draft", "published", "archived"] as const;
export const noticePriorities = ["normal", "important", "urgent"] as const;
export const noticeStatusSchema = z.enum(noticeStatuses);
export const noticePrioritySchema = z.enum(noticePriorities);
export type NoticeStatus = z.infer<typeof noticeStatusSchema>;
export type NoticePriority = z.infer<typeof noticePrioritySchema>;

export const noticeStatusLabels: Record<NoticeStatus, string> = { archived: "Archived", draft: "Draft", published: "Published" };
export const noticePriorityLabels: Record<NoticePriority, string> = { important: "Important", normal: "Normal", urgent: "Urgent" };

export type Notice = {
  content: string;
  created_at: string;
  expires_at: string | null;
  id: string;
  priority: NoticePriority;
  published_at: string | null;
  status: NoticeStatus;
  summary: string | null;
  title: string;
  updated_at: string;
};

export type PublicNotice = Pick<Notice, "expires_at" | "id" | "priority" | "published_at" | "summary" | "title">;
export type NoticeFilters = { search?: string; status?: string };
export type StaffNotices = { filtersActive: boolean; notices: Notice[]; queryFailed: boolean; total: number };
export type StaffNoticesOverview = { drafts: number; published: number; recent: Pick<Notice, "id" | "status" | "title" | "updated_at"> | null };

const noticeFields = "id, title, summary, content, status, priority, published_at, expires_at, created_at, updated_at";

function normaliseSearch(value: string | undefined) {
  return value?.trim().slice(0, 100) ?? "";
}

function escapePostgrestLike(value: string) {
  return value.replace(/[\\%_(),.]/g, "\\$&");
}

function hasValidStatus(value: string | undefined): value is NoticeStatus {
  return noticeStatusSchema.safeParse(value).success;
}

function parseNoticeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function logNoticeDatabaseError(operation: string, error: { code?: string; details?: string; hint?: string; message?: string }) {
  console.error(operation, { category: "database-query", code: error.code, details: error.details, hint: error.hint, message: error.message });
}

export function formatNoticeDate(value: string | null) {
  const date = parseNoticeDate(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export function formatNoticeDateTime(value: string | null) {
  const date = parseNoticeDate(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short", timeZone: "Asia/Kolkata", year: "numeric" }).format(date);
}

export function formatNoticeDateTimeInput(value: string | null) {
  const date = parseNoticeDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", hour: "2-digit", hour12: false, minute: "2-digit", month: "2-digit", timeZone: "Asia/Kolkata", year: "numeric" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export async function getStaffNotices(filters: NoticeFilters): Promise<StaffNotices> {
  await requireStaff();
  const supabase = await createClient();
  const status = hasValidStatus(filters.status) ? filters.status : undefined;
  const search = normaliseSearch(filters.search);
  const startedAt = performance.now();
  let listQuery = supabase.from("notices").select(noticeFields).order("updated_at", { ascending: false }).limit(100);
  if (status) listQuery = listQuery.eq("status", status);
  if (search) {
    const term = escapePostgrestLike(search);
    listQuery = listQuery.or(`title.ilike.%${term}%,summary.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const [listResult, totalResult] = await Promise.all([
    listQuery,
    supabase.from("notices").select("id", { count: "exact", head: true }),
  ]);
  const error = listResult.error ?? totalResult.error;
  logStaffPerformance("staff-notices-list", startedAt, error ? "failed" : "success");
  if (error) {
    logNoticeDatabaseError("Staff notices list failed.", error);
    return { filtersActive: Boolean(status || search), notices: [], queryFailed: true, total: 0 };
  }

  return { filtersActive: Boolean(status || search), notices: (listResult.data ?? []) as Notice[], queryFailed: false, total: totalResult.count ?? 0 };
}

export async function getStaffNotice(id: string): Promise<Notice | null> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("notices").select(noticeFields).eq("id", id).maybeSingle();
  if (error) logNoticeDatabaseError("Staff notice detail failed.", error);
  return data as Notice | null;
}

export async function getStaffNoticesOverview(): Promise<StaffNoticesOverview> {
  await requireStaff();
  const supabase = await createClient();
  const startedAt = performance.now();
  const [publishedResult, draftsResult, recentResult] = await Promise.all([
    supabase.from("notices").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("notices").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("notices").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const error = publishedResult.error ?? draftsResult.error ?? recentResult.error;
  logStaffPerformance("staff-notices-overview", startedAt, error ? "failed" : "success");
  if (error) logNoticeDatabaseError("Staff notices overview failed.", error);
  return { drafts: draftsResult.count ?? 0, published: publishedResult.count ?? 0, recent: recentResult.data as StaffNoticesOverview["recent"] };
}

export async function getPublicNotices(): Promise<PublicNotice[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, summary, priority, published_at, expires_at")
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(3);
  if (error) logNoticeDatabaseError("Public notices list failed.", error);
  return (data ?? []) as PublicNotice[];
}
