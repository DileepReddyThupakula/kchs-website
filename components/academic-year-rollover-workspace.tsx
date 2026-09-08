"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { executeAcademicYearRolloverAction, preflightAcademicYearRolloverAction } from "@/app/staff/academics/rollover/actions";
import type {
  AcademicRolloverExecutionResult,
  AcademicRolloverPlan,
  AcademicRolloverPreview,
  AcademicRolloverWorkspaceData,
  RolloverError,
} from "@/lib/academic-year-rollover";

type Outcome = "promote" | "repeat" | "graduate" | "exclude";
type PendingAction = "preflight" | "execute" | null;
type RolloverRow = AcademicRolloverWorkspaceData["sourceEnrollments"][number] & {
  outcome: Outcome;
  targetClassId: string;
  targetSectionId: string;
  targetRollNumber: string;
  reason: string;
};

const outcomes: { value: Outcome; label: string }[] = [
  { value: "promote", label: "Promote" },
  { value: "repeat", label: "Repeat" },
  { value: "graduate", label: "Graduate" },
  { value: "exclude", label: "Exclude" },
];

const blockerLabels: Record<string, string> = {
  duplicate_students: "A student appears more than once in the proposed plan.",
  duplicate_source_enrollments: "A source enrollment appears more than once in the proposed plan.",
  duplicate_target_rolls: "Two students use the same normalized roll number in one target section.",
  unresolved_exclusions: "One or more students are explicitly excluded from the rollover.",
  source_enrollment_mismatch: "The selected student and source enrollment do not match.",
  source_plan_incomplete: "The plan does not account for every active source enrollment.",
  stale_source_enrollment: "A source enrollment is no longer active or has changed.",
  target_class_inactive: "A selected target class is inactive.",
  target_placement_prohibited: "This outcome cannot include a target placement.",
  target_placement_required: "A target class and section are required.",
  target_roll_conflict: "The target roll number is already used in that section.",
  target_section_invalid: "The selected target section is not valid for this target year and class.",
  target_year_order_invalid: "The target year is not after the current year.",
  target_year_not_planning: "The target academic year is no longer planning.",
};

