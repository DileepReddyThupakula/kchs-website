"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { PortalIcon } from "@/components/staff-coming-soon";
import { useStaffPortalShell } from "@/components/staff-portal-shell";
import { isStaffNavigationActive, staffNavigationSections, type StaffNavigationItem } from "@/lib/staff-navigation";

function NavigationLink({ item, pathname }: { item: StaffNavigationItem; pathname: string }) {
  const active = isStaffNavigationActive(pathname, item);
  const { closeSidebar } = useStaffPortalShell();
  return <Link aria-current={active ? "page" : undefined} className={active ? "staff-nav-current" : undefined} href={item.href} onClick={closeSidebar} prefetch={false} title={item.label}><PortalIcon icon={item.icon}/><span>{item.label}</span></Link>;
}

export function StaffNavigation({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();
  const { closeSidebar } = useStaffPortalShell();
  const visibleSections = useMemo(() => staffNavigationSections.map((section) => ({ ...section, items: section.items.filter((item) => !item.adminOnly || role === "admin") })).filter((section) => section.items.length), [role]);
  const activeGroups = useMemo(() => visibleSections.filter((section) => section.collapsible && section.items.some((item) => isStaffNavigationActive(pathname, item))).map((section) => section.label), [pathname, visibleSections]);
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});

  function isGroupOpen(label: string) {
    return toggledGroups[label] ?? activeGroups.includes(label);
  }

  function toggleGroup(label: string) {
    setToggledGroups((current) => ({ ...current, [label]: !isGroupOpen(label) }));
  }

  return <nav className="staff-nav" aria-label="Staff portal navigation">
    {visibleSections.map((section) => {
      const active = section.items.some((item) => isStaffNavigationActive(pathname, item));
      if (section.collapsible) {
        const open = isGroupOpen(section.label);
        return <div className={`staff-nav-group ${active ? "staff-nav-group-current" : ""} ${open ? "staff-nav-group-open" : ""}`} key={section.label}>
          <button aria-expanded={open} className="staff-nav-group-trigger" onClick={() => toggleGroup(section.label)} type="button">
            <span><PortalIcon icon={section.icon ?? section.items[0].icon}/>{section.label}</span>
            <svg aria-hidden="true" fill="none" viewBox="0 0 16 16"><path d={open ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
          </button>
          <div className="staff-nav-group-items" hidden={!open}>{section.items.map((item) => <NavigationLink item={item} key={item.href} pathname={pathname}/>)}</div>
        </div>;
      }
      return <section className="staff-nav-section" key={section.label}><p className="staff-nav-label">{section.label}</p>{section.items.map((item) => <NavigationLink item={item} key={item.href} pathname={pathname}/>)}</section>;
    })}
    <section className="staff-nav-section staff-nav-public"><p className="staff-nav-label">Public Website</p><Link href="/" onClick={closeSidebar} title="View website"><PortalIcon icon="archive"/><span>View website</span></Link></section>
  </nav>;
}
