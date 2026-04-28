"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Palette } from "lucide-react";
import { BrandMasterTemplatePreview } from "@/components/brand-master-template-preview";
import { PageHeader, Skeleton } from "@/components/ui";

type Row = {
  id: string;
  slug: string;
  displayName: string;
  payload: object;
  isSystem: boolean;
  updatedAt: string;
};

export default function BrandMasterEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = decodeURIComponent(params.slug as string);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Row | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/brand-masters/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      setErr(res.status === 404 ? "Not found" : `Error ${res.status}`);
      setRow(null);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as Row;
    setRow(data);
    setDisplayName(data.displayName);
    setJsonText(JSON.stringify(data.payload, null, 2));
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!row) return;
    setSaving(true);
    setErr(null);
    let payload: object;
    try {
      payload = JSON.parse(jsonText) as object;
    } catch {
      setErr("Invalid JSON. Fix the payload before saving.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/brand-masters/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || row.displayName,
          payload,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? `Error ${res.status}`);
        return;
      }
      router.push("/settings/brand-masters");
    } catch {
      setErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 800 }}>
        <Skeleton variant="card" height={64} style={{ marginBottom: 16 }} />
        <Skeleton variant="line" width="100%" height={12} style={{ marginBottom: 8 }} />
        <Skeleton variant="card" height={400} />
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ maxWidth: 800 }}>
        <p style={{ color: "var(--danger)" }}>{err ?? "Not found."}</p>
        <Link href="/settings/brand-masters" className="omg-btn-ghost" style={{ display: "inline-block", marginTop: 12 }}>
          Back
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/settings/brand-masters" className="omg-btn-ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={16} />
          All brands
        </Link>
      </p>
      <PageHeader
        title={`Edit: ${row.displayName}`}
        subtitle={`Template JSON for slug ${row.slug}. Must match the app schema (services, themeBundles, suggestCampaign, selfPromo, etc.).`}
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

      <label style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
        Display name
        <input className="omg-input" style={{ marginTop: 4 }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        Payload (JSON)
      </label>
      <textarea
        className="omg-input"
        spellCheck={false}
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        style={{
          width: "100%",
          minHeight: 420,
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      />

      <BrandMasterTemplatePreview jsonText={jsonText} />

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="omg-btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <Link href="/settings/brand-masters" className="omg-btn-ghost" style={{ textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
