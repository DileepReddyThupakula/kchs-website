"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter(); const [role, setRole] = useState("Teacher"); const [notice, setNotice] = useState("");
  function enter(event: FormEvent) { event.preventDefault(); setNotice("This starter does not include authentication yet. Connect your approved identity provider to enable access."); }
  return <main className="portal-page"><aside className="portal-aside"><Link href="/" className="brand"><span className="crest"><b>K</b><i>CHS</i></span><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL · YERRAGUNTLA</small></span></Link><div><p className="eyebrow light">Staff Portal</p><h1>For the people<br />shaping <em>futures.</em></h1><p>A secure workspace for Krishna Chaitanya High School staff.</p></div><small>Excellence in Education Since 2001</small></aside><section className="login-panel"><Link href="/" className="back">← Back to school website</Link><div className="login-card"><p className="eyebrow">Management System</p><h2>Welcome back.</h2><p className="login-intro">Sign in with your assigned staff account.</p><form onSubmit={enter}><label>Email address<input type="email" placeholder="name@school.edu.in" required /></label><label>Password<input type="password" placeholder="Enter your password" required /></label><label>Role<select value={role} onChange={e => setRole(e.target.value)}><option>Teacher</option><option>Admin</option></select></label><button className="button gold" type="submit">Sign in securely <span>→</span></button>{notice && <p className="auth-note" role="status">{notice}</p>}</form><p className="login-help">Access is limited to authorised Admin and Teacher accounts. Authentication and role enforcement are connected during system rollout.</p></div></section></main>;
}
