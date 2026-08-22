import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffFacultyForm } from "@/components/staff-faculty-form";
import { getStaffFacultyMember } from "@/lib/faculty";

export default async function EditFacultyPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const member = await getStaffFacultyMember(id); if (!member) notFound(); return <><Link className="staff-back" href="/staff/faculty">← Back to faculty</Link><header className="staff-page-header"><div><p className="eyebrow">School community</p><h1>Edit faculty profile</h1><p>{member.status === "archived" ? "This archived profile is retained for school records." : "Update public profile details, visibility and photograph."}</p></div></header><StaffFacultyForm member={member}/></>; }
