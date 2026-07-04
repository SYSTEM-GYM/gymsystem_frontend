"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/nav/SidebarNav";
import type { UserRole } from "@/app/dashboard/layout";

type Props = {
  role: UserRole;
  header: React.ReactNode;
  children: React.ReactNode;
  gymName?: string;
  logoUrl?: string | null;
};

export function DashboardShell({ role, header, children, gymName, logoUrl }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sb_expanded");
    if (stored === "1") setExpanded(true);
    setMounted(true);
  }, []);

  function toggle() {
    setExpanded((e) => {
      const next = !e;
      localStorage.setItem("sb_expanded", next ? "1" : "0");
      return next;
    });
  }

  const sidebarW = expanded ? "lg:w-60" : "lg:w-[72px]";
  const mainPl = expanded ? "lg:pl-60" : "lg:pl-[72px]";

  return (
    <div className="min-h-screen bg-base flex">
      {/* Desktop collapsible sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col bg-surface-1 border-r border-white/5 fixed inset-y-0 left-0 z-20 transition-all duration-300 overflow-hidden ${sidebarW}`}
        style={mounted ? undefined : { width: 72 }}
      >
        <SidebarNav
          role={role}
          expanded={expanded}
          onToggle={toggle}
          gymName={gymName}
          logoUrl={logoUrl}
        />
      </aside>

      {/* Main content column — offset by sidebar */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${mainPl}`}
        style={mounted ? undefined : { paddingLeft: 72 }}
      >
        {header}
        {children}
      </div>
    </div>
  );
}
