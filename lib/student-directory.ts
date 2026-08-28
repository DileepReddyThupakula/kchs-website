import { z } from "zod";

export const studentStatuses = ["active", "inactive", "graduated", "transferred"] as const;
const uuid = z.string().uuid();
const pageSizes = [25, 50, 100] as const;

export type StudentDirectoryFilters = {
  page: number;
  pageSize: (typeof pageSizes)[number];
  q?: string;
  status?: (typeof studentStatuses)[number];
  yearId?: string;
  classId?: string;
  sectionId?: string;
};

export function parseStudentDirectoryParams(params: Record<string, string | undefined>): StudentDirectoryFilters {
  const page = z.coerce.number().int().positive().safeParse(params.page);
  const pageSize = z.coerce.number().int().safeParse(params.pageSize);
  const status = z.enum(studentStatuses).safeParse(params.status);
  const yearId = uuid.safeParse(params.year);
  const classId = uuid.safeParse(params.class);
  const sectionId = uuid.safeParse(params.section);
  const q = params.q?.trim().slice(0, 100);
  return {
    page: page.success ? page.data : 1,
    pageSize: pageSize.success && pageSizes.includes(pageSize.data as (typeof pageSizes)[number]) ? pageSize.data as (typeof pageSizes)[number] : 25,
    q: q || undefined,
    status: status.success ? status.data : undefined,
    yearId: yearId.success ? yearId.data : undefined,
    classId: classId.success ? classId.data : undefined,
    sectionId: sectionId.success ? sectionId.data : undefined,
  };
}

export function directoryRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function directorySearchTerm(value: string) {
  return value.replace(/[%,_]/g, (match) => `\\${match}`);
}

export function directoryPageHref(filters: StudentDirectoryFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.yearId) params.set("year", filters.yearId);
  if (filters.classId) params.set("class", filters.classId);
  if (filters.sectionId) params.set("section", filters.sectionId);
  return `/staff/students?${params.toString()}`;
}
