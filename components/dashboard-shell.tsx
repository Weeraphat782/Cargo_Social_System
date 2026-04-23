"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardTopbar } from "@/components/dashboard-topbar";

const SIDEBAR_STORAGE_KEY = "omg.sidebar.collapsed";

type Props = {
  children: ReactNode;
  activeCampaignCount: number;
};

export function DashboardShell({ children, activeCampaignCount }: Props) {
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      if (mq.matches) {
        setCollapsed(true);
        return;
      }
      try {
        setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
      } catch {
        setCollapsed(false);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, []);

  const effectiveCollapsed = mounted ? collapsed : false;

  return (
    <div
      className="dashboard-shell"
      data-sidebar-collapsed={effectiveCollapsed ? "true" : "false"}
      style={
        {
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg-base)",
          "--sidebar-w": effectiveCollapsed ? "64px" : "220px",
        } as React.CSSProperties
      }
    >
      <DashboardNav activeCampaignCount={activeCampaignCount} collapsed={effectiveCollapsed} onToggle={onToggle} />
      <div
        className="dashboard-main-wrap"
        style={{
          marginLeft: "var(--sidebar-w, 220px)",
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          maxWidth: "calc(100vw - var(--sidebar-w, 220px))",
          transition: "margin-left 180ms ease, max-width 180ms ease",
        }}
      >
        <DashboardTopbar />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "32px clamp(24px, 4vw, 64px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: "100%", maxWidth: 1120 }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
