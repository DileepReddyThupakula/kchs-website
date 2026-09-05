"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PortalIcon } from "@/components/staff-coming-soon";
import { isStaffNavigationActive, staffNavigationSections, type StaffNavigationItem } from "@/lib/staff-navigation";

function NavigationLink({ item, pathname }: { item: StaffNavigationItem; pathname: string }) {
  const active = isStaffNavigationActive(pathname, item);
  return <Link aria-current={active ? "page" : undefined} className={active ? "staff-nav-current" : undefined} href={item.href}><PortalIcon icon={item.icon}/><span>{item.label}</span></Link>;
}

export function StaffNavigation({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();

  return <nav className="staff-nav" aria-label="Staff portal navigation">
    {staffNavigationSections.map((section) => {
      const items = section.items.filter((item) => !item.adminOnly || role === "admin");
      if (!items.length) return null;
      const active = items.some((item) => isStaffNavigationActive(pathname, item));
      if (section.collapsible) {
        return <details className={`staff-nav-group ${active ? "staff-nav-group-current" : ""}`} key={section.label} open={active}>
          <summary>{section.label}</summary>
          <div>{items.map((item) => <NavigationLink item={item} key={item.href} pathname={pathname}/>)}</div>
        </details>;
      }
      return <section className="staff-nav-section" key={section.label}><p className="staff-nav-label">{section.label}</p>{items.map((item) => <NavigationLink item={item} key={item.href} pathname={pathname}/>)}</section>;
    })}
    <section className="staff-nav-section staff-nav-public"><p className="staff-nav-label">Public Website</p><Link href="/"><PortalIcon icon="archive"/><span>View website</span></Link></section>
  </nav>;
}
