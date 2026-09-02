"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

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
  const [open, setOpen] = useState(false); const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  useEffect(() => { const check = () => setScrolled(window.scrollY > 18); check(); window.addEventListener("scroll", check, { passive: true }); return () => window.removeEventListener("scroll", check); }, []);

  return (
    <motion.header
      className={`site-header${scrolled ? " site-header--scrolled" : ""}`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] }}
    >
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2 }}
      >
        <Link href="/" className="brand" aria-label="Krishna Chaitanya High School home"><SchoolMark /></Link>
      </motion.div>

      <motion.button
        className="menu-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="school-navigation"
        whileHover={{ scale: reducedMotion ? 1 : 1.1 }}
        whileTap={{ scale: reducedMotion ? 1 : 0.9 }}
      >
        <span /><span /><span className="sr-only">Toggle navigation</span>
      </motion.button>

      <motion.nav
        id="school-navigation"
        className={open ? "nav-open" : ""}
        aria-label="Main navigation"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.4 }}
      >
        {links.map(([label, href]) => {
          const target = href.startsWith("#") && pathname !== "/" ? `/${href}` : href;
          const active = href === pathname;
          return (
            <motion.Link
              key={href}
              onClick={() => setOpen(false)}
              href={target}
              className={active ? "nav-active" : undefined}
              aria-current={active ? "page" : undefined}
              whileHover={{ scale: reducedMotion ? 1 : 1.05 }}
              whileTap={{ scale: reducedMotion ? 1 : 0.95 }}
            >
              {label}
            </motion.Link>
          );
        })}
        <motion.Link
          onClick={() => setOpen(false)}
          className="nav-staff"
          href="/login"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Staff Login <span>→</span>
        </motion.Link>
      </motion.nav>

      {/* Mobile menu overlay */}
      {open && (
        <motion.div
          className="mobile-menu-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
          onClick={() => setOpen(false)}
        >
          <motion.nav
            className="mobile-menu"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.4 }}
          >
            {links.map(([label, href]) => {
              const target = href.startsWith("#") && pathname !== "/" ? `/${href}` : href;
              const active = href === pathname;
              return (
                <motion.Link
                  key={href}
                  onClick={() => setOpen(false)}
                  href={target}
                  className={active ? "nav-active" : undefined}
                  aria-current={active ? "page" : undefined}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {label}
                </motion.Link>
              );
            })}
            <motion.Link
              onClick={() => setOpen(false)}
              className="nav-staff"
              href="/login"
              whileHover={{ scale: reducedMotion ? 1 : 1.03 }}
              whileTap={{ scale: reducedMotion ? 1 : 0.97 }}
            >
              Staff Login <span>→</span>
            </motion.Link>
          </motion.nav>
        </motion.div>
      )}

      <motion.Link
        className="staff-login"
        href="/login"
        whileHover={{ scale: reducedMotion ? 1 : 1.05 }}
        whileTap={{ scale: reducedMotion ? 1 : 0.95 }}
      >
        Staff Login <span>→</span>
      </motion.Link>
    </motion.header>
  );
}
