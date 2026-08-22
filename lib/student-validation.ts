import { z } from "zod";

export type StudentFieldErrors = Record<string, string[]>;

const optionalText = (maximum: number, minimum?: number) =>
  z.string().trim().refine(
    (value) => value.length === 0 || (value.length <= maximum && (!minimum || value.length >= minimum)),
    { message: minimum ? `Enter between ${minimum} and ${maximum} characters.` : `Enter no more than ${maximum} characters.` },
  );

export const studentSchema = z.object({
  admission_number: z.string().trim().min(1, "Admission number is required.").max(50, "Admission number must be 50 characters or fewer."),
  full_name: z.string().trim().min(1, "Student name is required.").max(160, "Student name must be 160 characters or fewer."),
  date_of_birth: z.string().date("Enter a valid date of birth.").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", "not_specified"]).optional().or(z.literal("")),
  father_guardian_name: optionalText(160),
  mother_name: optionalText(160),
  primary_phone: optionalText(30, 7),
  secondary_phone: optionalText(30, 7),
  email: z.string().trim().max(254, "Email address must be 254 characters or fewer.").refine(
    (value) => value.length === 0 || z.email().safeParse(value).success,
    { message: "Enter a valid email address." },
  ),
  address_line_1: optionalText(200),
  address_line_2: optionalText(200),
  locality: optionalText(120),
  city: optionalText(120),
  state: optionalText(120),
  postal_code: optionalText(20, 3),
  admission_date: z.string().date("Admission date is required."),
  status: z.enum(["active", "inactive", "graduated", "transferred"]),
});

export const enrollmentSchema = z.object({
  academic_year_id: z.string().uuid("Select an academic year."),
  class_id: z.string().uuid("Select a class."),
  academic_section_id: z.string().uuid("Section is required."),
  roll_number: optionalText(30),
  enrollment_date: z.string().date("Enrollment date is required."),
  enrollment_status: z.enum(["active", "inactive", "completed", "transferred"]),
});

export function validationErrors(...results: z.ZodSafeParseResult<unknown>[]): StudentFieldErrors {
  const errors: StudentFieldErrors = {};

  for (const result of results) {
    if (result.success) continue;
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "form");
      (errors[field] ??= []).push(issue.message);
    }
  }

  return errors;
}
