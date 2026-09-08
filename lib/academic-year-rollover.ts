import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/staff/auth";
import { logStaffTiming } from "@/lib/staff/performance";
import { createClient } from "@/lib/supabase/server";

const uuid = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().uuid(),
);

const nullableText = (max: number) => z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(max).nullable().optional(),
);

const nullableUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

const outcome = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["promote", "repeat", "graduate", "exclude"]),
);

export const academicRolloverItemSchema = z.object({
  studentId: uuid,
  sourceEnrollmentId: uuid,
  outcome,
  targetClassId: nullableUuid,
  targetSectionId: nullableUuid,
  targetRollNumber: nullableText(30),
  reason: nullableText(500),
}).strict().superRefine((item, context) => {
  const hasPlacement = item.targetClassId !== null && item.targetClassId !== undefined
    || item.targetSectionId !== null && item.targetSectionId !== undefined
    || item.targetRollNumber !== null && item.targetRollNumber !== undefined;

  if ((item.outcome === "promote" || item.outcome === "repeat")
    && (item.targetClassId == null || item.targetSectionId == null)) {
    context.addIssue({ code: "custom", path: ["targetClassId"], message: "A target class and section are required." });
  }

  if ((item.outcome === "graduate" || item.outcome === "exclude") && hasPlacement) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "This outcome cannot include a target placement or roll number." });
  }
});

export const academicRolloverPlanSchema = z.object({
  sourceAcademicYearId: uuid,
  targetAcademicYearId: uuid,
  items: z.array(academicRolloverItemSchema).min(1).max(2_000),
}).strict().superRefine((plan, context) => {
  if (plan.sourceAcademicYearId === plan.targetAcademicYearId) {
    context.addIssue({ code: "custom", path: ["targetAcademicYearId"], message: "Source and target academic years must be different." });
  }
});

export const academicRolloverExecutionSchema = academicRolloverPlanSchema.extend({
  expectedFingerprint: z.string().trim().regex(/^[0-9a-f]{32}$/i, "A valid preflight fingerprint is required."),
});

export type AcademicRolloverPlan = z.infer<typeof academicRolloverPlanSchema>;
export type AcademicRolloverExecution = z.infer<typeof academicRolloverExecutionSchema>;

type RpcPlanItem = {
  student_id: string;
  source_enrollment_id: string;
  outcome: "promote" | "repeat" | "graduate" | "exclude";
  target_class_id: string | null;
  target_section_id: string | null;
  target_roll_number: string | null;
  reason: string | null;
};

function toRpcPlan(plan: AcademicRolloverPlan): RpcPlanItem[] {
  return plan.items.map((item) => ({
    student_id: item.studentId,
    source_enrollment_id: item.sourceEnrollmentId,
    outcome: item.outcome,
    target_class_id: item.targetClassId ?? null,
    target_section_id: item.targetSectionId ?? null,
    target_roll_number: item.targetRollNumber ?? null,
    reason: item.reason ?? null,
  }));
}

const canonicalItemSchema = z.object({
  student_id: z.string().uuid(),
  source_enrollment_id: z.string().uuid(),
  outcome: z.enum(["promote", "repeat", "graduate", "exclude"]),
  target_class_id: z.string().uuid().nullable(),
  target_section_id: z.string().uuid().nullable(),
  target_roll_number: z.string().nullable(),
  reason: z.string().nullable(),
}).strip();

const previewItemSchema = canonicalItemSchema.extend({
  source_enrollment_updated_at: z.string().nullable(),
  student_status: z.string().nullable(),
  source_enrollment_status: z.string().nullable(),
});

const previewSchema = z.object({
  ready: z.boolean(),
  fingerprint: z.string().regex(/^[0-9a-f]{32}$/i),
  canonical_items: z.array(canonicalItemSchema),
  items: z.array(previewItemSchema),
  total_count: z.number().int().nonnegative(),
  promote_count: z.number().int().nonnegative(),
  repeat_count: z.number().int().nonnegative(),
  graduate_count: z.number().int().nonnegative(),
  exclude_count: z.number().int().nonnegative(),
  source_active_count: z.number().int().nonnegative(),
  errors: z.array(z.object({
    code: z.string(),
    student_id: z.string().uuid().optional(),
  }).strip()),
}).strip();

