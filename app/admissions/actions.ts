"use server";

export type EnquiryState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<"guardianName" | "studentName" | "classSeeking" | "phoneNumber" | "emailAddress", string>>;
};

function value(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }

export async function submitEnquiry(_previous: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const guardianName = value(formData, "guardianName");
  const studentName = value(formData, "studentName");
  const classSeeking = value(formData, "classSeeking");
  const phoneNumber = value(formData, "phoneNumber");
  const emailAddress = value(formData, "emailAddress");
  const message = value(formData, "message");
  const errors: EnquiryState["errors"] = {};
  if (guardianName.length < 2) errors.guardianName = "Please enter the parent or guardian’s name.";
  if (studentName.length < 2) errors.studentName = "Please enter the student’s name.";
  if (!classSeeking) errors.classSeeking = "Please select the class seeking admission.";
  if (!/^[0-9+()\-\s]{7,20}$/.test(phoneNumber)) errors.phoneNumber = "Please enter a valid phone number.";
  if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) errors.emailAddress = "Please enter a valid email address.";
  if (Object.keys(errors).length) return { status: "error", message: "Please correct the highlighted fields.", errors };

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
