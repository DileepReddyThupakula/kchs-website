"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updateStudentState, type StudentEditState } from "@/app/staff/students/actions";
import { AcademicSubmitButton } from "@/components/academic-submit-button";
import { StudentEditFields } from "@/components/student-edit-fields";
import type { Student } from "@/lib/students";

const initialStudentEditState: StudentEditState = { status: "idle", fieldErrors: {} };

export function StudentEditForm({ student }: { student: Student }) {
  const [state, formAction] = useActionState(updateStudentState, initialStudentEditState);
  const failing = state.status === "error";
  const submittedValues = failing ? state.values : undefined;
  const fieldErrors = failing ? state.fieldErrors : undefined;

  return <form className="student-form" action={formAction} noValidate>
    <input type="hidden" name="id" value={student.id}/>
    {failing && state.message && <p className="academic-feedback academic-feedback-error" role="alert">{state.message}</p>}
    <StudentEditFields student={student} submittedValues={submittedValues} fieldErrors={fieldErrors}/>
    <div className="student-form-actions"><AcademicSubmitButton className="staff-action-submit">Save Changes</AcademicSubmitButton><Link href={`/staff/students/${student.id}`}>Cancel</Link></div>
  </form>;
}
