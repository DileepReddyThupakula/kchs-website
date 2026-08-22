"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { createStudent, type StudentCreateState } from "@/app/staff/students/actions";
import { AcademicSubmitButton } from "@/components/academic-submit-button";
import { StudentEnrollmentFields, type StudentEnrollmentData } from "@/components/student-enrollment-form";
import { enrollmentSchema, studentSchema, validationErrors, type StudentFieldErrors } from "@/lib/student-validation";

type Props = StudentEnrollmentData;
const initialStudentCreateState: StudentCreateState = { status: "idle", fieldErrors: {} };

const fieldIds: Record<string, string> = {
  full_name: "student-full-name",
  admission_number: "student-admission-number",
  date_of_birth: "student-date-of-birth",
  admission_date: "student-admission-date",
  primary_phone: "student-primary-phone",
  secondary_phone: "student-secondary-phone",
  email: "student-email",
  academic_year_id: "student-academic-year-id",
  class_id: "student-class-id",
  academic_section_id: "student-academic-section-id",
  roll_number: "student-roll-number",
  enrollment_date: "student-enrollment-date",
};

function messageFor(errors: StudentFieldErrors, field: string) {
  return errors[field]?.[0];
}

function Field({ children, error, htmlFor, label, required }: { children: React.ReactNode; error?: string; htmlFor: string; label: string; required?: boolean }) {
  const errorId = `${htmlFor}-error`;
  return <label className={error ? "student-field-error" : undefined} htmlFor={htmlFor}>{label}{required ? " *" : ""}{children}{error && <span className="student-field-message" id={errorId}>{error}</span>}</label>;
}

