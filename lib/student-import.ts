import { enrollmentSchema, studentSchema, validationErrors, type StudentFieldErrors } from "./student-validation.ts";

export const STUDENT_IMPORT_HEADERS = [
  "full_name",
  "admission_number",
  "admission_date",
  "date_of_birth",
  "gender",
  "roll_number",
  "enrollment_date",
] as const;

export const REQUIRED_STUDENT_IMPORT_HEADERS = [
  "full_name",
  "admission_number",
  "admission_date",
  "enrollment_date",
] as const;

export const STUDENT_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const STUDENT_IMPORT_MAX_ROWS = 2_000;

export type StudentImportHeader = (typeof STUDENT_IMPORT_HEADERS)[number];

export type StudentImportValues = Record<StudentImportHeader, string>;

export type StudentImportParsedRow = {
  sourceRow: number;
  values: StudentImportValues;
  blank: boolean;
};

export type StudentImportParseResult =
  | { success: true; headers: StudentImportHeader[]; rows: StudentImportParsedRow[] }
  | { success: false; message: string; sourceRow?: number };

export type StudentImportPlacement = {
  academicYear: { id: string; label: string; status: string; start_date: string; end_date: string };
  class: { id: string; name: string; active: boolean };
  section: { id: string; name: string; academic_year_id: string; class_id: string; active: boolean };
};

export type StudentImportExistingKeys = {
  admissionNumbers?: ReadonlySet<string>;
  rollNumbers?: ReadonlySet<string>;
};

export type StudentImportDatabasePreflight = {
  totalStudents: number;
  duplicateNormalizedAdmissionNumbers: number;
  duplicateNormalizedAdmissionNumberRows: number;
  admissionNumbersWithLeadingOrTrailingWhitespace: number;
  blankNormalizedAdmissionNumbers: number;
};

export type StudentImportPreviewRow = {
  sourceRow: number;
  values: StudentImportValues;
  status: "READY" | "WARNING" | "ERROR";
  fieldErrors: StudentFieldErrors;
  warnings: string[];
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeImportKey(value: string) {
  return value.trim().toLowerCase();
}

export function summarizeStudentAdmissionNumbers(
  admissionNumbers: readonly (string | null | undefined)[],
  totalStudents = admissionNumbers.length,
): StudentImportDatabasePreflight {
  const counts = new Map<string, number>();
  let admissionNumbersWithLeadingOrTrailingWhitespace = 0;
  let blankNormalizedAdmissionNumbers = 0;

  for (const value of admissionNumbers) {
    const raw = value ?? "";
    const normalized = normalizeImportKey(raw);
    if (raw !== raw.trim()) admissionNumbersWithLeadingOrTrailingWhitespace += 1;
    if (!normalized) {
      blankNormalizedAdmissionNumbers += 1;
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const duplicateGroups = [...counts.values()].filter((count) => count > 1);
  return {
    totalStudents,
    duplicateNormalizedAdmissionNumbers: duplicateGroups.length,
    duplicateNormalizedAdmissionNumberRows: duplicateGroups.reduce((total, count) => total + count, 0),
    admissionNumbersWithLeadingOrTrailingWhitespace,
    blankNormalizedAdmissionNumbers,
  };
}

function emptyValues(): StudentImportValues {
  return Object.fromEntries(STUDENT_IMPORT_HEADERS.map((header) => [header, ""])) as StudentImportValues;
}

function isBlank(values: string[]) {
  return values.every((value) => value.trim() === "");
}

function decodeCsv(input: Uint8Array | ArrayBuffer | string): { text: string; bytes: number } | { error: string } {
  if (typeof input === "string") {
    const bytes = new TextEncoder().encode(input).byteLength;
    if (bytes > STUDENT_IMPORT_MAX_BYTES) return { error: "CSV file must be 2 MB or smaller." };
    return { text: input, bytes };
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > STUDENT_IMPORT_MAX_BYTES) return { error: "CSV file must be 2 MB or smaller." };

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), bytes: bytes.byteLength };
  } catch {
    return { error: "CSV file must be valid UTF-8." };
  }
}

