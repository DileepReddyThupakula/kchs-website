"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const links = [
  ["About", "#about"],
  ["Academics", "#academics"],
  ["Principal's Desk", "#message"],
  ["Notices", "#notices"],
  ["Contact", "#contact"],
] as const;

export function SchoolMark({ dark = false }: { dark?: boolean }) {
  return <span className={`school-mark${dark ? " school-mark--dark" : ""}`}><Image src="/images/krishna-chaitanya-logo.png" alt="Krishna Chaitanya High School logo" width={56} height={56} priority={false} /><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL · YERRAGUNTLA</small></span></span>;
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false); const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const check = () => setScrolled(window.scrollY > 18); check(); window.addEventListener("scroll", check, { passive: true }); return () => window.removeEventListener("scroll", check); }, []);
  return <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
    <Link href="#top" className="brand" aria-label="Krishna Chaitanya High School home"><SchoolMark /></Link>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="school-navigation"><span /><span /><span className="sr-only">Toggle navigation</span></button>
    <nav id="school-navigation" className={open ? "nav-open" : ""} aria-label="Main navigation">{links.map(([label, href]) => <a onClick={() => setOpen(false)} href={href} key={href}>{label}</a>)}<Link onClick={() => setOpen(false)} className="nav-staff" href="/login">Staff Login <span>→</span></Link></nav>
    <Link className="staff-login" href="/login">Staff Login <span>→</span></Link>
  </header>;
}
