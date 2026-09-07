"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isStaffNavigationActive, staffNavigationSections } from "@/lib/staff-navigation";

type StaffRole = "admin" | "staff";

type StaffPortalShellContextValue = {
  closeSidebar: () => void;
};

const StaffPortalShellContext = createContext<StaffPortalShellContextValue>({ closeSidebar: () => undefined });

export function useStaffPortalShell() {
  return useContext(StaffPortalShellContext);
}

export function StaffPortalShell({
  accountEmail,
  accountRole,
  children,
  sidebar,
}: {
  accountEmail: string | null;
  accountRole: StaffRole;
  children: ReactNode;
  sidebar: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const pageLabel = useMemo(() => {
    if (pathname === "/staff") return "Dashboard";
    const item = staffNavigationSections.flatMap((section) => section.items).find((candidate) => isStaffNavigationActive(pathname, candidate));
    return item?.label ?? "Staff portal";
  }, [pathname]);

  const roleLabel = accountRole === "admin" ? "Administrator" : "Staff member";
  const initials = accountRole === "admin" ? "AD" : "ST";
  const shellClassName = [
    "staff-shell",
    collapsed ? "staff-shell-sidebar-collapsed" : "",
    mobileOpen ? "staff-shell-sidebar-open" : "",
  ].filter(Boolean).join(" ");

  return <StaffPortalShellContext.Provider value={{ closeSidebar: () => setMobileOpen(false) }}>
    <div className={shellClassName}>
      <aside className="staff-sidebar" id="staff-sidebar">
        <button className="staff-sidebar-close" onClick={() => setMobileOpen(false)} type="button" aria-label="Close navigation">
          <CloseIcon />
        </button>
        {sidebar}
      </aside>

      {mobileOpen ? <button aria-label="Dismiss navigation overlay" className="staff-sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" /> : null}

      <div className="staff-app-frame">
        <header className="staff-topbar">
          <div className="staff-topbar-leading">
            <button aria-controls="staff-sidebar" aria-expanded={mobileOpen} className="staff-mobile-menu" onClick={() => setMobileOpen(true)} type="button">
              <MenuIcon />
              <span className="staff-sr-only">Open navigation</span>
            </button>
            <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed} className="staff-sidebar-toggle" onClick={() => setCollapsed((value) => !value)} type="button">
              <SidebarToggleIcon collapsed={collapsed} />
            </button>
            <nav aria-label="Breadcrumb" className="staff-breadcrumb">
              <span>Overview</span>
              <span aria-hidden="true">/</span>
              <strong>{pageLabel}</strong>
            </nav>
          </div>
          <div className="staff-topbar-account">
            <div>
              <strong>{roleLabel}</strong>
              <span>{accountEmail ?? "Authorised staff"}</span>
            </div>
            <span aria-hidden="true" className="staff-topbar-avatar">{initials}</span>
          </div>
        </header>

        <main className="staff-main">{children}</main>
      </div>
    </div>
  </StaffPortalShellContext.Provider>;
}

function MenuIcon() {
  return <svg aria-hidden="true" className="staff-topbar-icon" fill="none" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" className="staff-topbar-icon" fill="none" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return <svg aria-hidden="true" className="staff-topbar-icon" fill="none" viewBox="0 0 24 24"><rect height="16" rx="2" stroke="currentColor" strokeWidth="1.6" width="17" x="3.5" y="4" /><path d={collapsed ? "M9 4v16m6-10 3 2-3 2" : "M9 4v16m6-6-3 2 3 2"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg>;
}