function parseRecords(text: string): { values: string[]; sourceRow: number }[] | { message: string; sourceRow?: number } {
  const records: { values: string[]; sourceRow: number }[] = [];
  let values: string[] = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;
  let line = 1;
  let recordStart = 1;

  const pushField = () => {
    values.push(field.trim());
    field = "";
    afterQuote = false;
  };

  const pushRecord = () => {
    pushField();
    records.push({ values, sourceRow: recordStart });
    values = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (character === "\n") {
        field += "\n";
        line += 1;
      } else if (character === "\r") {
        if (text[index + 1] !== "\n") return { message: "CSV contains a bare carriage return; use LF or CRLF line endings.", sourceRow: recordStart };
        field += "\n";
        line += 1;
        index += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === " " || character === "\t") {
        continue;
      } else if (character === ",") {
        pushField();
      } else if (character === "\n") {
        pushRecord();
        line += 1;
        recordStart = line;
      } else if (character === "\r" && text[index + 1] === "\n") {
        pushRecord();
        line += 1;
        recordStart = line;
        index += 1;
      } else {
        return { message: "CSV has characters after a quoted field.", sourceRow: recordStart };
      }
      continue;
    }

    if (character === '"') {
      if (field.trim().length !== 0) return { message: "CSV has an unexpected quote.", sourceRow: recordStart };
      field = "";
      inQuotes = true;
    } else if (character === ",") {
      pushField();
    } else if (character === "\n") {
      pushRecord();
      line += 1;
      recordStart = line;
    } else if (character === "\r") {
      if (text[index + 1] !== "\n") return { message: "CSV contains a bare carriage return; use LF or CRLF line endings.", sourceRow: recordStart };
      pushRecord();
      line += 1;
      recordStart = line;
      index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) return { message: "CSV contains an unclosed quoted field.", sourceRow: recordStart };
  if (field.length > 0 || values.length > 0 || text.length > 0 && !text.endsWith("\n")) pushRecord();
  return records;
}

export function parseStudentImportCsv(input: Uint8Array | ArrayBuffer | string): StudentImportParseResult {
  const decoded = decodeCsv(input);
  if ("error" in decoded) return { success: false, message: decoded.error };

  const text = decoded.text.startsWith("\ufeff") ? decoded.text.slice(1) : decoded.text;
  if (decoded.bytes === 0 || text.trim() === "") return { success: false, message: "CSV file is empty." };

  const parsed = parseRecords(text);
  if (!Array.isArray(parsed)) return { success: false, message: parsed.message, sourceRow: parsed.sourceRow };
  if (!parsed.length || isBlank(parsed[0].values)) return { success: false, message: "CSV must contain a header row." };

  const headers: StudentImportHeader[] = [];
  const seen = new Set<string>();
  for (const rawHeader of parsed[0].values) {
    const header = normalizeHeader(rawHeader);
    if (seen.has(header)) return { success: false, message: `Duplicate CSV header: ${header}.`, sourceRow: parsed[0].sourceRow };
    seen.add(header);
    if (!(STUDENT_IMPORT_HEADERS as readonly string[]).includes(header)) return { success: false, message: `Unknown CSV header: ${header}.`, sourceRow: parsed[0].sourceRow };
    headers.push(header as StudentImportHeader);
  }

  for (const required of REQUIRED_STUDENT_IMPORT_HEADERS) {
    if (!headers.includes(required)) return { success: false, message: `Missing required CSV header: ${required}.`, sourceRow: parsed[0].sourceRow };
  }

  const dataRecords = parsed.slice(1);
  let lastMeaningful = -1;
  dataRecords.forEach((record, index) => {
    if (!isBlank(record.values)) lastMeaningful = index;
  });
  const meaningfulRecords = lastMeaningful === -1 ? [] : dataRecords.slice(0, lastMeaningful + 1);
  if (meaningfulRecords.length > STUDENT_IMPORT_MAX_ROWS) return { success: false, message: "CSV contains more than 2,000 data rows." };

  const rows: StudentImportParsedRow[] = [];
  for (const record of meaningfulRecords) {
    if (record.values.length > headers.length) return { success: false, message: `CSV row has more fields than the header row.`, sourceRow: record.sourceRow };
    const values = emptyValues();
    headers.forEach((header, index) => { values[header] = record.values[index] ?? ""; });
    rows.push({ sourceRow: record.sourceRow, values, blank: isBlank(record.values) });
  }

  return { success: true, headers, rows };
}

