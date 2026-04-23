"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function segmentsToBreadcrumb(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/dashboard" || pathname === "/") {
    return [{ label: "Dashboard" }];
  }
  const parts = pathname.split("/").filter(Boolean);
  const out: { label: string; href?: string }[] = [{ label: "Home", href: "/dashboard" }];
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    queue: "Queue",
    topics: "Topics",
    campaigns: "Campaigns",
    calendar: "Scheduled",
    logs: "Logs",
    settings: "Settings",
    connections: "Connections",
    "linkedin-test": "LinkedIn test",
  };
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const seg = parts[i];
    const isLast = i === parts.length - 1;
    let label: string;
    if (parts[0] === "campaigns" && i === 1 && isLast) {
      label = "Details";
    } else {
      label = labels[seg] ?? (seg.length > 10 ? `${seg.slice(0, 8)}…` : seg);
    }
    if (isLast) {
      out.push({ label });
    } else {
      out.push({ label, href: acc });
    }
  }
  return out;
}

export function DashboardTopbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const crumbs = useMemo(() => segmentsToBreadcrumb(pathname || "/dashboard"), [pathname]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const userLabel =
    session?.user?.name || session?.user?.email || "Account";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        maxWidth: "100%",
      }}
    >
      <nav style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, fontSize: 13 }}>
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {i > 0 && (
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden>
                /
              </span>
            )}
            {c.href ? (
              <Link href={c.href} style={{ color: "var(--text-secondary)", textDecoration: "none", fontWeight: 500 }} prefetch>
                {c.label}
              </Link>
            ) : (
              <span
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/campaigns" className="omg-btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
          + New campaign
        </Link>

        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="omg-btn-ghost"
            style={{ padding: "6px 12px", maxWidth: 200 }}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userLabel}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <div
              className="omg-card"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                minWidth: 200,
                padding: "8px 0",
                zIndex: 50,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  void signOut({ callbackUrl: "/login" });
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
