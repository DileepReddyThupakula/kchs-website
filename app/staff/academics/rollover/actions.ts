"use server";

import { requireAdmin } from "@/lib/staff/auth";
import {
  executeAcademicYearRollover,
  getAcademicYearRolloverWorkspaceData,
  preflightAcademicYearRollover,
} from "@/lib/academic-year-rollover";

export async function preflightAcademicYearRolloverAction(input: unknown) {
  await requireAdmin();
  return preflightAcademicYearRollover(input);
}

export async function executeAcademicYearRolloverAction(input: unknown) {
  await requireAdmin();
  return executeAcademicYearRollover(input);
}

export async function getAcademicYearRolloverWorkspaceDataAction() {
  await requireAdmin();
  return getAcademicYearRolloverWorkspaceData();
}