export function validateStudentImportRows(rows: StudentImportParsedRow[], placement: StudentImportPlacement, existing: StudentImportExistingKeys = {}): StudentImportPreviewRow[] {
  const previews = rows.map((row) => {
    const fieldErrors: StudentFieldErrors = {};
    const warnings: string[] = [];
    const values = { ...row.values };

    if (row.blank) fieldErrors.form = ["Blank rows are not allowed inside the CSV data."];

    const studentResult = studentSchema.safeParse({
      admission_number: values.admission_number,
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      gender: values.gender,
      admission_date: values.admission_date,
      status: "active",
      transport_required: false,
    });
    const enrollmentResult = enrollmentSchema.safeParse({
      academic_year_id: placement.academicYear.id,
      class_id: placement.class.id,
      academic_section_id: placement.section.id,
      roll_number: values.roll_number,
      enrollment_date: values.enrollment_date,
      enrollment_status: "active",
    });

    Object.entries(validationErrors(studentResult, enrollmentResult)).forEach(([field, messages]) => { fieldErrors[field] = [...(fieldErrors[field] ?? []), ...messages]; });

    if (placement.academicYear.status !== "planning" && placement.academicYear.status !== "current") fieldErrors.academic_year = ["The selected academic year is not open for enrollment."];
    if (!placement.class.active) fieldErrors.class = ["The selected class is inactive."];
    if (!placement.section.active) fieldErrors.section = ["The selected section is inactive."];
    if (placement.section.academic_year_id !== placement.academicYear.id) fieldErrors.section = ["The selected section does not belong to the selected academic year."];
    if (placement.section.class_id !== placement.class.id) fieldErrors.section = ["The selected section does not belong to the selected class."];
    if (!fieldErrors.enrollment_date && values.enrollment_date && (values.enrollment_date < placement.academicYear.start_date || values.enrollment_date > placement.academicYear.end_date)) {
      fieldErrors.enrollment_date = ["Enrollment date must fall within the selected academic year."];
    }
    if (!values.roll_number) warnings.push("No roll number supplied; it will remain blank until enrollment is completed.");

    return { sourceRow: row.sourceRow, values, status: "READY" as "READY" | "WARNING" | "ERROR", fieldErrors, warnings };
  });

  const admissionRows = new Map<string, number[]>();
  const rollRows = new Map<string, number[]>();
  previews.forEach((row, index) => {
    const admissionKey = normalizeImportKey(row.values.admission_number);
    if (admissionKey) admissionRows.set(admissionKey, [...(admissionRows.get(admissionKey) ?? []), index]);
    const rollKey = normalizeImportKey(row.values.roll_number);
    if (rollKey) rollRows.set(rollKey, [...(rollRows.get(rollKey) ?? []), index]);
  });

  const markDuplicateRows = (groups: Map<string, number[]>, field: string, message: string) => {
    groups.forEach((indexes) => {
      if (indexes.length < 2) return;
      indexes.forEach((index) => { previews[index].fieldErrors[field] = [...(previews[index].fieldErrors[field] ?? []), message]; });
    });
  };

  markDuplicateRows(admissionRows, "admission_number", "Admission number is duplicated within this CSV.");
  markDuplicateRows(rollRows, "roll_number", "Roll number is duplicated within this selected class and section.");

  previews.forEach((row) => {
    const admissionKey = normalizeImportKey(row.values.admission_number);
    const rollKey = normalizeImportKey(row.values.roll_number);
    if (admissionKey && existing.admissionNumbers?.has(admissionKey)) row.fieldErrors.admission_number = [...(row.fieldErrors.admission_number ?? []), "Admission number already exists in the database."];
    if (rollKey && existing.rollNumbers?.has(rollKey)) row.fieldErrors.roll_number = [...(row.fieldErrors.roll_number ?? []), "Roll number already exists in the selected section."];
    if (Object.keys(row.fieldErrors).length) row.status = "ERROR";
    else if (row.warnings.length) row.status = "WARNING";
  });

  return previews;
}

export function studentImportTemplate() {
  return `\ufeff${STUDENT_IMPORT_HEADERS.join(",")}\r\n`;
}
