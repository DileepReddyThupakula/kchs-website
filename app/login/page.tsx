import Link from "next/link";
import { StaffLoginForm } from "@/components/staff-login-form";

export default function LoginPage() {
  return <main className="portal-page"><aside className="portal-aside"><Link href="/" className="brand"><span className="crest"><b>K</b><i>CHS</i></span><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL · YERRAGUNTLA</small></span></Link><div><p className="eyebrow light">Staff Portal</p><h1>For the people<br />shaping <em>futures.</em></h1><p>A secure workspace for authorised Krishna Chaitanya High School staff.</p></div><small>Excellence in Education Since 2001</small></aside><section className="login-panel"><Link href="/" className="back">← Back to school website</Link><div className="login-card"><p className="eyebrow">Staff Portal</p><h2>Welcome back.</h2><p className="login-intro">Use your assigned staff account to continue.</p><StaffLoginForm /><p className="login-help">Access is limited to authorised staff. Contact the school administrator if you need portal access.</p></div></section></main>;
}
