"use client";

import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "@/app/admissions/actions";

const classes = ["Nursery", "LKG", "UKG", ...Array.from({ length: 10 }, (_, index) => `Class ${index + 1}`)];

export default function AdmissionForm() {
  const initialState: EnquiryState = { status: "idle" };
  const [state, formAction, pending] = useActionState(submitEnquiry, initialState);
  const error = (field: keyof NonNullable<typeof state.errors>) => state.errors?.[field];
  return <form action={formAction} className="enquiry-form" noValidate>
    <div className="form-heading"><p className="eyebrow">Admission Enquiry</p><h2>Tell us about<br /><em>your child.</em></h2><p>Fields marked <b>*</b> are required.</p></div>
    <div className="form-grid">
      <div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label>Parent / Guardian Name <b>*</b><input name="guardianName" autoComplete="name" aria-invalid={Boolean(error("guardianName"))} aria-describedby={error("guardianName") ? "guardianName-error" : undefined} />{error("guardianName") && <small id="guardianName-error" className="field-error">{error("guardianName")}</small>}</label>
      <label>Student Name <b>*</b><input name="studentName" autoComplete="off" aria-invalid={Boolean(error("studentName"))} aria-describedby={error("studentName") ? "studentName-error" : undefined} />{error("studentName") && <small id="studentName-error" className="field-error">{error("studentName")}</small>}</label>
      <label>Class Seeking Admission <b>*</b><select name="classSeeking" defaultValue="" aria-invalid={Boolean(error("classSeeking"))} aria-describedby={error("classSeeking") ? "classSeeking-error" : undefined}><option value="" disabled>Select a class</option>{classes.map((item) => <option key={item}>{item}</option>)}</select>{error("classSeeking") && <small id="classSeeking-error" className="field-error">{error("classSeeking")}</small>}</label>
      <label>Phone Number <b>*</b><input name="phoneNumber" autoComplete="tel" inputMode="tel" aria-invalid={Boolean(error("phoneNumber"))} aria-describedby={error("phoneNumber") ? "phoneNumber-error" : undefined} />{error("phoneNumber") && <small id="phoneNumber-error" className="field-error">{error("phoneNumber")}</small>}</label>
      <label>Email Address <span>(optional)</span><input name="emailAddress" type="email" autoComplete="email" inputMode="email" aria-invalid={Boolean(error("emailAddress"))} aria-describedby={error("emailAddress") ? "emailAddress-error" : undefined} />{error("emailAddress") && <small id="emailAddress-error" className="field-error">{error("emailAddress")}</small>}</label>
      <label className="full-width">Message / Additional Information <span>(optional)</span><textarea name="message" rows={4} /></label>
    </div>
    <div className="form-footer"><button className="button gold" disabled={pending} type="submit">{pending ? "Submitting…" : "Submit Enquiry"} <span>→</span></button>{state.status !== "idle" && <p role="status" aria-live="polite" className={`form-status form-status--${state.status}`}>{state.message}</p>}</div>
  </form>;
}
