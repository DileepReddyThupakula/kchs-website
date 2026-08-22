import Link from "next/link";
import { StaffFacultyForm } from "@/components/staff-faculty-form";

export default function NewFacultyPage() { return <><Link className="staff-back" href="/staff/faculty">← Back to faculty</Link><header className="staff-page-header"><div><p className="eyebrow">School community</p><h1>Add faculty member</h1><p>Create a faculty profile for the staff directory. It remains under your visibility control.</p></div></header><StaffFacultyForm/></>; }
