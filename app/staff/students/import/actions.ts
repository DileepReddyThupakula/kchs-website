"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";
import {
  parseStudentImportCsv,
  summarizeStudentAdmissionNumbers,
  validateStudentImportRows,
  type StudentImportExistingKeys,
  type StudentImportDatabasePreflight,
  type StudentImportPlacement,
  type StudentImportPreviewRow,
} from "@/lib/student-import";

const idsSchema = z.object({
  academic_year_id: z.string().uuid(),
  class_id: z.string().uuid(),
  academic_section_id: z.string().uuid(),
});

export type StudentImportValidationState = {
  status: "idle" | "error" | "preview";
  message?: string;
  sourceRow?: number;
  placementKey?: string;
  placement?: { academicYear: string; className: string; section: string };
  rows?: StudentImportPreviewRow[];
  summary?: { total: number; ready: number; warnings: number; errors: number };
  databasePreflight?: StudentImportDatabasePreflight;
};

export type StudentImportState = {
  status: "idle" | "error" | "success";
  message?: string;
  importedCount?: number;
};

const placementKey = (ids: { academic_year_id: string; class_id: string; academic_section_id: string }) => `${ids.academic_year_id}:${ids.class_id}:${ids.academic_section_id}`;

function failure(message: string, sourceRow?: number, placementKeyValue?: string): StudentImportValidationState {
  return { status: "error", message, sourceRow, placementKey: placementKeyValue };
}

const importRowSchema = z.object({
  full_name: z.string(),
  admission_number: z.string(),
  admission_date: z.string(),
  date_of_birth: z.string(),
  gender: z.string(),
  roll_number: z.string(),
  enrollment_date: z.string(),
}).strict();

const importRowsSchema = z.array(importRowSchema).min(1).max(2_000);

function importFailure(message: string): StudentImportState {
  return { status: "error", message };
}

function importDatabaseError(code?: string): StudentImportState {
  if (code === "23505") return importFailure("The import changed while it was being confirmed. Review the conflicts and validate the CSV again.");
  if (code === "23514") return importFailure("The selected placement or one or more rows are no longer valid. Validate the CSV again.");
  if (code === "42501") return importFailure("You are not authorized to import students.");
  if (code === "22023") return importFailure("The import payload is invalid. Validate the CSV again.");
  if (code === "22007") return importFailure("One or more dates are invalid. Validate the CSV again.");
  return importFailure("The student import could not be confirmed. Check the student directory before trying again.");
}

async function resolvePlacement(supabase: Awaited<ReturnType<typeof createClient>>, ids: z.infer<typeof idsSchema>): Promise<{ placement?: StudentImportPlacement; message?: string }> {
  const [year, schoolClass, section] = await Promise.all([
    supabase.from("academic_years").select("id,label,status,start_date,end_date").eq("id", ids.academic_year_id).maybeSingle(),
    supabase.from("school_classes").select("id,name,active").eq("id", ids.class_id).maybeSingle(),
    supabase.from("academic_sections").select("id,name,academic_year_id,class_id,active").eq("id", ids.academic_section_id).maybeSingle(),
  ]);

  const failed = year.error ?? schoolClass.error ?? section.error;
  if (failed) {
    console.error("Student import placement lookup failed.", { operation: "previewStudentImport", code: failed.code });
    return { message: "Academic placement is temporarily unavailable." };
  }
  if (!year.data || !schoolClass.data || !section.data) return { message: "Select an existing academic year, class, and section." };
  if (section.data.academic_year_id !== year.data.id || section.data.class_id !== schoolClass.data.id) return { message: "The selected section does not belong to the selected academic year and class." };

  return {
    placement: {
      academicYear: year.data,
      class: schoolClass.data,
      section: section.data,
    },
  };
}

async function readExistingKeys(supabase: Awaited<ReturnType<typeof createClient>>, sectionId: string): Promise<{ keys?: StudentImportExistingKeys; preflight?: StudentImportDatabasePreflight; message?: string }> {
  const admissionNumbers = new Set<string>();
  const admissionNumberValues: (string | null)[] = [];
  const rollNumbers = new Set<string>();
  const pageSize = 1_000;
  let totalStudents = 0;

  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from("students").select("admission_number", { count: "exact" }).range(offset, offset + pageSize - 1);
    if (result.error) {
      console.error("Student import admission preflight failed.", { operation: "previewStudentImport", code: result.error.code });
      return { message: "Existing student records could not be checked." };
    }
    totalStudents = result.count ?? totalStudents;
    for (const row of result.data ?? []) {
      admissionNumberValues.push(row.admission_number);
      if (row.admission_number) admissionNumbers.add(row.admission_number.trim().toLowerCase());
    }
    if ((result.data ?? []).length < pageSize) break;
  }

  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from("student_enrollments").select("roll_number").eq("academic_section_id", sectionId).not("roll_number", "is", null).range(offset, offset + pageSize - 1);
    if (result.error) {
      console.error("Student import roll preflight failed.", { operation: "previewStudentImport", code: result.error.code });
      return { message: "Existing enrollment records could not be checked." };
    }
    for (const row of result.data ?? []) if (row.roll_number) rollNumbers.add(row.roll_number.trim().toLowerCase());
    if ((result.data ?? []).length < pageSize) break;
  }

  return { keys: { admissionNumbers, rollNumbers }, preflight: summarizeStudentAdmissionNumbers(admissionNumberValues, totalStudents) };
}