const executionResultSchema = z.object({
  operation_id: z.string().uuid(),
  status: z.literal("completed"),
  source_academic_year_id: z.string().uuid(),
  target_academic_year_id: z.string().uuid(),
  plan_fingerprint: z.string().regex(/^[0-9a-f]{32}$/i),
  total_count: z.number().int().nonnegative(),
  promote_count: z.number().int().nonnegative(),
  repeat_count: z.number().int().nonnegative(),
  graduate_count: z.number().int().nonnegative(),
  exclude_count: z.number().int().nonnegative(),
  idempotent_replay: z.boolean(),
}).strip();

export type AcademicRolloverPreview = z.infer<typeof previewSchema>;
export type AcademicRolloverExecutionResult = z.infer<typeof executionResultSchema>;

export type RolloverErrorCategory =
  | "validation"
  | "forbidden"
  | "stale_preview"
  | "blocker"
  | "conflict"
  | "not_found"
  | "database";

export type RolloverError = {
  category: RolloverErrorCategory;
  message: string;
  fields?: { path: string[]; message: string }[];
};

export type RolloverActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RolloverError };

type RpcError = { code?: string | null } | null;

function validationFailure(error: z.ZodError): RolloverActionResult<never> {
  return {
    ok: false,
    error: {
      category: "validation",
      message: "Review the academic rollover plan and try again.",
      fields: error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      })),
    },
  };
}

function mapRpcError(error: RpcError): RolloverError {
  switch (error?.code) {
    case "42501":
      return { category: "forbidden", message: "You are not authorized to manage academic year rollover." };
    case "40001":
      return { category: "stale_preview", message: "The academic data changed after this preview. Run preflight again before executing." };
    case "23514":
      return { category: "blocker", message: "The rollover plan is no longer valid. Review the blockers and run preflight again." };
    case "23505":
      return { category: "conflict", message: "Another rollover or academic change won this update. Refresh the academic data before trying again." };
    case "P0002":
      return { category: "not_found", message: "One of the selected academic records is no longer available." };
    case "22023":
      return { category: "validation", message: "The rollover plan payload is invalid." };
    default:
      return { category: "database", message: "The academic rollover could not be completed. Please try again." };
  }
}

function invalidResult(operation: "preflight" | "execute"): RolloverActionResult<never> {
  console.error("Academic rollover returned an invalid result.", { operation, code: "INVALID_RESULT" });
  return { ok: false, error: { category: "database", message: "The academic rollover response could not be verified." } };
}

export async function preflightAcademicYearRollover(input: unknown): Promise<RolloverActionResult<AcademicRolloverPreview>> {
  await requireAdmin();
  const parsed = academicRolloverPlanSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { data, error } = await (await createClient()).rpc("preflight_academic_year_rollover", {
    p_source_academic_year_id: parsed.data.sourceAcademicYearId,
    p_target_academic_year_id: parsed.data.targetAcademicYearId,
    p_items: toRpcPlan(parsed.data),
  });
  if (error) {
    console.error("Academic rollover preflight failed.", { operation: "preflight", code: error.code });
    return { ok: false, error: mapRpcError(error) };
  }

  const preview = previewSchema.safeParse(data);
  return preview.success ? { ok: true, data: preview.data } : invalidResult("preflight");
}

function revalidateRolloverPaths() {
  for (const path of [
    "/staff",
    "/staff/academics",
    "/staff/academics/years",
    "/staff/academics/classes",
    "/staff/academics/sections",
    "/staff/students",
    "/staff/students/enrollments",
  ]) revalidatePath(path);
}

