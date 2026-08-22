import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffMemberForm } from "@/components/staff-member-form";
import { getStaffMember } from "@/lib/staff-members";
export default async function EditStaffMemberPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const member = await getStaffMember(id); if (!member) notFound(); return <><Link className="staff-back" href="/staff/staff">← Back to staff directory</Link><header className="staff-page-header"><div><p className="eyebrow">School management</p><h1>Edit employee</h1><p>Maintain private employee details and employment status.</p></div></header><StaffMemberForm member={member}/></>; }
