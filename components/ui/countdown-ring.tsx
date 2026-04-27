"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";

const WINDOW_MS = 24 * 60 * 60 * 1000;

function formatRemaining(ms: number) {
  if (ms <= 0) return "Due";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const d = Math.floor(h / 24);
  if (d > 2) return `${d}d+`;
  if (h > 48) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h${m ? ` ${m}m` : ""}`;
  return `${m}m`;
}

export function CountdownRing({
  targetIso,
  label = "Next run",
  size = 52,
  stroke = 4,
}: {
  targetIso: string;
  label?: string;
  size?: number;
  stroke?: number;
}) {
  const gradId = useId().replace(/:/g, "");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { progress, text, isDue } = useMemo(() => {
    const target = new Date(targetIso).getTime();
    const left = target - now;
    const p = left <= 0 ? 1 : 1 - Math.min(1, left / WINDOW_MS);
    return {
      progress: p,
      text: formatRemaining(left),
      isDue: left <= 0,
    };
  }, [targetIso, now]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
          />
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--info)" />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            padding: 4,
          }}
        >
          <span
            style={{
              fontSize: size < 48 ? 9 : 10,
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            {text}
          </span>
        </div>
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--text-muted)",
          textAlign: "center",
          maxWidth: 88,
          lineHeight: 1.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {label}
        {isDue && <span className="pulse-dot" style={{ flexShrink: 0 }} aria-hidden />}
      </div>
    </div>
  );
}
