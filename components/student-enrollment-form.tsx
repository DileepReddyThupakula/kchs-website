"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AcademicSubmitButton } from "@/components/academic-submit-button";
import type { StudentFieldErrors } from "@/lib/student-validation";

type Y = { id: string; label: string; status: string };
type C = { id: string; name: string; active: boolean };
type S = { id: string; name: string; academic_year_id: string; class_id: string; active: boolean };
type Initial = { yearId: string; classId: string; sectionId: string; roll: string; date: string; status: string };
export type StudentEnrollmentData = { years: Y[]; classes: C[]; sections: S[] };
type Props = StudentEnrollmentData & { initial?: Initial; submitLabel?: string; cancelHref?: string; showActions?: boolean; allowStatusChange?: boolean; errors?: StudentFieldErrors; onFieldChange?: (field: string) => void };
const errorId = (field: string) => `student-${field.replaceAll("_", "-")}-error`;

export function StudentEnrollmentFields({ years, classes, sections, initial, submitLabel = "Save enrollment", cancelHref, showActions = true, allowStatusChange = Boolean(initial), errors = {}, onFieldChange }: Props) {
  const [year, setYear] = useState(initial?.yearId ?? years.find((item) => item.status === "current")?.id ?? "");
  const [classId, setClass] = useState(initial?.classId ?? "");
  const [sectionId, setSection] = useState(initial?.sectionId ?? "");
  const available = useMemo(() => sections.filter((item) => item.active && item.academic_year_id === year), [sections, year]);
  const classChoices = useMemo(() => classes.filter((item) => item.active && available.some((section) => section.class_id === item.id)), [available, classes]);
  const choices = useMemo(() => available.filter((item) => item.class_id === classId), [available, classId]);
  const message = (field: string) => errors[field]?.[0];
  const field = (fieldName: string, label: string, child: React.ReactNode, required = false) => <label className={message(fieldName) ? "student-field-error" : undefined} htmlFor={`student-${fieldName.replaceAll("_", "-")}`}>{label}{required ? " *" : ""}{child}{message(fieldName) && <span className="student-field-message" id={errorId(fieldName)}>{message(fieldName)}</span>}</label>;
  const attributes = (fieldName: string) => ({ "aria-invalid": Boolean(message(fieldName)), "aria-describedby": message(fieldName) ? errorId(fieldName) : undefined });

  return <section className="student-form-section"><header><p className="academic-kicker">Academic enrollment</p><h2>Enrollment</h2><p>Academic placement is stored separately from the student profile.</p></header><div className="student-form-grid">
    {field("academic_year_id", "Academic year", <select id="student-academic-year-id" name="academic_year_id" value={year} onChange={(event) => { setYear(event.target.value); setClass(""); setSection(""); onFieldChange?.("academic_year_id"); onFieldChange?.("class_id"); onFieldChange?.("academic_section_id"); }} {...attributes("academic_year_id")}><option value="">Select academic year</option>{years.map((item) => <option key={item.id} value={item.id}>{item.label}{item.status === "current" ? " · Current" : ""}</option>)}</select>, true)}
    {field("class_id", "Class", <select id="student-class-id" name="class_id" value={classId} onChange={(event) => { setClass(event.target.value); setSection(""); onFieldChange?.("class_id"); onFieldChange?.("academic_section_id"); }} disabled={!year} {...attributes("class_id")}><option value="">Select class</option>{classChoices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>, true)}
    {field("academic_section_id", "Section", <><select id="student-academic-section-id" name="academic_section_id" value={sectionId} onChange={(event) => { setSection(event.target.value); onFieldChange?.("academic_section_id"); }} disabled={!classId || !choices.length} {...attributes("academic_section_id")}><option value="">Select section</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{year && classId && !choices.length && <span className="student-field-helper">No sections configured for {classChoices.find((item) => item.id === classId)?.name ?? "this class"}.</span>}</>, true)}
    {field("roll_number", "Roll number", <input id="student-roll-number" name="roll_number" defaultValue={initial?.roll ?? ""} maxLength={30} onChange={() => onFieldChange?.("roll_number")} {...attributes("roll_number")} />)}
    {field("enrollment_date", "Enrollment date", <input id="student-enrollment-date" type="date" name="enrollment_date" defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)} onChange={() => onFieldChange?.("enrollment_date")} {...attributes("enrollment_date")} />, true)}
    {allowStatusChange ? field("enrollment_status", "Enrollment status", <select id="student-enrollment-status" name="enrollment_status" defaultValue={initial?.status??"active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="completed">Completed</option><option value="transferred">Transferred</option></select>) : field("enrollment_status", "Enrollment status", <input id="student-enrollment-status" name="enrollment_status" value={initial?.status??"active"} readOnly/>)}
  </div>{showActions && <div className="student-form-actions"><AcademicSubmitButton className="staff-action-submit">{submitLabel}</AcademicSubmitButton>{cancelHref && <Link href={cancelHref}>Cancel</Link>}</div>}</section>;
}
