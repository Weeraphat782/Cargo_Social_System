"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const workspaceNav: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: "campaigns";
}[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    badgeKey: "campaigns",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4.5 9.5L12 4l7.5 5.5V20a1 1 0 01-1 1h-5v-6H9v6H5a1 1 0 01-1-1V9.5z" />
      </svg>
    ),
  },
  {
    href: "/queue",
    label: "Queue",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Scheduled",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/topics",
    label: "Topics",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/logs",
    label: "Logs",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

const settingsNav: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: "/settings/brand-masters",
    label: "Brand master",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: "/settings/connections",
    label: "Connections",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
];

function isNavActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  if (href === "/campaigns") return pathname.startsWith("/campaigns");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LOGO_FULL_SRC = "/logo/logo-full.avif";

function LogoLockup() {
  const [fullErr, setFullErr] = useState(false);

  if (fullErr) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
            fontFamily: "var(--font-bricolage, var(--font-funnel, sans-serif))",
          }}
        >
          OMG Social
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--accent)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          Campaign studio
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 56 }}>
      <Image
        src={LOGO_FULL_SRC}
        alt="OMG Social"
        fill
        priority
        unoptimized
        onError={() => setFullErr(true)}
        style={{ objectFit: "contain", objectPosition: "left center" }}
        sizes="160px"
      />
    </div>
  );
}

type NavProps = {
  activeCampaignCount: number;
  collapsed: boolean;
  onToggle: () => void;
};

export function DashboardNav({ activeCampaignCount, collapsed, onToggle }: NavProps) {
  const pathname = usePathname() || "";

  const linkClass = (href: string) => `sidebar-link${isNavActive(href, pathname) ? " active" : ""}`;

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: "var(--sidebar-w, 220px)",
        transition: "width 180ms ease",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
        padding: 0,
      }}
    >
      <div
        className="sidebar-logo-row"
        style={{
          position: "relative",
          padding: collapsed ? "16px 8px" : "12px 12px 12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 10,
          minHeight: collapsed ? 72 : 80,
        }}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            style={{ textDecoration: "none", display: "block", flex: 1, minWidth: 0 }}
            title="Home"
            prefetch
          >
            <LogoLockup />
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="sidebar-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {collapsed ? (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      <nav style={{ flex: 1, padding: collapsed ? "12px 8px" : "12px 12px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {!collapsed && (
          <div className="sidebar-nav-heading" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 8px" }}>
            Workspace
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {workspaceNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
              style={{ position: "relative" }}
              title={link.label}
              prefetch
            >
              <span className="sidebar-link__icon" style={{ position: "relative", display: "inline-flex" }}>
                {link.badgeKey === "campaigns" && collapsed && activeCampaignCount > 0 && <span className="nav-campaign-badge-dot" aria-hidden />}
                {link.icon}
              </span>
              <span className="sidebar-link__label" style={{ flex: 1 }}>
                {link.label}
              </span>
              {link.badgeKey === "campaigns" && !collapsed && activeCampaignCount > 0 && (
                <span
                  className="nav-campaign-badge"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 20,
                    height: 20,
                    padding: "0 6px",
                    borderRadius: 10,
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {activeCampaignCount > 99 ? "99+" : activeCampaignCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        {!collapsed && (
          <div className="sidebar-nav-heading" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 8px 0" }}>
            Settings
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {settingsNav.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)} title={link.label} prefetch>
              <span className="sidebar-link__icon">{link.icon}</span>
              <span className="sidebar-link__label" style={{ flex: 1 }}>
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {!collapsed && (
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)" }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-secondary)" }}>System status</strong>
            <br />
            All services operational
          </p>
        </div>
      )}
    </aside>
  );
}
