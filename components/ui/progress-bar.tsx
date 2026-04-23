"use client";

import { motion } from "framer-motion";

export function ProgressBar({
  value,
  max,
  label,
  showLabel = true,
  compact,
}: {
  value: number;
  max: number;
  label?: string;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0;

  return (
    <div style={{ width: "100%" }}>
      {(label || showLabel) && (
        <div
          style={{
            fontSize: compact ? 10 : 11,
            color: "var(--text-muted)",
            marginBottom: 4,
            display: "flex",
            justifyContent: label && showLabel ? "space-between" : "flex-end",
            gap: 8,
          }}
        >
          {label && <span>{label}</span>}
          {showLabel && (
            <span>
              {value} / {max}
            </span>
          )}
        </div>
      )}
      <div
        style={{
          height: compact ? 4 : 6,
          background: "var(--bg-elevated)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          style={{
            height: "100%",
            background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--brand-navy) 35%, var(--accent)))",
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
}