export async function previewStudentImport(_previousState: StudentImportValidationState, formData: FormData): Promise<StudentImportValidationState> {
  await requireAdmin();

  const ids = idsSchema.safeParse({
    academic_year_id: formData.get("academic_year_id"),
    class_id: formData.get("class_id"),
    academic_section_id: formData.get("academic_section_id"),
  });
  const placementKeyValue = ids.success ? placementKey(ids.data) : undefined;
  if (!ids.success) return failure("Select an academic year, class, and section before validating the file.", undefined, placementKeyValue);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return failure("Choose a CSV file before validating the file.", undefined, placementKeyValue);
  if (file.name && !/\.csv$/i.test(file.name)) return failure("Upload a CSV file with a .csv filename.", undefined, placementKeyValue);

  const parsed = parseStudentImportCsv(await file.arrayBuffer());
  if (!parsed.success) return failure(`${parsed.message}${parsed.sourceRow ? ` Row ${parsed.sourceRow}.` : ""}`, parsed.sourceRow, placementKeyValue);
  if (!parsed.rows.length) return failure("CSV must contain at least one student row.", undefined, placementKeyValue);

  const supabase = await createClient();
  const resolved = await resolvePlacement(supabase, ids.data);
  if (!resolved.placement) return failure(resolved.message ?? "Select a valid academic placement.", undefined, placementKeyValue);

  const existing = await readExistingKeys(supabase, ids.data.academic_section_id);
  if (!existing.keys) return failure(existing.message ?? "Existing student records could not be checked.", undefined, placementKeyValue);

  const rows = validateStudentImportRows(parsed.rows, resolved.placement, existing.keys);
  const summary = {
    total: rows.length,
    ready: rows.filter((row) => row.status === "READY").length,
    warnings: rows.filter((row) => row.status === "WARNING").length,
    errors: rows.filter((row) => row.status === "ERROR").length,
  };

  return {
    status: "preview",
    placementKey: placementKeyValue,
    placement: { academicYear: resolved.placement.academicYear.label, className: resolved.placement.class.name, section: resolved.placement.section.name },
    rows,
    summary,
    databasePreflight: existing.preflight,
  };
}

export async function createStudentBulkImport(_previousState: StudentImportState, formData: FormData): Promise<StudentImportState> {
  await requireAdmin();

  if (formData.get("confirm") !== "on") return importFailure("Confirm the student import before continuing.");

  const ids = idsSchema.safeParse({
    academic_year_id: formData.get("academic_year_id"),
    class_id: formData.get("class_id"),
    academic_section_id: formData.get("academic_section_id"),
  });
  const rawRows = formData.get("rows");
  if (!ids.success || typeof rawRows !== "string") return importFailure("The import payload is invalid. Validate the CSV again.");

  let submittedRows: z.infer<typeof importRowsSchema>;
  try {
    submittedRows = importRowsSchema.parse(JSON.parse(rawRows));
  } catch {
    return importFailure("The import payload is invalid. Validate the CSV again.");
  }

  const values = submittedRows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value.trim()]),
  ) as typeof row);
  const supabase = await createClient();
  const resolved = await resolvePlacement(supabase, ids.data);
  if (!resolved.placement) return importFailure(resolved.message ?? "The selected academic placement is no longer available. Select a placement and validate the CSV again.");

  const placement = resolved.placement;
  if (!(["planning", "current"] as string[]).includes(placement.academicYear.status) || !placement.class.active || !placement.section.active || placement.section.academic_year_id !== placement.academicYear.id || placement.section.class_id !== placement.class.id) {
    return importFailure("The selected placement or one or more rows are no longer valid. Validate the CSV again.");
  }

  const parsedRows = values.map((row, index) => ({
    sourceRow: index + 2,
    values: row,
    blank: Object.values(row).every((value) => value.trim() === ""),
  }));
  const existing = await readExistingKeys(supabase, ids.data.academic_section_id);
  if (!existing.keys) return importFailure(existing.message ?? "Existing student records could not be checked.");

  const validatedRows = validateStudentImportRows(parsedRows, placement, existing.keys);
  if (validatedRows.some((row) => row.status === "ERROR")) return importFailure("The selected placement or one or more rows are no longer valid. Validate the CSV again.");

  const rpcRows = validatedRows.map((row) => ({
    full_name: row.values.full_name.trim(),
    admission_number: row.values.admission_number.trim(),
    admission_date: row.values.admission_date.trim(),
    date_of_birth: row.values.date_of_birth.trim(),
    gender: row.values.gender.trim(),
    roll_number: row.values.roll_number.trim(),
    enrollment_date: row.values.enrollment_date.trim(),
  }));
  const { data, error } = await supabase.rpc("create_students_with_enrollments", {
    p_rows: rpcRows,
    p_academic_year_id: ids.data.academic_year_id,
    p_class_id: ids.data.class_id,
    p_academic_section_id: ids.data.academic_section_id,
  });

  if (error) {
    console.error("Student bulk import failed.", { operation: "createStudentBulkImport", code: error.code });
    return importDatabaseError(error.code);
  }

  const importedCount = data && typeof data === "object" && !Array.isArray(data) && "imported_count" in data ? data.imported_count : undefined;
  if (typeof importedCount !== "number" || !Number.isInteger(importedCount) || importedCount !== rpcRows.length) {
    console.error("Student bulk import returned an invalid result.", { operation: "createStudentBulkImport", code: "INVALID_RESULT" });
    return importFailure("The import result could not be verified. Check the student directory before trying again.");
  }

  ["/staff", "/staff/students", "/staff/students/enrollments", "/staff/students/import"].forEach((path) => revalidatePath(path));
  return { status: "success", message: `Imported ${importedCount} students successfully.`, importedCount };
}
