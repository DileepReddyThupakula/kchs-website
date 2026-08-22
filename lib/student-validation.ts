import { z } from "zod";

export type StudentFieldErrors = Record<string, string[]>;

const optionalText = (maximum: number, minimum?: number) =>
  z.string().trim().refine(
    (value) => value.length === 0 || (value.length <= maximum && (!minimum || value.length >= minimum)),
    { message: minimum ? `Enter between ${minimum} and ${maximum} characters.` : `Enter no more than ${maximum} characters.` },
  ).default("");
const optionalEmail = z.string().trim().max(254).refine((value) => !value || z.email().safeParse(value).success, { message: "Enter a valid email address." }).default("");
const optionalPhone = optionalText(30, 7);

export const studentSchema = z.object({
  admission_number: z.string().trim().min(1, "Admission number is required.").max(50, "Admission number must be 50 characters or fewer."),
  full_name: z.string().trim().min(1, "Student name is required.").max(160, "Student name must be 160 characters or fewer."),
  date_of_birth: z.string().date("Enter a valid date of birth.").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", "not_specified"]).optional().or(z.literal("")),
  father_guardian_name: optionalText(160),
  mother_name: optionalText(160),
  primary_phone: optionalText(30, 7),
  secondary_phone: optionalText(30, 7),
  email: optionalEmail,
  address_line_1: optionalText(200),
  address_line_2: optionalText(200),
  locality: optionalText(120),
  city: optionalText(120),
  state: optionalText(120),
  postal_code: optionalText(20, 3),
  admission_date: z.string().date("Admission date is required."),
  status: z.enum(["active", "inactive", "graduated", "transferred"]),
  preferred_name: optionalText(100), blood_group: z.enum(["a_positive","a_negative","b_positive","b_negative","ab_positive","ab_negative","o_positive","o_negative","unknown"]).optional().or(z.literal("")).default(""), student_category: optionalText(100), aadhaar_number: z.string().trim().refine((value) => !value || /^\d{12}$/.test(value), { message: "Enter a valid 12-digit Aadhaar number." }).default(""), nationality: optionalText(100), mother_tongue: optionalText(100), previous_school_name: optionalText(200), previous_class: optionalText(100), previous_school_tc_number: optionalText(100), previous_school_location: optionalText(200), admission_remarks: optionalText(2000), father_name: optionalText(160), father_mobile: optionalPhone, father_email: optionalEmail, father_occupation: optionalText(160), mother_mobile: optionalPhone, mother_email: optionalEmail, mother_occupation: optionalText(160), guardian_name: optionalText(160), guardian_relationship: optionalText(100), guardian_mobile: optionalPhone, guardian_email: optionalEmail, primary_contact: z.enum(["father","mother","guardian"]).optional().or(z.literal("")).default(""), emergency_contact_name: optionalText(160), emergency_contact_relationship: optionalText(100), emergency_contact_mobile: optionalPhone, door_number: optionalText(80), street: optionalText(160), area_locality: optionalText(120), village_town_city: optionalText(120), mandal: optionalText(120), district: optionalText(120), identification_mark_1: optionalText(250), identification_mark_2: optionalText(250), general_notes: optionalText(4000), transport_required: z.boolean(),
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
