import { z } from "zod";

export const admissionClasses = ["Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"] as const;

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);

function normalizeIndianPhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+91") ? compact.slice(3) : compact;
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export const admissionEnquirySchema = z.object({
  guardianName: z.string().trim().min(2, "Please enter the parent or guardian’s name.").max(120, "Please use 120 characters or fewer."),
  studentName: z.string().trim().min(2, "Please enter the student’s name.").max(120, "Please use 120 characters or fewer."),
  classSeeking: z.enum(admissionClasses, { error: "Please select the class seeking admission." }),
  phoneNumber: z.string().transform(normalizeIndianPhone).pipe(z.string().min(1, "Please enter a valid Indian mobile number.")),
  emailAddress: optionalText(254).refine((value) => value === null || z.string().email().safeParse(value).success, "Please enter a valid email address.").transform((value) => value?.toLowerCase() ?? null),
  message: optionalText(1000),
});

export type AdmissionEnquiryInput = z.output<typeof admissionEnquirySchema>;
