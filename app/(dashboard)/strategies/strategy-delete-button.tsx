"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StrategyDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete strategy "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? `Error ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="omg-btn-ghost"
      style={{ fontSize: 11, padding: "4px 10px", color: "var(--danger)" }}
      disabled={busy}
      onClick={() => void handleDelete()}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
