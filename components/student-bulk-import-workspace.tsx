"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { AcademicSubmitButton } from "@/components/academic-submit-button";
import { previewStudentImport, type StudentImportValidationState } from "@/app/staff/students/import/actions";
import type { StudentAcademicData } from "@/lib/students";

const initialState: StudentImportValidationState = { status: "idle" };

export function StudentBulkImportWorkspace({ years, classes, sections }: StudentAcademicData) {
  const [state, formAction] = useActionState(previewStudentImport, initialState);
  const [yearId, setYearId] = useState(years.find((year) => year.status === "current")?.id ?? "");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const key = `${yearId}:${classId}:${sectionId}`;
  const selectedYear = years.find((year) => year.id === yearId);
  const availableClasses = useMemo(() => classes.filter((schoolClass) => schoolClass.active && sections.some((section) => section.active && section.academic_year_id === yearId && section.class_id === schoolClass.id)), [classes, sections, yearId]);
  const availableSections = useMemo(() => sections.filter((section) => section.active && section.academic_year_id === yearId && section.class_id === classId), [classId, sections, yearId]);
  const preview = state.status === "preview" && state.placementKey === key ? state : null;
  const error = state.status === "error" ? state : null;

  return <div className="student-import-page">
    <Link className="staff-back" href="/staff/students">← Back to students</Link>
    <header className="student-editor-header">
      <p className="academic-kicker">Student Directory / Bulk Import</p>
      <h1>Validate a class list</h1>
      <p>Prepare and review a student CSV before any records can be imported.</p>
    </header>

    <div className="student-import-notice" role="note">
      <strong>Validation only</strong>
      <span>This workspace does not create, update, or delete student records. Final import confirmation will be added in a later phase.</span>
    </div>

    <form className="student-import-form" action={formAction}>
      <section className="student-import-card">
        <header><p className="academic-kicker">Step 1</p><h2>Select placement</h2><p>Choose the academic placement once for the complete class list.</p></header>
        <div className="student-import-grid">
          <label>Academic Year<select name="academic_year_id" value={yearId} onChange={(event) => { setYearId(event.target.value); setClassId(""); setSectionId(""); }} required><option value="">Select academic year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.label}{year.status === "current" ? " · Current" : ""}</option>)}</select></label>
          <label>Class<select name="class_id" value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(""); }} disabled={!yearId} required><option value="">Select class</option>{availableClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
          <label>Section<select name="academic_section_id" value={sectionId} onChange={(event) => setSectionId(event.target.value)} disabled={!classId} required><option value="">Select section</option>{availableSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
        </div>
        {selectedYear && <p className="student-import-helper">Enrollment dates must fall between {selectedYear.start_date} and {selectedYear.end_date}.</p>}
      </section>

      <section className="student-import-card">
        <header><p className="academic-kicker">Step 2</p><h2>Download CSV template</h2><p>The template contains student-specific fields only. Placement is selected above.</p></header>
        <Link className="student-import-template-link" href="/staff/students/import/template" prefetch={false}><span className="student-import-template-label">Download kchs-student-import-template.csv</span><span aria-hidden="true">↓</span></Link>
      </section>

      <section className="student-import-card">
        <header><p className="academic-kicker">Step 3</p><h2>Upload completed CSV</h2><p>CSV, UTF-8, maximum 2 MB and 2,000 data rows.</p></header>
        <label className="student-import-file">CSV file<input name="file" type="file" accept=".csv,text/csv" required /></label>
        <div className="student-import-actions"><AcademicSubmitButton className="staff-action-submit" disabled={!yearId || !classId || !sectionId}>Validate file</AcademicSubmitButton></div>
        {error && <p className="student-import-feedback student-import-feedback-error" role="alert">{error.message}{error.sourceRow ? ` (row ${error.sourceRow})` : ""}</p>}
        {!preview && state.status === "preview" && <p className="student-import-feedback student-import-feedback-warning" role="status">Placement changed. Validate the CSV again before reviewing this preview.</p>}
      </section>
    </form>

    {preview && <section className="student-import-card student-import-preview" aria-labelledby="student-import-preview-title">
      <header><p className="academic-kicker">Step 4</p><h2 id="student-import-preview-title">Review preview</h2><p>{preview.placement?.academicYear} · {preview.placement?.className} · {preview.placement?.section}</p></header>
      <div className="student-import-summary" aria-label="Validation summary"><strong>{preview.summary?.total ?? 0} rows</strong><span>{preview.summary?.ready ?? 0} ready</span><span>{preview.summary?.warnings ?? 0} warnings</span><span>{preview.summary?.errors ?? 0} errors</span></div>
      {preview.databasePreflight && <div className="student-import-preflight" aria-label="Read-only database preflight"><strong>Read-only database preflight</strong><span>{preview.databasePreflight.totalStudents} total students</span><span>{preview.databasePreflight.duplicateNormalizedAdmissionNumbers} duplicate normalized admission numbers</span><span>{preview.databasePreflight.admissionNumbersWithLeadingOrTrailingWhitespace} admission numbers with leading/trailing whitespace</span><span>{preview.databasePreflight.blankNormalizedAdmissionNumbers} blank normalized admission numbers</span></div>}
      <div className="student-import-table-wrap"><table className="student-import-table"><thead><tr><th>Row</th><th>Student</th><th>Admission no.</th><th>Admission date</th><th>Date of birth</th><th>Gender</th><th>Roll no.</th><th>Enrollment date</th><th>Result</th></tr></thead><tbody>{preview.rows?.map((row) => <tr key={row.sourceRow}><td>{row.sourceRow}</td><td><strong>{row.values.full_name || "—"}</strong>{row.fieldErrors.full_name?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td>{row.values.admission_number || "—"}{row.fieldErrors.admission_number?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td>{row.values.admission_date || "—"}{row.fieldErrors.admission_date?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td>{row.values.date_of_birth || "—"}{row.fieldErrors.date_of_birth?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td>{row.values.gender || "Not specified"}{row.fieldErrors.gender?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td>{row.values.roll_number || "—"}{row.fieldErrors.roll_number?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td>{row.values.enrollment_date || "—"}{row.fieldErrors.enrollment_date?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td><td><span className={`student-import-status student-import-status-${row.status.toLowerCase()}`}>{row.status}</span>{row.warnings.map((message) => <small className="student-import-warning" key={message}>{message}</small>)}{row.fieldErrors.form?.map((message) => <small className="student-import-error" key={message}>{message}</small>)}</td></tr>)}</tbody></table></div>
      <p className="student-import-footer-note">There is no Import or Confirm action in this phase. Correct the CSV and validate again when any errors are present.</p>
    </section>}
  </div>;
}
