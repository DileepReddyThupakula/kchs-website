"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  ["About", "#about"],
  ["Academics", "#academics"],
  ["Principal's Desk", "#message"],
  ["Admissions", "/admissions"],
  ["Faculty", "/faculty"],
  ["Notices", "#notices"],
  ["Gallery", "/gallery"],
  ["Downloads", "/downloads"],
  ["Contact", "/contact"],
] as const;

export function SchoolMark({ dark = false }: { dark?: boolean }) {
  return <span className={`school-mark${dark ? " school-mark--dark" : ""}`}><Image src="/images/krishna-chaitanya-logo.png" alt="Krishna Chaitanya High School logo" width={56} height={56} priority={false} /><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL · YERRAGUNTLA</small></span></span>;
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const header = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setScrolled(window.scrollY > 18);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1201px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", resize);
    return () => desktop.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const followLink = () => {
    if (open) {
      setOpen(false);
      trigger.current?.focus();
    }
  };

  return (
    <header
      ref={header}
      className={`site-header${scrolled ? " site-header--scrolled" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Link href="/" className="brand" aria-label="Krishna Chaitanya High School home"><SchoolMark /></Link>
      <button
        ref={trigger}
        type="button"
        className="menu-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="school-navigation"
        aria-label={open ? "Close navigation" : "Open navigation"}
      >
        <span aria-hidden="true" /><span aria-hidden="true" />
      </button>
      {/* Non-modal disclosure: one nav, normal Tab order, no background trapping. */}
      <nav id="school-navigation" className={open ? "nav-open" : undefined} aria-label="Main navigation">
        {links.map(([label, href]) => {
          const target = href.startsWith("#") && pathname !== "/" ? `/${href}` : href;
          const active = href === pathname;
          return <Link key={href} href={target} onClick={followLink} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>;
        })}
        <Link className="nav-staff" href="/login" onClick={followLink}>Staff Login <span aria-hidden="true">→</span></Link>
      </nav>
      <Link className="staff-login" href="/login">Staff Login <span aria-hidden="true">→</span></Link>
    </header>
  );
}
