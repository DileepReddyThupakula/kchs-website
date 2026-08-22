"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { AcademicSubmitButton } from "@/components/academic-submit-button";
import type { AcademicSection, AcademicYear, SchoolClass, StaffMember, Subject } from "@/lib/academics/types";

export function AcademicAssignmentForm({ years, classes, sections, subjects, teachers, action, initialAssignment, assignmentId, cancelHref, submitLabel = "Save assignment" }: { years: AcademicYear[]; classes: SchoolClass[]; sections: AcademicSection[]; subjects: Subject[]; teachers: StaffMember[]; action: (formData: FormData) => void | Promise<void>; initialAssignment?: { sectionId: string; subjectId: string; teacherId: string | null }; assignmentId?: string; cancelHref?: string; submitLabel?: string }) {
  const initialSection = initialAssignment ? sections.find((section) => section.id === initialAssignment.sectionId) : undefined;
  const currentYear = initialSection?.academic_year_id ?? years.find((year) => year.status === "current")?.id ?? years[0]?.id ?? "";
  const [yearId, setYearId] = useState(currentYear);
  const availableSections = useMemo(() => sections.filter((section) => section.active && section.academic_year_id === yearId), [sections, yearId]);
  const [classId, setClassId] = useState(initialSection?.class_id ?? availableSections[0]?.class_id ?? "");
  const sectionsForClass = useMemo(() => availableSections.filter((section) => section.class_id === classId), [availableSections, classId]);

  return <form className="academic-form academic-form-assignment" action={action}>{assignmentId && <input type="hidden" name="id" value={assignmentId} />}
    <label>Academic year<select value={yearId} onChange={(event) => { const nextYear = event.target.value; setYearId(nextYear); setClassId(sections.find((section) => section.active && section.academic_year_id === nextYear)?.class_id ?? ""); }} required><option value="" disabled>Select academic year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.label}{year.status === "current" ? " · Current" : ""}</option>)}</select></label>
    <label>Class<select value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!availableSections.length} required><option value="" disabled>Select class</option>{classes.filter((schoolClass) => availableSections.some((section) => section.class_id === schoolClass.id)).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
    <label>Section<select key={`${yearId}-${classId}`} name="academic_section_id" disabled={!sectionsForClass.length} required defaultValue={initialAssignment?.sectionId ?? ""}><option value="" disabled>Select section</option>{sectionsForClass.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
    <label>Subject<select name="subject_id" disabled={!subjects.filter((subject) => subject.active || subject.id === initialAssignment?.subjectId).length} required defaultValue={initialAssignment?.subjectId ?? ""}><option value="" disabled>Select subject</option>{subjects.filter((subject) => subject.active || subject.id === initialAssignment?.subjectId).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` · ${subject.code}` : ""}{subject.active ? "" : " · Inactive"}</option>)}</select></label>
    <label>Teacher <span>Eligible active teaching staff only</span><select name="teacher_id" defaultValue={initialAssignment?.teacherId ?? ""}><option value="">Unassigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}{teacher.designation ? ` · ${teacher.designation}` : ""}</option>)}</select></label>
    <div className="academic-form-actions"><AcademicSubmitButton className="staff-action-submit">{submitLabel}</AcademicSubmitButton>{cancelHref && <Link className="academic-inline-cancel" href={cancelHref}>Cancel</Link>}</div>
  </form>;
}
