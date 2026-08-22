import Link from "next/link";
import { notFound } from "next/navigation";

import { updateAssignment, updateSection, updateSubject, updateYear } from "@/app/staff/academics/actions";
import { AcademicAssignmentForm } from "@/components/academic-assignment-form";
import { AcademicSubmitButton } from "@/components/academic-submit-button";
import { academicData } from "@/lib/academics";

type Feedback = { error?: string };

function EditFeedback({ error, fallback }: { error?: string; fallback: string }) {
  if (!error) return null;
  const messages: Record<string, string> = {
    "duplicate-section": "A section with this name already exists for this class and academic year.",
    "duplicate-assignment": "This subject is already assigned to this section.",
    "current-exists": "Another academic year is already current. Update that record first.",
    "duplicate-subject": "A subject with this name or code already exists.",
    invalid: "Please review the required fields and try again.",
  };
  return <p className="academic-feedback academic-feedback-error" role="alert">{messages[error] ?? fallback}</p>;
}

export async function AcademicYearEditor({ id, feedback }: { id: string; feedback: Feedback }) {
  const data = await academicData();
  const year = data.years.find((item) => item.id === id);
  if (!year) notFound();
  return <AcademicEditorShell backHref="/staff/academics/years" backLabel="Academic years" kicker="Academic year" title="Edit academic year" copy="Update this academic year without changing its record identity."><EditFeedback error={feedback.error} fallback="Could not update the academic year. Please try again." /><form className="academic-form academic-form-compact" action={updateYear}><input type="hidden" name="id" value={year.id} /><label>Academic year<input name="label" defaultValue={year.label} required /></label><label>Start date<input name="start_date" type="date" defaultValue={year.start_date} required /></label><label>End date<input name="end_date" type="date" defaultValue={year.end_date} required /></label><label>Status<select name="status" defaultValue={year.status}><option value="planning">Planning</option><option value="current">Current</option><option value="closed">Closed</option></select></label><EditActions cancelHref="/staff/academics/years" /></form></AcademicEditorShell>;
}

export async function AcademicSectionEditor({ id, feedback }: { id: string; feedback: Feedback }) {
  const data = await academicData();
  const section = data.sections.find((item) => item.id === id);
  if (!section) notFound();
  return <AcademicEditorShell backHref="/staff/academics/sections" backLabel="Sections" kicker="Class configuration" title="Edit section" copy="Update the section configuration and class teacher."><EditFeedback error={feedback.error} fallback="Could not update the section. Please try again." /><form className="academic-form" action={updateSection}><input type="hidden" name="id" value={section.id} /><label>Academic year<select name="academic_year_id" defaultValue={section.academic_year_id} required>{data.years.map((year) => <option key={year.id} value={year.id}>{year.label}{year.status === "current" ? " · Current" : ""}</option>)}</select></label><label>Class<select name="class_id" defaultValue={section.class_id} required>{data.classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label><label>Section name<input name="name" defaultValue={section.name} required /></label><label>Class teacher <span>Eligible active teaching staff only</span><select name="class_teacher_id" defaultValue={section.class_teacher_id ?? ""}><option value="">Unassigned</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}{teacher.designation ? ` · ${teacher.designation}` : ""}</option>)}</select></label><EditActions cancelHref="/staff/academics/sections" /></form></AcademicEditorShell>;
}

export async function AcademicSubjectEditor({ id, feedback }: { id: string; feedback: Feedback }) {
  const data = await academicData();
  const subject = data.subjects.find((item) => item.id === id);
  if (!subject) notFound();
  return <AcademicEditorShell backHref="/staff/academics/subjects" backLabel="Subjects" kicker="Teaching catalogue" title="Edit subject" copy="Update subject metadata while preserving existing assignment references."><EditFeedback error={feedback.error} fallback="Could not update the subject. Please try again." /><form className="academic-form academic-form-compact" action={updateSubject}><input type="hidden" name="id" value={subject.id} /><label>Subject name<input name="name" defaultValue={subject.name} required /></label><label>Code<input name="code" defaultValue={subject.code ?? ""} maxLength={20} /></label><label>Display order<input name="display_order" type="number" min="0" defaultValue={subject.display_order} required /></label><label>Status<select name="active" defaultValue={String(subject.active)}><option value="true">Active</option><option value="false">Inactive</option></select></label><EditActions cancelHref="/staff/academics/subjects" /></form></AcademicEditorShell>;
}

export async function AcademicAssignmentEditor({ id, feedback }: { id: string; feedback: Feedback }) {
  const data = await academicData();
  const assignment = data.assignments.find((item) => item.id === id);
  if (!assignment) notFound();
  return <AcademicEditorShell backHref="/staff/academics/assignments" backLabel="Subject assignments" kicker="Teaching allocation" title="Edit subject assignment" copy="Correct the section, subject or teacher while preserving this assignment record."><EditFeedback error={feedback.error} fallback="Could not update the subject assignment. Please try again." /><AcademicAssignmentForm years={data.years} classes={data.classes} sections={data.sections} subjects={data.subjects} teachers={data.teachers} action={updateAssignment} assignmentId={assignment.id} cancelHref="/staff/academics/assignments" submitLabel="Save changes" initialAssignment={{ sectionId: assignment.academic_section_id, subjectId: assignment.subject_id, teacherId: assignment.teacher_id }} /></AcademicEditorShell>;
}

function AcademicEditorShell({ backHref, backLabel, kicker, title, copy, children }: { backHref: string; backLabel: string; kicker: string; title: string; copy: string; children: React.ReactNode }) {
  return <><Link className="staff-back" href={backHref}>← Back to {backLabel.toLowerCase()}</Link><header className="academic-editor-header"><p className="academic-kicker">{kicker}</p><h1>{title}</h1><p>{copy}</p></header>{children}</>;
}

function EditActions({ cancelHref }: { cancelHref: string }) {
  return <div className="academic-form-actions academic-edit-actions"><AcademicSubmitButton className="staff-action-submit">Save changes</AcademicSubmitButton><Link href={cancelHref}>Cancel</Link></div>;
}
