import Link from "next/link";
import { StaffMemberForm } from "@/components/staff-member-form";
export default function NewStaffMemberPage() { return <><Link className="staff-back" href="/staff/staff">← Back to staff directory</Link><header className="staff-page-header"><div><p className="eyebrow">School management</p><h1>Add employee</h1><p>Create a private employee record. Portal access can be linked later through account administration.</p></div></header><StaffMemberForm/></>; }
