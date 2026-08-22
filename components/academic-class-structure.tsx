"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ClassRow = {
  id: string;
  name: string;
  active: boolean;
  sections: string[];
  teachers: string[];
  subjects: number;
};

export function AcademicClassStructure({ yearLabel, rows }: { yearLabel: string; rows: ClassRow[] }) {
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.trim().toLowerCase())), [query, rows]);

  return <section className="academic-structure" aria-labelledby="class-structure-heading">
    <header className="academic-section-header">
      <div><p className="academic-kicker">Class-wise view</p><h2 id="class-structure-heading">Class Structure <span>({yearLabel})</span></h2></div>
      <label className="academic-search"><span>Search class</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search class..." /></label>
    </header>
    {visibleRows.length ? <><div className="academic-table-wrap"><table className="academic-table"><thead><tr><th>Class</th><th>Sections</th><th>Class teacher(s)</th><th>Subjects</th><th>Status</th><th><span className="staff-sr-only">Action</span></th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td><Badges values={row.sections} empty="—" /></td><td>{row.teachers.length ? row.teachers.join(", ") : <span className="academic-muted">Unassigned</span>}</td><td><strong>{row.subjects}</strong></td><td><span className={`academic-status ${row.active ? "academic-status-active" : "academic-status-inactive"}`}>{row.active ? "Active" : "Inactive"}</span></td><td><Link className="academic-manage-link" href={`/staff/academics/classes/${row.id}`}>Manage <span aria-hidden="true">→</span></Link></td></tr>)}</tbody></table></div><div className="academic-class-cards">{visibleRows.map((row) => <article key={row.id}><header><p className="academic-kicker">Class</p><h3>{row.name}</h3><span className={`academic-status ${row.active ? "academic-status-active" : "academic-status-inactive"}`}>{row.active ? "Active" : "Inactive"}</span></header><dl><div><dt>Sections</dt><dd><Badges values={row.sections} empty="—" /></dd></div><div><dt>Class teacher(s)</dt><dd>{row.teachers.length ? row.teachers.join(", ") : "Unassigned"}</dd></div><div><dt>Subjects</dt><dd>{row.subjects}</dd></div></dl><Link className="academic-manage-link" href={`/staff/academics/classes/${row.id}`}>Manage class <span aria-hidden="true">→</span></Link></article>)}</div></> : <AcademicEmpty title="No matching classes" copy="Try a different class name." />}
  </section>;
}

export function Badges({ values, empty }: { values: string[]; empty: string }) {
  return values.length ? <span className="academic-badges">{values.map((value) => <span key={value}>{value}</span>)}</span> : <span className="academic-muted">{empty}</span>;
}

export function AcademicEmpty({ title, copy }: { title: string; copy: string }) {
  return <div className="academic-empty"><span aria-hidden="true">◇</span><h3>{title}</h3><p>{copy}</p></div>;
}