export async function executeAcademicYearRollover(input: unknown): Promise<RolloverActionResult<AcademicRolloverExecutionResult>> {
  await requireAdmin();
  const parsed = academicRolloverExecutionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { data, error } = await (await createClient()).rpc("execute_academic_year_rollover", {
    p_source_academic_year_id: parsed.data.sourceAcademicYearId,
    p_target_academic_year_id: parsed.data.targetAcademicYearId,
    p_items: toRpcPlan(parsed.data),
    p_plan_fingerprint: parsed.data.expectedFingerprint,
  });
  if (error) {
    console.error("Academic rollover execution failed.", { operation: "execute", code: error.code });
    return { ok: false, error: mapRpcError(error) };
  }

  const result = executionResultSchema.safeParse(data);
  if (!result.success) return invalidResult("execute");
  revalidateRolloverPaths();
  return { ok: true, data: result.data };
}

export type AcademicRolloverWorkspaceData = {
  failed: boolean;
  sourceYear: { id: string; label: string; start_date: string; end_date: string; status: "current" } | null;
  targetYears: { id: string; label: string; start_date: string; end_date: string; status: "planning" }[];
  classes: { id: string; name: string; display_order: number; active: boolean }[];
  sections: { id: string; name: string; academic_year_id: string; class_id: string; active: boolean }[];
  sourceEnrollments: {
    id: string;
    student_id: string;
    class_id: string;
    academic_section_id: string;
    roll_number: string | null;
    enrollment_date: string;
    student: { id: string; admission_number: string; full_name: string; status: string } | null;
  }[];
};

const emptyWorkspaceData = (): AcademicRolloverWorkspaceData => ({
  failed: true,
  sourceYear: null,
  targetYears: [],
  classes: [],
  sections: [],
  sourceEnrollments: [],
});

const workspaceStudentSchema = z.object({
  id: z.string().uuid(),
  admission_number: z.string(),
  full_name: z.string(),
  status: z.string(),
}).strict();

const workspaceDataSchema = z.object({
  source_year: z.object({
    id: z.string().uuid(),
    label: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    status: z.literal("current"),
  }).strict().nullable(),
  target_years: z.array(z.object({
    id: z.string().uuid(),
    label: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    status: z.literal("planning"),
  }).strict()),
  classes: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    display_order: z.number().int(),
    active: z.literal(true),
  }).strict()),
  sections: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    academic_year_id: z.string().uuid(),
    class_id: z.string().uuid(),
    active: z.literal(true),
  }).strict()),
  source_enrollments: z.array(z.object({
    id: z.string().uuid(),
    student_id: z.string().uuid(),
    class_id: z.string().uuid(),
    academic_section_id: z.string().uuid(),
    roll_number: z.string().nullable(),
    enrollment_date: z.string(),
    student: workspaceStudentSchema.nullable(),
  }).strict()),
}).strict();

export async function getAcademicYearRolloverWorkspaceData(): Promise<AcademicRolloverWorkspaceData> {
  const loaderStartedAt = performance.now();
  await requireAdmin();
  const supabase = await createClient();
  const queryStartedAt = performance.now();
  const { data, error } = await supabase.rpc("get_academic_year_rollover_workspace");
  logStaffTiming("academic-rollover-workspace-query", queryStartedAt, error ? "failed" : "success", "query-wave");
  if (error) {
    console.error("Academic rollover workspace lookup failed.", { operation: "workspace", code: error.code });
    logStaffTiming("academic-rollover-workspace-loader", loaderStartedAt, "failed", "loader");
    return emptyWorkspaceData();
  }

  const parsed = workspaceDataSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Academic rollover workspace returned an invalid result.", { operation: "workspace", code: "INVALID_RESULT" });
    logStaffTiming("academic-rollover-workspace-loader", loaderStartedAt, "failed", "loader");
    return emptyWorkspaceData();
  }

  logStaffTiming("academic-rollover-workspace-loader", loaderStartedAt, "success", "loader");
  return {
    failed: false,
    sourceYear: parsed.data.source_year,
    targetYears: parsed.data.target_years,
    classes: parsed.data.classes,
    sections: parsed.data.sections,
    sourceEnrollments: parsed.data.source_enrollments,
  };
}
