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
  address_line_2: optionalText(200),
  state: optionalText(120),
  postal_code: optionalText(20, 3),
  admission_date: z.string().date("Admission date is required."),
  status: z.enum(["active", "inactive", "graduated", "transferred"]),
  preferred_name: optionalText(100), blood_group: z.enum(["a_positive","a_negative","b_positive","b_negative","ab_positive","ab_negative","o_positive","o_negative","unknown"]).optional().or(z.literal("")).default(""), student_category: optionalText(100), aadhaar_number: z.string().trim().refine((value) => !value || /^\d{12}$/.test(value), { message: "Enter a valid 12-digit Aadhaar number." }).default(""), nationality: optionalText(100), mother_tongue: optionalText(100), previous_school_name: optionalText(200), previous_class: optionalText(100), previous_school_tc_number: optionalText(100), previous_school_location: optionalText(200), admission_remarks: optionalText(2000), father_name: optionalText(160), father_mobile: optionalPhone, father_email: optionalEmail, father_occupation: optionalText(160), mother_mobile: optionalPhone, mother_email: optionalEmail, mother_occupation: optionalText(160), guardian_name: optionalText(160), guardian_relationship: optionalText(100), guardian_mobile: optionalPhone, guardian_email: optionalEmail, primary_contact: z.enum(["father","mother","guardian"]).optional().or(z.literal("")).default(""), emergency_contact_name: optionalText(160), emergency_contact_relationship: optionalText(100), emergency_contact_mobile: optionalPhone, door_number: optionalText(80), street: optionalText(160), area_locality: optionalText(120), village_town_city: optionalText(120), mandal: optionalText(120), district: optionalText(120), identification_mark_1: optionalText(250), identification_mark_2: optionalText(250), general_notes: optionalText(4000), transport_required: z.boolean(),
});

// The upgraded contact fields are canonical for new edits. Legacy summary fields
// remain readable and are deliberately excluded so an unrelated edit preserves them.
export const studentEditSchema = studentSchema.pick({
  admission_number: true, full_name: true, preferred_name: true, date_of_birth: true,
  gender: true, blood_group: true, student_category: true, aadhaar_number: true,
  nationality: true, mother_tongue: true, admission_date: true,
  previous_school_name: true, previous_class: true, previous_school_tc_number: true,
  previous_school_location: true, admission_remarks: true, father_name: true,
  father_mobile: true, father_email: true, father_occupation: true, mother_name: true,
  mother_mobile: true, mother_email: true, mother_occupation: true, guardian_name: true,
  guardian_relationship: true, guardian_mobile: true, guardian_email: true,
  emergency_contact_name: true, emergency_contact_relationship: true,
  emergency_contact_mobile: true, door_number: true, street: true, address_line_2: true,
  area_locality: true, village_town_city: true, mandal: true, district: true, state: true,
  postal_code: true, identification_mark_1: true, identification_mark_2: true,
  transport_required: true, general_notes: true,
});

export function studentEditPatch(data: z.infer<typeof studentEditSchema>, formData: FormData) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key === "transport_required" || formData.has(key)));
}

export function normalizeStudentFormData(formData: FormData) {
  return { ...Object.fromEntries(formData), transport_required: formData.get("transport_required") === "on" };
}

export type StudentFormStateValues = Record<string, string | boolean | undefined>;
export function studentFormStateValues(formData: FormData): StudentFormStateValues {
  const values: StudentFormStateValues = {};
  for (const [key, value] of Object.entries(normalizeStudentFormData(formData))) {
    if (typeof value === "string" || typeof value === "boolean") values[key] = value;
  }
  return values;
}

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