function initialRows(data: AcademicRolloverWorkspaceData): RolloverRow[] {
  return data.sourceEnrollments.map((enrollment) => ({
    ...enrollment,
    outcome: "promote",
    targetClassId: "",
    targetSectionId: "",
    targetRollNumber: "",
    reason: "",
  }));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function errorTitle(error: RolloverError) {
  switch (error.category) {
    case "validation": return "Review the rollover plan";
    case "forbidden": return "Administrator access required";
    case "stale_preview": return "Preview is no longer current";
    case "blocker": return "Rollover is blocked";
    case "conflict": return "Academic data changed during the operation";
    case "not_found": return "Academic record not found";
    default: return "Rollover could not be completed";
  }
}

function safeError(message = "The rollover workspace could not complete that request. Please try again."): RolloverError {
  return { category: "database", message };
}

function blockerLabel(code: string) {
  return blockerLabels[code] ?? `Authoritative blocker: ${code}`;
}

export function AcademicYearRolloverWorkspace({ data }: { data: AcademicRolloverWorkspaceData }) {
  const [targetYearId, setTargetYearId] = useState(data.targetYears[0]?.id ?? "");
  const [rows, setRows] = useState<RolloverRow[]>(() => initialRows(data));
  const [search, setSearch] = useState("");
  const [sourceClassId, setSourceClassId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | Outcome>("all");
  const [bulkOutcome, setBulkOutcome] = useState<Outcome>("promote");
  const [preview, setPreview] = useState<AcademicRolloverPreview | null>(null);
  const [preflightPlan, setPreflightPlan] = useState<AcademicRolloverPlan | null>(null);
  const [error, setError] = useState<RolloverError | null>(null);
  const [completed, setCompleted] = useState<AcademicRolloverExecutionResult | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const classById = useMemo(() => new Map(data.classes.map((schoolClass) => [schoolClass.id, schoolClass])), [data.classes]);
  const sectionById = useMemo(() => new Map(data.sections.map((section) => [section.id, section])), [data.sections]);
  const targetYearById = useMemo(() => new Map(data.targetYears.map((year) => [year.id, year])), [data.targetYears]);
  const sourceClassIds = useMemo(() => [...new Set(rows.map((row) => row.class_id))], [rows]);
  const sourceSectionIds = useMemo(() => [...new Set(rows.filter((row) => !sourceClassId || row.class_id === sourceClassId).map((row) => row.academic_section_id))], [rows, sourceClassId]);
  const targetSections = useMemo(() => data.sections.filter((section) => section.academic_year_id === targetYearId && section.active), [data.sections, targetYearId]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceClassId && row.class_id !== sourceClassId) return false;
      if (sourceSectionId && row.academic_section_id !== sourceSectionId) return false;
      if (outcomeFilter !== "all" && row.outcome !== outcomeFilter) return false;
      if (!query) return true;
      return [row.student?.admission_number, row.student?.full_name, classById.get(row.class_id)?.name, sectionById.get(row.academic_section_id)?.name]
        .filter(Boolean).some((value) => value!.toLowerCase().includes(query));
    });
  }, [classById, outcomeFilter, rows, search, sectionById, sourceClassId, sourceSectionId]);

  const summary = useMemo(() => {
    const counts = { total: rows.length, promote: 0, repeat: 0, graduate: 0, exclude: 0, incomplete: 0 };
    for (const row of rows) {
      counts[row.outcome] += 1;
      if ((row.outcome === "promote" || row.outcome === "repeat") && (!row.targetClassId || !row.targetSectionId)) counts.incomplete += 1;
    }
    return counts;
  }, [rows]);

  const plan = useMemo<AcademicRolloverPlan | null>(() => {
    if (!data.sourceYear || !targetYearId) return null;
    return {
      sourceAcademicYearId: data.sourceYear.id,
      targetAcademicYearId: targetYearId,
      items: rows.map((row) => ({
        studentId: row.student_id,
        sourceEnrollmentId: row.id,
        outcome: row.outcome,
        targetClassId: row.outcome === "promote" || row.outcome === "repeat" ? row.targetClassId || null : null,
        targetSectionId: row.outcome === "promote" || row.outcome === "repeat" ? row.targetSectionId || null : null,
        targetRollNumber: row.outcome === "promote" || row.outcome === "repeat" ? row.targetRollNumber.trim() || null : null,
        reason: row.reason.trim() || null,
      })),
    };
  }, [data.sourceYear, rows, targetYearId]);

  const planComplete = Boolean(plan && plan.items.length === data.sourceEnrollments.length && summary.incomplete === 0);
  const sourceLabel = data.sourceYear?.label ?? "No current year";
  const targetLabel = targetYearById.get(targetYearId)?.label ?? "Select a target year";

  function invalidatePreview() {
    setPreview(null);
    setPreflightPlan(null);
    setError(null);
    setCompleted(null);
  }

  function editRows(updater: (current: RolloverRow[]) => RolloverRow[]) {
    setRows(updater);
    invalidatePreview();
  }

  function updateRow(id: string, patch: Partial<RolloverRow>) {
    editRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function updateOutcome(row: RolloverRow, nextOutcome: Outcome) {
    updateRow(row.id, {
      outcome: nextOutcome,
      ...(nextOutcome === "graduate" || nextOutcome === "exclude" ? { targetClassId: "", targetSectionId: "", targetRollNumber: "" } : {}),
    });
  }

  function updateTargetYear(nextYearId: string) {
    setTargetYearId(nextYearId);
    editRows((current) => current.map((row) => ({ ...row, targetClassId: "", targetSectionId: "", targetRollNumber: "" })));
  }

  function applyBulkOutcome() {
    const visibleIds = new Set(filteredRows.map((row) => row.id));
    editRows((current) => current.map((row) => visibleIds.has(row.id) ? {
      ...row,
      outcome: bulkOutcome,
      ...(bulkOutcome === "graduate" || bulkOutcome === "exclude" ? { targetClassId: "", targetSectionId: "", targetRollNumber: "" } : {}),
    } : row));
  }

  async function runPreflight() {
    if (!plan || !planComplete) {
      setError({ category: "validation", message: "Assign a target class and section for every promote or repeat row before preflight." });
      return;
    }
    setPending("preflight");
    setError(null);
    setCompleted(null);
    setPreview(null);
    setPreflightPlan(null);
    try {
      const result = await preflightAcademicYearRolloverAction(plan);
      if (result.ok) {
        setPreview(result.data);
        setPreflightPlan(plan);
      } else setError(result.error);
    } catch {
      setError(safeError());
    } finally {
      setPending(null);
    }
  }

  async function executeRollover() {
    if (!preview?.ready || !preflightPlan) return;
    setConfirmationOpen(false);
    setPending("execute");
    setError(null);
    try {
      const result = await executeAcademicYearRolloverAction({ ...preflightPlan, expectedFingerprint: preview.fingerprint });
      if (result.ok) {
        setCompleted(result.data);
        setPreview(null);
        setPreflightPlan(null);
      } else {
        setError(result.error);
        if (result.error.category === "stale_preview") {
          setPreview(null);
          setPreflightPlan(null);
        }
      }
    } catch {
      setError(safeError());
    } finally {
      setPending(null);
    }
  }

  if (data.failed) return <section className="rollover-empty" role="alert"><p className="academic-kicker">Academic operations</p><h1>Rollover workspace unavailable</h1><p>We could not read the academic structure. Refresh the page and try again.</p><Link className="rollover-secondary-button" href="/staff/academics/rollover">Refresh workspace</Link></section>;
  if (!data.sourceYear) return <section className="rollover-empty"><p className="academic-kicker">Academic operations</p><h1>Set a current academic year first</h1><p>The rollover workspace only operates from the authoritative current academic year.</p><Link className="rollover-secondary-button" href="/staff/academics/years">Manage academic years</Link></section>;
  if (!data.targetYears.length) return <section className="rollover-empty"><p className="academic-kicker">Current year · {data.sourceYear.label}</p><h1>No eligible target year</h1><p>Create a planning academic year after {data.sourceYear.label} before starting a rollover.</p><Link className="rollover-secondary-button" href="/staff/academics/years">Manage academic years</Link></section>;

  return <>
    <header className="rollover-header staff-page-header"><div><p className="eyebrow">Academic operations</p><h1>Academic year rollover</h1><p>Review every active enrollment, resolve placements, then run the authoritative preflight before execution.</p></div><span className="rollover-admin-badge">Administrator workflow</span></header>
    <section className="rollover-year-card" aria-labelledby="rollover-years-heading"><div className="rollover-section-heading"><div><p className="academic-kicker">1 · Set the direction</p><h2 id="rollover-years-heading">Current year <span aria-hidden="true">→</span> target year</h2></div><span className="rollover-state-pill">{pending === "execute" ? "Executing" : pending === "preflight" ? "Preflight running" : confirmationOpen ? "Confirming execution" : completed ? "Completed" : preview?.ready ? "Preview ready" : "Configuring"}</span></div><div className="rollover-year-flow"><div className="rollover-year-panel rollover-year-current"><span>Current year</span><strong>{sourceLabel}</strong><small>{dateLabel(data.sourceYear.start_date)} – {dateLabel(data.sourceYear.end_date)} · Current</small></div><span className="rollover-flow-arrow" aria-hidden="true">→</span><label className="rollover-year-panel">Target planning year<select aria-label="Target planning academic year" disabled={pending !== null || Boolean(completed)} onChange={(event) => updateTargetYear(event.target.value)} value={targetYearId}>{data.targetYears.map((year) => <option key={year.id} value={year.id}>{year.label} · Planning</option>)}</select><small>Only planning years after the current year are available.</small></label></div></section>
    <section className="rollover-summary" aria-label="Rollover plan summary">{(["total", "promote", "repeat", "graduate", "exclude", "incomplete"] as const).map((key) => <article className={key === "incomplete" && summary.incomplete ? "rollover-summary-warning" : ""} key={key}><span>{key === "total" ? "Total students" : key === "incomplete" ? "Incomplete" : key[0].toUpperCase() + key.slice(1)}</span><strong>{summary[key]}</strong></article>)}</section>
    {error && <section className={`rollover-feedback rollover-feedback-${error.category}`} role="alert"><div><p className="academic-kicker">{errorTitle(error)}</p><p>{error.message}</p></div>{error.category === "stale_preview" && <button className="rollover-secondary-button" onClick={() => setError(null)} type="button">Review plan again</button>}</section>}
    {completed ? <CompletionSummary result={completed} sourceLabel={sourceLabel} targetLabel={targetLabel} /> : <>
      <section className="rollover-workspace" aria-labelledby="rollover-students-heading"><header className="rollover-section-heading"><div><p className="academic-kicker">2 · Review every active enrollment</p><h2 id="rollover-students-heading">Student rollover plan</h2><p>Rows begin as Promote for review, but no plan can execute until required target placements are assigned. Exclude leaves a student unresolved; it does not deactivate, transfer, graduate, or delete them.</p></div><span className="rollover-visible-count">Showing {filteredRows.length} of {rows.length}</span></header>
        <div className="rollover-filters" aria-label="Filter and bulk tools"><label>Search students<input aria-label="Search students" onChange={(event) => setSearch(event.target.value)} placeholder="Name or admission number" value={search}/></label><label>Source class<select aria-label="Filter by source class" onChange={(event) => { setSourceClassId(event.target.value); setSourceSectionId(""); }} value={sourceClassId}><option value="">All source classes</option>{sourceClassIds.map((id) => <option key={id} value={id}>{classById.get(id)?.name ?? "Unknown class"}</option>)}</select></label><label>Source section<select aria-label="Filter by source section" onChange={(event) => setSourceSectionId(event.target.value)} value={sourceSectionId}><option value="">All source sections</option>{sourceSectionIds.map((id) => <option key={id} value={id}>{sectionById.get(id)?.name ?? "Unknown section"}</option>)}</select></label><label>Outcome filter<select aria-label="Filter by outcome" onChange={(event) => setOutcomeFilter(event.target.value as "all" | Outcome)} value={outcomeFilter}><option value="all">All outcomes</option>{outcomes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
        <div className="rollover-bulk-tools"><span>Bulk action for the {filteredRows.length} visible rows</span><select aria-label="Bulk outcome" disabled={pending !== null} onChange={(event) => setBulkOutcome(event.target.value as Outcome)} value={bulkOutcome}>{outcomes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="rollover-secondary-button" disabled={pending !== null || !filteredRows.length} onClick={applyBulkOutcome} type="button">Apply outcome</button><small>This changes rows for review; it never executes the rollover.</small></div>
        <div className="rollover-table-wrap"><table className="rollover-table"><caption className="staff-sr-only">Academic rollover decisions for active source enrollments</caption><thead><tr><th>Student</th><th>Current placement</th><th>Outcome</th><th>Target class</th><th>Target section</th><th>Target roll</th><th>Reason</th></tr></thead><tbody>{filteredRows.map((row) => { const targetClassSections = targetSections.filter((section) => section.class_id === row.targetClassId); return <tr data-rollover-student-id={row.student_id} key={row.id}><td><strong>{row.student?.full_name ?? "Student record unavailable"}</strong><span>{row.student?.admission_number ?? "—"}</span></td><td><strong>{classById.get(row.class_id)?.name ?? "—"}</strong><span>{sectionById.get(row.academic_section_id)?.name ?? "—"} · Roll {row.roll_number ?? "—"}</span></td><td><label><span className="staff-sr-only">Outcome for {row.student?.full_name ?? row.student_id}</span><select aria-label={`Outcome for ${row.student?.full_name ?? row.student_id}`} disabled={pending !== null} onChange={(event) => updateOutcome(row, event.target.value as Outcome)} value={row.outcome}>{outcomes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></td><td>{row.outcome === "promote" || row.outcome === "repeat" ? <label><span className="staff-sr-only">Target class for {row.student?.full_name ?? row.student_id}</span><select aria-label={`Target class for ${row.student?.full_name ?? row.student_id}`} disabled={pending !== null} onChange={(event) => updateRow(row.id, { targetClassId: event.target.value, targetSectionId: "" })} value={row.targetClassId}><option value="">Select class</option>{data.classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label> : <span className="rollover-not-applicable">Not applicable</span>}</td><td>{row.outcome === "promote" || row.outcome === "repeat" ? <label><span className="staff-sr-only">Target section for {row.student?.full_name ?? row.student_id}</span><select aria-label={`Target section for ${row.student?.full_name ?? row.student_id}`} disabled={pending !== null || !row.targetClassId} onChange={(event) => updateRow(row.id, { targetSectionId: event.target.value })} value={row.targetSectionId}><option value="">Select section</option>{targetClassSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label> : <span className="rollover-not-applicable">Not applicable</span>}</td><td>{row.outcome === "promote" || row.outcome === "repeat" ? <label><span className="staff-sr-only">Target roll number for {row.student?.full_name ?? row.student_id}</span><input aria-label={`Target roll number for ${row.student?.full_name ?? row.student_id}`} disabled={pending !== null} maxLength={30} onChange={(event) => updateRow(row.id, { targetRollNumber: event.target.value })} placeholder="Optional" value={row.targetRollNumber}/></label> : <span className="rollover-not-applicable">Not applicable</span>}</td><td>{row.outcome === "exclude" ? <label><span className="staff-sr-only">Exclusion reason for {row.student?.full_name ?? row.student_id}</span><textarea aria-label={`Exclusion reason for ${row.student?.full_name ?? row.student_id}`} disabled={pending !== null} maxLength={500} onChange={(event) => updateRow(row.id, { reason: event.target.value })} placeholder="Why is this unresolved?" rows={2} value={row.reason}/></label> : <span className="rollover-reason-muted">—</span>}</td></tr>; })}</tbody></table></div>
        {!filteredRows.length && <p className="rollover-no-results">No students match the current filters.</p>}
      </section>
      {preview && <section className={`rollover-preview rollover-preview-${preview.ready ? "ready" : "blocked"}`} aria-live="polite"><header className="rollover-section-heading"><div><p className="academic-kicker">3 · Authoritative preflight</p><h2>{preview.ready ? "Plan ready for confirmation" : "Resolve authoritative blockers"}</h2><p>{preview.ready ? "The database accepted this exact plan for execution. Any edit will invalidate this preview." : "The database found blockers. Locate the affected rows, edit the plan, and run preflight again."}</p></div><span className="rollover-state-pill">{preview.ready ? "Ready" : "Blocked"}</span></header><div className="rollover-authoritative-counts"><span>Total <strong>{preview.total_count}</strong></span><span>Promote <strong>{preview.promote_count}</strong></span><span>Repeat <strong>{preview.repeat_count}</strong></span><span>Graduate <strong>{preview.graduate_count}</strong></span><span>Exclude <strong>{preview.exclude_count}</strong></span></div>{preview.errors.length > 0 && <ul className="rollover-blockers">{preview.errors.map((item, index) => { const affected = item.student_id ? rows.find((row) => row.student_id === item.student_id)?.student?.full_name : null; return <li key={`${item.code}-${item.student_id ?? index}`}><strong>{blockerLabel(item.code)}</strong>{affected && <span> · {affected}</span>}<small>{item.code}</small></li>; })}</ul>}{preview.ready && <button className="rollover-primary-button" disabled={pending !== null} onClick={() => setConfirmationOpen(true)} type="button">Review and confirm execution</button>}</section>}
      <section className="rollover-preflight-actions"><div><p className="academic-kicker">{preview ? "Preview invalidated by edits" : "Before execution"}</p><p>{planComplete ? "Run the authoritative preflight when every row has a required placement." : `${summary.incomplete} row${summary.incomplete === 1 ? " is" : "s are"} missing a target class or section.`}</p></div><button className="rollover-primary-button" disabled={pending !== null || !planComplete} onClick={runPreflight} type="button">{pending === "preflight" ? "Running preflight…" : "Run preflight"}</button></section>
    </>}
    {confirmationOpen && preview?.ready && <div className="rollover-dialog-backdrop"><section aria-labelledby="rollover-confirm-heading" aria-modal="true" className="rollover-confirmation" role="dialog"><p className="academic-kicker">Final confirmation</p><h2 id="rollover-confirm-heading">Execute this academic rollover?</h2><p>This will complete the rollover, change enrollment placements, graduate selected students, close {sourceLabel}, and activate {targetLabel}. This cannot be undone through this workspace.</p><div className="rollover-confirmation-summary"><span>Total <strong>{preview.total_count}</strong></span><span>Promote <strong>{preview.promote_count}</strong></span><span>Repeat <strong>{preview.repeat_count}</strong></span><span>Graduate <strong>{preview.graduate_count}</strong></span><span>Exclude <strong>{preview.exclude_count}</strong></span></div><div className="rollover-confirmation-actions"><button autoFocus className="rollover-secondary-button" disabled={pending === "execute"} onClick={() => setConfirmationOpen(false)} type="button">Cancel</button><button className="rollover-danger-button" disabled={pending !== null} onClick={executeRollover} type="button">{pending === "execute" ? "Executing…" : "Execute rollover"}</button></div></section></div>}
  </>;
}

function CompletionSummary({ result, sourceLabel, targetLabel }: { result: AcademicRolloverExecutionResult; sourceLabel: string; targetLabel: string }) {
  return <section className="rollover-completed" aria-live="polite" role="status"><p className="academic-kicker">Completed successfully</p><h2>Academic rollover complete</h2><p>{sourceLabel} was closed and {targetLabel} is now active. The database recorded the operation atomically.</p><div className="rollover-authoritative-counts"><span>Status <strong>{result.status}</strong></span><span>Total <strong>{result.total_count}</strong></span><span>Promote <strong>{result.promote_count}</strong></span><span>Repeat <strong>{result.repeat_count}</strong></span><span>Graduate <strong>{result.graduate_count}</strong></span><span>Exclude <strong>{result.exclude_count}</strong></span></div>{result.idempotent_replay && <p className="rollover-replay-note">The response was an idempotent replay of the completed operation.</p>}<div className="rollover-completed-links"><Link className="rollover-primary-button" href="/staff/academics/years">Return to academic years</Link><Link className="rollover-secondary-button" href="/staff/students/enrollments">Review enrollments</Link></div></section>;
}
