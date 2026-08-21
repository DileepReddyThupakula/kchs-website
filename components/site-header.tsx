"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  ["About", "#about"],
  ["Academics", "#academics"],
  ["Principal's Desk", "#message"],
  ["Admissions", "/admissions"],
  ["Notices", "#notices"],
  ["Contact", "/contact"],
] as const;

export function SchoolMark({ dark = false }: { dark?: boolean }) {
  return <span className={`school-mark${dark ? " school-mark--dark" : ""}`}><Image src="/images/krishna-chaitanya-logo.png" alt="Krishna Chaitanya High School logo" width={56} height={56} priority={false} /><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL · YERRAGUNTLA</small></span></span>;
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false); const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  useEffect(() => { const check = () => setScrolled(window.scrollY > 18); check(); window.addEventListener("scroll", check, { passive: true }); return () => window.removeEventListener("scroll", check); }, []);
  return <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
    <Link href="/" className="brand" aria-label="Krishna Chaitanya High School home"><SchoolMark /></Link>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="school-navigation"><span /><span /><span className="sr-only">Toggle navigation</span></button>
    <nav id="school-navigation" className={open ? "nav-open" : ""} aria-label="Main navigation">{links.map(([label, href]) => { const target = href.startsWith("#") && pathname !== "/" ? `/${href}` : href; const active = href === pathname; return <Link onClick={() => setOpen(false)} href={target} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined} key={href}>{label}</Link>; })}<Link onClick={() => setOpen(false)} className="nav-staff" href="/login">Staff Login <span>→</span></Link></nav>
    <Link className="staff-login" href="/login">Staff Login <span>→</span></Link>
  </header>;
}
