"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

function Sparkline({ values, variant = "accent" }: { values: number[]; variant?: "accent" | "muted" }) {
  const max = Math.max(0.01, ...values);
  return (
    <div className={clsx("sparkline", variant === "accent" ? "sparkline--accent" : "sparkline--muted")}>
      {values.map((v, i) => (
        <div
          key={i}
          className="sparkline__bar"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  valueIsString,
  sub,
  icon,
  trend,
  sparkline,
  className,
}: {
  label: string;
  value: number | string;
  valueIsString?: boolean;
  sub?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "flat";
  /** When omitted, no sparkline is shown (avoids fake “signal” bars on every card). */
  sparkline?: number[];
  className?: string;
}) {
  const num = typeof value === "number" ? value : Number(value);
  const showMotion = typeof value === "number" && !valueIsString && !Number.isNaN(num);
  const showSpark = Array.isArray(sparkline) && sparkline.length > 0;

  return (
    <div className={clsx("omg-card is-interactive", className)} style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {label}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            {showMotion ? (
              <motion.span
                key={num}
                initial={{ opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-bricolage, var(--font-funnel, sans-serif))", letterSpacing: "-0.02em" }}
              >
                {num}
              </motion.span>
            ) : (
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  fontFamily: "var(--font-bricolage, var(--font-funnel, sans-serif))",
                  letterSpacing: "-0.02em",
                }}
              >
                {value}
              </span>
            )}
            {trend && (
              <span style={{ fontSize: 12, color: trend === "up" ? "var(--success)" : trend === "down" ? "var(--danger)" : "var(--text-muted)" }}>
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
              </span>
            )}
          </div>
          {showSpark && (
            <div style={{ marginTop: 10, maxWidth: 120 }}>
              <Sparkline values={sparkline} />
            </div>
          )}
          {sub && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: showSpark ? 8 : 4 }}>{sub}</div>}
        </div>
        {icon && <div style={{ color: "var(--accent)", opacity: 0.9, flexShrink: 0 }}>{icon}</div>}
      </div>
    </div>
  );
}
