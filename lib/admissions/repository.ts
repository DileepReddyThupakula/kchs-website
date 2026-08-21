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
  constructor(readonly category: "configuration" | "database-response" | "database-query" = "database-query") {
    super("Admission enquiry persistence failed.");
    this.name = "AdmissionEnquiryPersistenceError";
  }
}

function getSafeDatabaseErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") {
    return { category: "unknown" };
  }

  const candidate = error as { code?: unknown; name?: unknown };
  const code = typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code) ? candidate.code : undefined;
  const name = typeof candidate.name === "string" ? candidate.name : "UnknownError";

  return { category: "database-query", code, name };
}

function createDatabaseClient() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new AdmissionEnquiryPersistenceError("configuration");
  }

  return postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 1,
    prepare: false,
  });
}

export async function createAdmissionEnquiry(input: AdmissionEnquiryInput): Promise<CreatedAdmissionEnquiry> {
  let sql: ReturnType<typeof createDatabaseClient> | undefined;

  try {
    sql = createDatabaseClient();
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
      throw new AdmissionEnquiryPersistenceError("database-response");
    }

    return { id: enquiry.id, createdAt: enquiry.created_at };
  } catch (error) {
    if (error instanceof AdmissionEnquiryPersistenceError) {
      console.error("Admission enquiry persistence failed.", { category: error.category });
      throw error;
    }

    console.error("Admission enquiry persistence failed.", getSafeDatabaseErrorMetadata(error));
    throw new AdmissionEnquiryPersistenceError();
  } finally {
    if (sql) {
      try {
        await sql.end({ timeout: 5 });
      } catch {
        console.error("Admission database connection cleanup failed.", { category: "connection-cleanup" });
      }
    }
  }
}
