"use client";

import { useState, type ReactNode, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  margin = "0 0 20px",
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  margin?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function onToggle() {
    setOpen((o) => !o);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div style={{ margin }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          cursor: "pointer",
          userSelect: "none",
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
          {title}
        </h2>
        {typeof count === "number" && (
          <span
            className="omg-badge omg-badge-scheduled"
            style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px" }}
          >
            {count}
          </span>
        )}
        <div className="gradient-divider" style={{ flex: 1, minWidth: 40, maxWidth: 180 }} />
        <ChevronDown
          size={18}
          strokeWidth={2.25}
          style={{
            flexShrink: 0,
            color: "var(--text-muted)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
          }}
          aria-hidden
        />
      </div>
      {open ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}
