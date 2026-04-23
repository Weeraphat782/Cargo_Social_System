"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

export function SectionHeading({
  children,
  className,
  style,
  margin = "0 0 12px",
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  margin?: string;
}) {
  return (
    <div
      className={clsx(className)}
      style={{
        margin,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        {children}
      </h2>
      <div className="gradient-divider" style={{ flex: 1, minWidth: 40, maxWidth: 220 }} />
    </div>
  );
}
