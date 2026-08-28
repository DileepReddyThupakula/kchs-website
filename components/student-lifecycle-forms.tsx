"use client";

import { completeStudentEnrollment, correctEnrollmentRoll, deactivateStudent, promoteStudent, reactivateStudent, transferStudent } from "@/app/staff/students/actions";
import { AcademicSubmitButton } from "@/components/academic-submit-button";
import { StudentEnrollmentFields } from "@/components/student-enrollment-form";
import type { Enrollment, Student, StudentAcademicData } from "@/lib/students";

type Props = StudentAcademicData & { student: Student; activeEnrollment: Enrollment | null; latestEnrollment: Enrollment | null; enrollments: Enrollment[] };
const today = () => new Date().toISOString().slice(0, 10);

function LifecycleFields({ studentId, enrollmentId, submitLabel, graduate = false }: { studentId: string; enrollmentId: string; submitLabel: string; graduate?: boolean }) {
  return <><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="enrollment_id" value={enrollmentId}/><label>Effective date<input type="date" name="effective_date" defaultValue={today()} required/></label><label>Reason<textarea name="reason" maxLength={500} rows={3}/></label>{graduate&&<label><input type="checkbox" name="graduate"/> Graduate student after completion</label>}<label><input type="checkbox" name="confirm" required/> Confirm this lifecycle change</label><AcademicSubmitButton className="staff-action-submit">{submitLabel}</AcademicSubmitButton></>;
}

export function StudentLifecycleForms({ student, activeEnrollment, latestEnrollment, enrollments, years, classes, sections }: Props) {
  const source = activeEnrollment ?? (latestEnrollment?.status === "completed" ? latestEnrollment : null);
  const targetYears = years.filter((year) => (year.status === "planning" || year.status === "current") && year.id !== source?.academic_year_id);
  const reactivationYears = years.filter((year) => (year.status === "planning" || year.status === "current") && !enrollments.some((enrollment) => enrollment.academic_year_id === year.id));
  const reactivationInitial = { yearId: reactivationYears.find((year) => year.status === "current")?.id ?? reactivationYears[0]?.id ?? "", classId: "", sectionId: "", roll: "", date: today(), status: "active" };

  return <section className="student-detail-card"><p className="academic-kicker">Lifecycle controls</p><h2>Enrollment actions</h2>
    {latestEnrollment&&<details><summary>Correct roll number</summary><form action={correctEnrollmentRoll} className="student-lifecycle-form"><input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="enrollment_id" value={latestEnrollment.id}/><label>Roll number<input name="roll_number" maxLength={30} defaultValue={latestEnrollment.roll_number??""}/></label><label>Correction reason<textarea name="reason" maxLength={500} rows={3} required/></label><AcademicSubmitButton className="staff-action-submit">Save Roll Correction</AcademicSubmitButton></form></details>}
    {student.status==="active"&&source&&targetYears.length>0&&<details><summary>Promote to another academic year</summary><form action={promoteStudent}><input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="source_enrollment_id" value={source.id}/><StudentEnrollmentFields years={targetYears} classes={classes} sections={sections} initial={{yearId:targetYears.find((year)=>year.status==="current")?.id??targetYears[0]?.id??"",classId:"",sectionId:"",roll:"",date:today(),status:"active"}} allowStatusChange={false} showActions={false}/><label><input type="checkbox" name="confirm" required/> Confirm promotion</label><AcademicSubmitButton className="staff-action-submit">Promote Student</AcademicSubmitButton></form></details>}
    {student.status==="active"&&activeEnrollment&&<><details><summary>Complete year or graduate</summary><form action={completeStudentEnrollment} className="student-lifecycle-form"><LifecycleFields studentId={student.id} enrollmentId={activeEnrollment.id} submitLabel="Complete Enrollment" graduate/></form></details><details><summary>Transfer out of school</summary><form action={transferStudent} className="student-lifecycle-form"><LifecycleFields studentId={student.id} enrollmentId={activeEnrollment.id} submitLabel="Transfer Student"/></form></details><details><summary>Deactivate student</summary><form action={deactivateStudent} className="student-lifecycle-form"><LifecycleFields studentId={student.id} enrollmentId={activeEnrollment.id} submitLabel="Deactivate Student"/></form></details></>}
    {(student.status==="inactive"||student.status==="transferred")&&reactivationYears.length>0&&<details><summary>Reactivate student</summary><form action={reactivateStudent}><input type="hidden" name="student_id" value={student.id}/><StudentEnrollmentFields years={reactivationYears} classes={classes} sections={sections} initial={reactivationInitial} allowStatusChange={false} showActions={false}/><label>Reactivation reason<textarea name="reason" maxLength={500} rows={3}/></label><label><input type="checkbox" name="confirm" required/> Confirm reactivation</label><AcademicSubmitButton className="staff-action-submit">Reactivate Student</AcademicSubmitButton></form></details>}
    {(student.status==="inactive"||student.status==="transferred")&&!reactivationYears.length&&<p className="student-field-helper">Reactivation requires an eligible academic year without existing enrollment history.</p>}
    {student.status==="graduated"&&<p className="student-field-helper">Graduated students have no ordinary reactivation path.</p>}
  </section>;
}
