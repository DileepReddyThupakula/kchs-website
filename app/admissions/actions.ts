"use server";

import { admissionEnquirySchema } from "@/lib/admissions/schema";

export type EnquiryState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<"guardianName" | "studentName" | "classSeeking" | "phoneNumber" | "emailAddress", string>>;
};

export async function submitEnquiry(_previous: EnquiryState, formData: FormData): Promise<EnquiryState> {
  if (String(formData.get("website") ?? "").trim()) return { status: "error", message: "We could not submit your enquiry at this time." };
  const result = admissionEnquirySchema.safeParse({
    guardianName: formData.get("guardianName"),
    studentName: formData.get("studentName"),
    classSeeking: formData.get("classSeeking"),
    phoneNumber: formData.get("phoneNumber"),
    emailAddress: formData.get("emailAddress"),
    message: formData.get("message"),
  });
  if (!result.success) {
    const errors: EnquiryState["errors"] = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field in { guardianName: true, studentName: true, classSeeking: true, phoneNumber: true, emailAddress: true }) errors[field as keyof NonNullable<EnquiryState["errors"]>] ??= issue.message;
    }
    return { status: "error", message: "Please correct the highlighted fields.", errors };
  }
  const { guardianName, studentName, classSeeking, phoneNumber, emailAddress, message } = result.data;

  const webhook = process.env.ADMISSIONS_WEBHOOK_URL;
  if (!webhook) return { status: "error", message: "Online enquiries are not configured yet. Please contact the school office; contact details will be updated shortly." };

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardianName, studentName, classSeeking, phoneNumber, emailAddress: emailAddress || undefined, message: message || undefined, receivedAt: new Date().toISOString() }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Enquiry endpoint rejected the request");
    return { status: "success", message: "Thank you. Your enquiry has been received and the school will be in touch." };
  } catch {
    return { status: "error", message: "We could not submit your enquiry at this time. Please try again later or contact the school office." };
  }
}