export function StudentCreateForm({ years, classes, sections }: Props) {
  const [state, formAction] = useActionState(createStudent, initialStudentCreateState);
  const [clientErrors, setClientErrors] = useState<StudentFieldErrors>({});
  const [editedFields, setEditedFields] = useState<string[]>([]);
  const serverErrors = state.status === "error" ? Object.fromEntries(Object.entries(state.fieldErrors).filter(([field]) => !editedFields.includes(field))) : {};
  const errors = { ...serverErrors, ...clientErrors };

  const focusFirstError = (nextErrors: StudentFieldErrors) => {
    const first = Object.keys(nextErrors)[0];
    const id = first ? fieldIds[first] : undefined;
    const element = id ? document.getElementById(id) : null;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => element instanceof HTMLElement && element.focus(), 250);
  };

  useEffect(() => {
    if (state.status === "error" && Object.keys(state.fieldErrors).length) {
      focusFirstError(state.fieldErrors);
    }
  }, [state]);

  const clearField = (field: string) => {
    setClientErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setEditedFields((current) => current.includes(field) ? current : [...current, field]);
  };

  const validateBeforeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const nextErrors = validationErrors(studentSchema.safeParse(values), enrollmentSchema.safeParse(values));
    if (!Object.keys(nextErrors).length) return;
    event.preventDefault();
    setEditedFields([]);
    setClientErrors(nextErrors);
    focusFirstError(nextErrors);
  };

  const error = (field: string) => messageFor(errors, field);
  const describedBy = (field: string) => error(field) ? `${fieldIds[field]}-error` : undefined;

  return <form className="student-form" action={formAction} noValidate onSubmit={validateBeforeSubmit}>
    <p className="student-required-note"><span aria-hidden="true">*</span> Required fields</p>
    {state.status === "error" && <p className="academic-feedback academic-feedback-error" role="alert">{state.message}</p>}
    <section className="student-form-section"><header><p className="academic-kicker">Student photo / identity</p><h2>Student information</h2><p>Upload an optional JPEG, PNG or WebP profile photo up to 4 MB.</p></header><div className="student-form-grid"><Field htmlFor="student-photo" label="Upload photo"><input id="student-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></Field><Field htmlFor="student-preferred-name" label="Preferred name"><input id="student-preferred-name" name="preferred_name" /></Field><Field htmlFor="student-blood-group" label="Blood group"><select id="student-blood-group" name="blood_group"><option value="">Not specified</option><option value="a_positive">A+</option><option value="a_negative">A-</option><option value="b_positive">B+</option><option value="b_negative">B-</option><option value="ab_positive">AB+</option><option value="ab_negative">AB-</option><option value="o_positive">O+</option><option value="o_negative">O-</option><option value="unknown">Unknown</option></select></Field></div></section><section className="student-form-section"><header><p className="academic-kicker">Personal information</p><h2>Student profile</h2></header><div className="student-form-grid">
      <Field htmlFor={fieldIds.full_name} label="Student name" required error={error("full_name")}><input id={fieldIds.full_name} name="full_name" aria-invalid={Boolean(error("full_name"))} aria-describedby={describedBy("full_name")} onChange={() => clearField("full_name")} /></Field>
      <Field htmlFor={fieldIds.admission_number} label="Admission number" required error={error("admission_number")}><input id={fieldIds.admission_number} name="admission_number" aria-invalid={Boolean(error("admission_number"))} aria-describedby={describedBy("admission_number")} onChange={() => clearField("admission_number")} /></Field>
      <Field htmlFor={fieldIds.date_of_birth} label="Date of birth" error={error("date_of_birth")}><input id={fieldIds.date_of_birth} type="date" name="date_of_birth" aria-invalid={Boolean(error("date_of_birth"))} aria-describedby={describedBy("date_of_birth")} onChange={() => clearField("date_of_birth")} /></Field>
      <Field htmlFor="student-gender" label="Gender"><select id="student-gender" name="gender"><option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="not_specified">Prefer not to say</option></select></Field>
      <Field htmlFor={fieldIds.admission_date} label="Admission date" required error={error("admission_date")}><input id={fieldIds.admission_date} type="date" name="admission_date" defaultValue={new Date().toISOString().slice(0, 10)} aria-invalid={Boolean(error("admission_date"))} aria-describedby={describedBy("admission_date")} onChange={() => clearField("admission_date")} /></Field>
      <Field htmlFor="student-status" label="Status" required><select id="student-status" name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option><option value="transferred">Transferred</option></select></Field>
      <Field htmlFor="student-category" label="Student category"><input id="student-category" name="student_category" /></Field><Field htmlFor="student-nationality" label="Nationality"><input id="student-nationality" name="nationality" defaultValue="Indian" /></Field><Field htmlFor="student-mother-tongue" label="Mother tongue"><input id="student-mother-tongue" name="mother_tongue" /></Field><Field htmlFor="student-aadhaar" label="Aadhaar number" error={error("aadhaar_number")}><input id="student-aadhaar" name="aadhaar_number" inputMode="numeric" maxLength={12} aria-invalid={Boolean(error("aadhaar_number"))} aria-describedby={describedBy("aadhaar_number")} onChange={() => clearField("aadhaar_number")} /></Field>
    </div></section>
    <section className="student-form-section"><header><p className="academic-kicker">Admission information</p><h2>Previous school</h2></header><div className="student-form-grid"><Field htmlFor="student-previous-school" label="Previous school name"><input id="student-previous-school" name="previous_school_name" /></Field><Field htmlFor="student-previous-class" label="Previous class"><input id="student-previous-class" name="previous_class" /></Field><Field htmlFor="student-previous-tc" label="Previous school TC number"><input id="student-previous-tc" name="previous_school_tc_number" /></Field><Field htmlFor="student-previous-location" label="Previous school location"><input id="student-previous-location" name="previous_school_location" /></Field><Field htmlFor="student-admission-remarks" label="Remarks"><input id="student-admission-remarks" name="admission_remarks" /></Field></div></section>
    <section className="student-form-section"><header><p className="academic-kicker">Parent / guardian information</p><h2>Contacts</h2></header><div className="student-form-grid">
      <Field htmlFor="student-father" label="Father / guardian name"><input id="student-father" name="father_guardian_name" /></Field><Field htmlFor="student-mother" label="Mother name"><input id="student-mother" name="mother_name" /></Field><Field htmlFor={fieldIds.primary_phone} label="Primary phone" error={error("primary_phone")}><input id={fieldIds.primary_phone} name="primary_phone" inputMode="tel" aria-invalid={Boolean(error("primary_phone"))} aria-describedby={describedBy("primary_phone")} onChange={() => clearField("primary_phone")} /></Field><Field htmlFor={fieldIds.secondary_phone} label="Secondary phone" error={error("secondary_phone")}><input id={fieldIds.secondary_phone} name="secondary_phone" inputMode="tel" aria-invalid={Boolean(error("secondary_phone"))} aria-describedby={describedBy("secondary_phone")} onChange={() => clearField("secondary_phone")} /></Field><Field htmlFor={fieldIds.email} label="Email" error={error("email")}><input id={fieldIds.email} name="email" type="email" aria-invalid={Boolean(error("email"))} aria-describedby={describedBy("email")} onChange={() => clearField("email")} /></Field>
      <Field htmlFor="student-father-name" label="Father name"><input id="student-father-name" name="father_name" /></Field><Field htmlFor="student-father-mobile" label="Father mobile"><input id="student-father-mobile" name="father_mobile" inputMode="tel" /></Field><Field htmlFor="student-father-email" label="Father email"><input id="student-father-email" name="father_email" type="email" /></Field><Field htmlFor="student-father-occupation" label="Father occupation"><input id="student-father-occupation" name="father_occupation" /></Field><Field htmlFor="student-mother-mobile" label="Mother mobile"><input id="student-mother-mobile" name="mother_mobile" inputMode="tel" /></Field><Field htmlFor="student-mother-email" label="Mother email"><input id="student-mother-email" name="mother_email" type="email" /></Field><Field htmlFor="student-mother-occupation" label="Mother occupation"><input id="student-mother-occupation" name="mother_occupation" /></Field><Field htmlFor="student-guardian-name" label="Guardian name"><input id="student-guardian-name" name="guardian_name" /></Field><Field htmlFor="student-guardian-relationship" label="Guardian relationship"><input id="student-guardian-relationship" name="guardian_relationship" /></Field><Field htmlFor="student-guardian-mobile" label="Guardian mobile"><input id="student-guardian-mobile" name="guardian_mobile" inputMode="tel" /></Field><Field htmlFor="student-guardian-email" label="Guardian email"><input id="student-guardian-email" name="guardian_email" type="email" /></Field><Field htmlFor="student-primary-contact" label="Primary contact"><select id="student-primary-contact" name="primary_contact"><option value="">Not specified</option><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option></select></Field><Field htmlFor="student-emergency-name" label="Emergency contact name"><input id="student-emergency-name" name="emergency_contact_name" /></Field><Field htmlFor="student-emergency-relationship" label="Emergency relationship"><input id="student-emergency-relationship" name="emergency_contact_relationship" /></Field><Field htmlFor="student-emergency-mobile" label="Emergency mobile"><input id="student-emergency-mobile" name="emergency_contact_mobile" inputMode="tel" /></Field>
    </div></section>
    <section className="student-form-section"><header><p className="academic-kicker">Address</p><h2>Residence</h2></header><div className="student-form-grid">
      <Field htmlFor="student-address-1" label="Address line 1"><input id="student-address-1" name="address_line_1" /></Field><Field htmlFor="student-address-2" label="Address line 2"><input id="student-address-2" name="address_line_2" /></Field><Field htmlFor="student-locality" label="Area / locality"><input id="student-locality" name="locality" /></Field><Field htmlFor="student-city" label="City / town"><input id="student-city" name="city" /></Field><Field htmlFor="student-state" label="State"><input id="student-state" name="state" defaultValue="Andhra Pradesh" /></Field><Field htmlFor="student-postal-code" label="Postal code" error={error("postal_code")}><input id="student-postal-code" name="postal_code" inputMode="numeric" aria-invalid={Boolean(error("postal_code"))} aria-describedby={describedBy("postal_code")} onChange={() => clearField("postal_code")} /></Field>
      <Field htmlFor="student-door" label="Door / house no."><input id="student-door" name="door_number" /></Field><Field htmlFor="student-street" label="Street"><input id="student-street" name="street" /></Field><Field htmlFor="student-area" label="Area / locality"><input id="student-area" name="area_locality" /></Field><Field htmlFor="student-village" label="Village / town / city"><input id="student-village" name="village_town_city" /></Field><Field htmlFor="student-mandal" label="Mandal"><input id="student-mandal" name="mandal" /></Field><Field htmlFor="student-district" label="District"><input id="student-district" name="district" /></Field>
    </div></section>
    <section className="student-form-section"><header><p className="academic-kicker">Additional information</p><h2>School details</h2></header><div className="student-form-grid"><Field htmlFor="student-mark-1" label="Identification mark 1"><input id="student-mark-1" name="identification_mark_1" /></Field><Field htmlFor="student-mark-2" label="Identification mark 2"><input id="student-mark-2" name="identification_mark_2" /></Field><label htmlFor="student-transport">Transport required<input id="student-transport" name="transport_required" type="checkbox" /></label><Field htmlFor="student-general-notes" label="General notes"><textarea id="student-general-notes" name="general_notes" rows={4} /></Field></div></section>
    <StudentEnrollmentFields years={years} classes={classes} sections={sections} showActions={false} errors={errors} onFieldChange={clearField} />
    <div className="student-form-actions"><AcademicSubmitButton className="staff-action-submit">Create Student</AcademicSubmitButton><Link href="/staff/students">Cancel</Link></div>
  </form>;
}
