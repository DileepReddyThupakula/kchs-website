import "server-only";

import postgres from "postgres";

import type { AdmissionEnquiryInput } from "@/lib/admissions/schema";

type CreatedAdmissionEnquiry = {
  id: string;
  createdAt: string;
};

type CreatedAdmissionEnquiryRow = {
  id: string;
  created_at: string;
};

export class AdmissionEnquiryPersistenceError extends Error {
  constructor() {
    super("Admission enquiry persistence failed.");
    this.name = "AdmissionEnquiryPersistenceError";
  }
}

function createDatabaseClient() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new AdmissionEnquiryPersistenceError();
  }

  return postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });
}

export async function createAdmissionEnquiry(input: AdmissionEnquiryInput): Promise<CreatedAdmissionEnquiry> {
  const sql = createDatabaseClient();

  try {
    const [enquiry] = await sql<CreatedAdmissionEnquiryRow[]>`
      insert into public.admission_enquiries (
        guardian_name,
        student_name,
        class_seeking,
        phone_number,
        email_address,
        message
      ) values (
        ${input.guardianName},
        ${input.studentName},
        ${input.classSeeking},
        ${input.phoneNumber},
        ${input.emailAddress},
        ${input.message}
      )
      returning id, created_at
    `;

    if (!enquiry) {
      throw new AdmissionEnquiryPersistenceError();
    }

    return { id: enquiry.id, createdAt: enquiry.created_at };
  } catch (error) {
    if (error instanceof AdmissionEnquiryPersistenceError) {
      throw error;
    }

    console.error("Admission enquiry persistence failed.");
    throw new AdmissionEnquiryPersistenceError();
  } finally {
    await sql.end({ timeout: 5 });
  }
}
