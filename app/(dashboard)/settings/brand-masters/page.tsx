"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Palette } from "lucide-react";
import { PageHeader } from "@/components/ui";

type MasterRow = {
  id: string;
  slug: string;
  displayName: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function BrandMastersPage() {
  const [brands, setBrands] = useState<MasterRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cloneFrom, setCloneFrom] = useState("omg");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/brand-masters");
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? `Error ${res.status}`);
      setBrands([]);
      return;
    }
    const data = (await res.json()) as { brands: MasterRow[] };
    setBrands(data.brands);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    const s = slug.trim();
    if (!/^[a-z][a-z0-9-]*$/.test(s)) {
      setErr("Invalid slug: use lowercase, start with a letter.");
      return;
    }
    if (!displayName.trim()) {
      setErr("Display name is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/brand-masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: s,
          displayName: displayName.trim(),
          cloneFrom: cloneFrom.trim() || "omg",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        issues?: { path: (string | number)[]; message: string }[];
      };
      if (!res.ok) {
        const issueLine = data.issues?.length
          ? data.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")
          : "";
        setErr(
          [data.error, data.hint, issueLine].filter(Boolean).join("\n\n") || `Error ${res.status}`
        );
        return;
      }
      setSlug("");
      setDisplayName("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader
        title="Brand prompt master"
        subtitle="Templates used by the agent and campaign suggester. OMG is seeded from the built-in copy; new brands can clone it and edit JSON."
        icon={<Palette size={28} strokeWidth={1.75} />}
      />

      {err && (
        <p
          style={{
            fontSize: 13,
            color: "var(--danger)",
            marginBottom: 12,
            padding: 10,
            background: "var(--bg-elevated)",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          {err}
        </p>
      )}

      <div className="omg-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Add brand</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
          Creates a new master row. Content is copied from the chosen existing brand, then you can edit the full template on the next page.
        </p>
        <div style={{ display: "grid", gap: 10, maxWidth: 400 }}>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Slug (id)
            <input
              className="omg-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="e.g. acme-corp"
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Display name
            <input
              className="omg-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Clone template from
            <input
              className="omg-input"
              value={cloneFrom}
              onChange={(e) => setCloneFrom(e.target.value.trim())}
              placeholder="omg"
            />
          </label>
          <button type="button" className="omg-btn-primary" disabled={saving} onClick={() => void onCreate()}>
            {saving ? "…" : "Create from clone"}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Master rows</h2>
      {brands == null ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : brands.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No rows in the database. Run the migration, then <code>npm run db:seed</code> to insert OMG.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {brands.map((b) => (
            <li key={b.id} className="omg-card" style={{ padding: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{b.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <code>{b.slug}</code>
                  {b.isSystem ? " · system" : null}
                </div>
              </div>
              <Link href={`/settings/brand-masters/${encodeURIComponent(b.slug)}/edit`} className="omg-btn-ghost" style={{ textDecoration: "none" }}>
                Edit template
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
