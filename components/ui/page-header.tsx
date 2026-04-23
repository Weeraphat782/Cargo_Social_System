"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  className,
  style,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={clsx("omg-hero", className)} style={{ margin: "0 0 28px", ...style }}>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {icon && <div style={{ marginTop: 2, color: "var(--accent)", flexShrink: 0 }}>{icon}</div>}
          <div>
            {eyebrow && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                {eyebrow}
              </div>
            )}
            <h1 className="page-title" style={{ margin: 0 }}>
              {title}
            </h1>
            {subtitle && (
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
