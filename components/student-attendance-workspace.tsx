"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  lockStudentAttendance,
  saveStudentAttendance,
  unlockStudentAttendance,
} from "@/app/staff/attendance/actions";
import type { AttendanceConfiguration, AttendanceRoster, AttendanceRosterRow, AttendanceStatus } from "@/lib/student-attendance";
import { initialAttendanceActionState, type AttendanceActionState } from "@/lib/student-attendance-action-state";

type WorkspaceProps = {
  configuration: AttendanceConfiguration;
  resolved: { academicYearId?: string; classId?: string; sectionId?: string; attendanceDate: string };
  roster: AttendanceRoster | null;
  rosterError?: string;
};

type EditableRow = Pick<AttendanceRosterRow, "student_enrollment_id" | "status" | "remark"> & Pick<AttendanceRosterRow, "admission_number" | "full_name">;
const labels: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };

function rowsFromRoster(roster: AttendanceRoster | null): EditableRow[] {
  return (roster?.rows ?? []).map((row) => ({
    admission_number: row.admission_number,
    full_name: row.full_name,
    remark: row.remark,
    status: row.status,
    student_enrollment_id: row.student_enrollment_id,
  }));
}

function rowsMatch(left: EditableRow[], right: EditableRow[]) {
  return left.length === right.length && left.every((row, index) => row.student_enrollment_id === right[index]?.student_enrollment_id && row.status === right[index]?.status && (row.remark ?? "") === (right[index]?.remark ?? ""));
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function AttendanceSubmitButton({ children, disabled = false, pending, pendingChildren }: { children: React.ReactNode; disabled?: boolean; pending: boolean; pendingChildren: string }) { return <button className="staff-action-submit" disabled={disabled || pending} type="submit">{pending ? pendingChildren : children}</button>; }

export function StudentAttendanceWorkspace({ configuration, resolved, roster, rosterError }: WorkspaceProps) {
  const key = `${resolved.academicYearId ?? ""}:${resolved.classId ?? ""}:${resolved.sectionId ?? ""}:${resolved.attendanceDate}`;
  return <AttendanceWorkspaceEditor key={key} configuration={configuration} resolved={resolved} roster={roster} rosterError={rosterError}/>;
}

function AttendanceWorkspaceEditor({ configuration, resolved, roster, rosterError }: WorkspaceProps) {
  const initialRows = useMemo(() => rowsFromRoster(roster), [roster]);
  const [rows, setRows] = useState(initialRows);
  const [savedRows, setSavedRows] = useState(initialRows);
  const [revision, setRevision] = useState(roster?.revision ?? 0);
  const [sessionId, setSessionId] = useState(roster?.session_id ?? null);
  const [sessionState, setSessionState] = useState<"open" | "locked">(roster?.state ?? "open");
  const [correctionReason, setCorrectionReason] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [selectedYear, setSelectedYear] = useState(resolved.academicYearId ?? "");
  const [selectedClass, setSelectedClass] = useState(resolved.classId ?? "");
  const [selectedSection, setSelectedSection] = useState(resolved.sectionId ?? "");
  const [feedback, setFeedback] = useState(initialAttendanceActionState);
  const [pending, startTransition] = useTransition();
  const dirty = !rowsMatch(rows, savedRows);
  const locked = sessionState === "locked";
  const isHistorical = Boolean(resolved.attendanceDate && resolved.attendanceDate < todayInIndia());
  const requiresCorrectionReason = Boolean(sessionId && isHistorical && dirty);
  const scopedClasses = configuration.classes.filter((item) => configuration.sections.some((section) => section.academic_year_id === selectedYear && section.class_id === item.id));
  const scopedSections = configuration.sections.filter((section) => section.academic_year_id === selectedYear && section.class_id === selectedClass);
  const reloadHref = `/staff/attendance?${new URLSearchParams({ year: resolved.academicYearId ?? "", class: resolved.classId ?? "", section: resolved.sectionId ?? "", date: resolved.attendanceDate }).toString()}`;
  const applySuccess = (result: AttendanceActionState, afterSuccess?: () => void) => {
    setFeedback(result);
    if (result.kind !== "success") return;
    if (typeof result.revision === "number") setRevision(result.revision);
    if (result.sessionId) setSessionId(result.sessionId);
    if (result.state) setSessionState(result.state);
    afterSuccess?.();
  };
  const submitSave = (formData: FormData) => startTransition(async () => applySuccess(await saveStudentAttendance(initialAttendanceActionState, formData), () => { setSavedRows(rows); setCorrectionReason(""); }));
  const submitLock = (formData: FormData) => startTransition(async () => applySuccess(await lockStudentAttendance(initialAttendanceActionState, formData)));
  const submitUnlock = (formData: FormData) => startTransition(async () => applySuccess(await unlockStudentAttendance(initialAttendanceActionState, formData), () => setUnlockReason("")));

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const updateRow = (id: string, update: Partial<Pick<EditableRow, "status" | "remark">>) => {
    setRows((current) => current.map((row) => row.student_enrollment_id === id ? { ...row, ...update } : row));
  };
  const counts = rows.reduce<Record<AttendanceStatus | "total", number>>((summary, row) => ({ ...summary, total: summary.total + 1, [row.status]: summary[row.status] + 1 }), { total: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const payload = JSON.stringify(rows.map((row) => ({ enrollment_id: row.student_enrollment_id, remark: row.remark || undefined, status: row.status })));
  const confirmNavigation = () => !dirty || window.confirm("You have unsaved attendance changes. Load a different roster without saving?");

  return <>
    <header className="staff-page-header attendance-header">
      <div><p className="eyebrow">Student management</p><h1>Student Attendance</h1><p>Record daily attendance against the authoritative enrollment roster.</p></div>
      <div className="attendance-session-state"><span>Session state</span><strong className={`attendance-state attendance-state-${sessionState}`}>{sessionState === "locked" ? "Locked" : "Open"}</strong></div>
    </header>

    <section className="attendance-selection" aria-labelledby="attendance-selection-heading">
      <header><p className="academic-kicker">Roster selection</p><h2 id="attendance-selection-heading">Choose a class and date</h2></header>
      <form action="/staff/attendance" onSubmit={(event) => { if (!confirmNavigation()) event.preventDefault(); }}>
        <label>Academic year<select name="year" onChange={(event) => { const nextYear = event.target.value; setSelectedYear(nextYear); const nextClass = configuration.classes.find((item) => configuration.sections.some((section) => section.academic_year_id === nextYear && section.class_id === item.id))?.id ?? ""; setSelectedClass(nextClass); setSelectedSection(configuration.sections.find((section) => section.academic_year_id === nextYear && section.class_id === nextClass)?.id ?? ""); }} required value={selectedYear}><option value="" disabled>Select academic year</option>{configuration.years.map((year) => <option key={year.id} value={year.id}>{year.label}{year.status === "current" ? " · Current" : ""}</option>)}</select></label>
        <label>Class<select name="class" onChange={(event) => { const nextClass = event.target.value; setSelectedClass(nextClass); setSelectedSection(configuration.sections.find((section) => section.academic_year_id === selectedYear && section.class_id === nextClass)?.id ?? ""); }} required value={selectedClass}><option value="" disabled>Select class</option>{scopedClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Section<select name="section" onChange={(event) => setSelectedSection(event.target.value)} required value={selectedSection}><option value="" disabled>Select section</option>{scopedSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
        <label>Date<input defaultValue={resolved.attendanceDate} max={todayInIndia()} name="date" required type="date" /></label>
        <button type="submit">Load roster</button>
      </form>
    </section>

    {rosterError && <p className="academic-feedback academic-feedback-error" role="alert">{rosterError}</p>}
    {!rosterError && roster && <section className="attendance-workspace" aria-labelledby="attendance-roster-heading">
      {feedback.message && <div className={`attendance-feedback attendance-feedback-${feedback.kind}`} role={feedback.kind === "success" ? "status" : "alert"}>{feedback.message}{(feedback.kind === "stale" || feedback.kind === "locked") && <Link href={reloadHref} onClick={(event) => { if (!confirmNavigation()) event.preventDefault(); }}>Reload roster</Link>}</div>}
      <header className="attendance-roster-header">
        <div><p className="academic-kicker">Daily register</p><h2 id="attendance-roster-heading">{rows.length ? `${counts.total} student${counts.total === 1 ? "" : "s"} on this roster` : "No eligible students"}</h2><p>{locked ? "This session is locked and cannot be edited until an administrator unlocks it." : sessionId ? `Revision ${revision} · save the complete roster together.` : "This unsaved roster defaults to Present. No attendance record exists until it is saved."}</p></div>
        {!locked && rows.length > 0 && <button className="attendance-mark-present" onClick={() => setRows((current) => current.map((row) => ({ ...row, status: "present" })))} type="button">Mark all present</button>}
      </header>
      <div className="attendance-counts" aria-label="Attendance counts"><Count label="Total" value={counts.total}/>{(Object.keys(labels) as AttendanceStatus[]).map((status) => <Count key={status} label={labels[status]} value={counts[status]} tone={status}/>)}</div>

      {rows.length ? <form className="attendance-save-form" onSubmit={(event) => { event.preventDefault(); submitSave(new FormData(event.currentTarget)); }}>
        <input name="academic_year_id" type="hidden" value={resolved.academicYearId}/><input name="class_id" type="hidden" value={resolved.classId}/><input name="academic_section_id" type="hidden" value={resolved.sectionId}/><input name="attendance_date" type="hidden" value={resolved.attendanceDate}/><input name="expected_revision" type="hidden" value={revision}/><input name="records" type="hidden" value={payload}/>
        <div className="attendance-row-heading" aria-hidden="true"><span>Student</span><span>Status</span><span>Optional remark</span></div>
        <div className="attendance-rows">{rows.map((row) => <article key={row.student_enrollment_id} className="attendance-row"><div><p>{row.admission_number}</p><h3>{row.full_name}</h3></div><label><span className="attendance-sr-only">Status for {row.full_name}</span><select aria-label={`Attendance status for ${row.full_name}`} disabled={locked} onChange={(event) => updateRow(row.student_enrollment_id, { status: event.target.value as AttendanceStatus })} value={row.status}>{(Object.keys(labels) as AttendanceStatus[]).map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></label><label><span className="attendance-sr-only">Remark for {row.full_name}</span><input aria-label={`Optional remark for ${row.full_name}`} disabled={locked} maxLength={500} onChange={(event) => updateRow(row.student_enrollment_id, { remark: event.target.value })} placeholder="Optional remark" value={row.remark ?? ""}/></label></article>)}</div>
        {requiresCorrectionReason && <label className="attendance-reason">Correction reason <span>Required for changes to a previous-day record.</span><textarea maxLength={1000} name="correction_reason" onChange={(event) => setCorrectionReason(event.target.value)} required value={correctionReason}/></label>}
        <div className="attendance-save-actions"><AttendanceSubmitButton disabled={locked || (requiresCorrectionReason && !correctionReason.trim()) || !dirty} pending={pending} pendingChildren="Saving attendance…">Save attendance</AttendanceSubmitButton>{dirty && <span>Unsaved changes</span>}{!dirty && sessionId && <span>All changes saved</span>}</div>
      </form> : <div className="academic-empty"><span aria-hidden="true">◇</span><h3>No eligible students</h3><p>There are no enrolled students for this class, section, and date.</p></div>}

      {sessionId && <section className="attendance-lock-panel" aria-labelledby="attendance-lock-heading"><header><p className="academic-kicker">Register controls</p><h2 id="attendance-lock-heading">{locked ? "Unlock attendance" : "Lock attendance"}</h2><p>{locked ? "Provide an audit reason to allow further changes." : "Lock this saved register when daily attendance is final."}</p></header>{locked ? <form onSubmit={(event) => { event.preventDefault(); submitUnlock(new FormData(event.currentTarget)); }}><input name="session_id" type="hidden" value={sessionId}/><input name="expected_revision" type="hidden" value={revision}/><label>Unlock reason<textarea maxLength={1000} name="unlock_reason" onChange={(event) => setUnlockReason(event.target.value)} required value={unlockReason}/></label><AttendanceSubmitButton disabled={!unlockReason.trim()} pending={pending} pendingChildren="Unlocking…">Unlock attendance</AttendanceSubmitButton></form> : <form onSubmit={(event) => { event.preventDefault(); if (dirty && !window.confirm("Save or discard unsaved changes before locking this attendance session. Continue locking the saved register?")) return; submitLock(new FormData(event.currentTarget)); }}><input name="session_id" type="hidden" value={sessionId}/><input name="expected_revision" type="hidden" value={revision}/><AttendanceSubmitButton disabled={dirty} pending={pending} pendingChildren="Locking…">Lock attendance</AttendanceSubmitButton>{dirty && <p>Save or reload unsaved changes before locking.</p>}</form>}</section>}
    </section>}
    {!rosterError && !roster && <section className="academic-empty"><span aria-hidden="true">◇</span><h3>Attendance setup needed</h3><p>Create an eligible academic year, class, and section before taking attendance.</p></section>}
  </>;
}

function Count({ label, value, tone }: { label: string; value: number; tone?: AttendanceStatus }) { return <article className={tone ? `attendance-count attendance-count-${tone}` : "attendance-count"}><span>{label}</span><strong>{value}</strong></article>; }
