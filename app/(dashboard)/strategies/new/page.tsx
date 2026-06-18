"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { FileText } from "lucide-react";
import type { BrandOption } from "@/app/(dashboard)/campaigns/campaign-form-fields";

const MAX_BYTES = 20 * 1024 * 1024;

export default function NewStrategyPage() {
  const router = useRouter();
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([
    { id: "omg", displayName: "OMG" },
    { id: "acme", displayName: "Acme (demo)" },
  ]);
  const [brandTemplateId, setBrandTemplateId] = useState("omg");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { brands?: BrandOption[] } | null) => {
        if (d?.brands?.length) setBrandOptions(d.brands);
      })
      .catch(() => {});
  }, []);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("PDF must be at most 20 MB.");
      setFile(null);
      return;
    }
    setFile(f);
    if (!name.trim() && f.name) {
      setName(f.name.replace(/\.pdf$/i, ""));
    }
  }

  async function submit() {
    if (!file) {
      setError("Choose a PDF.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("brandTemplateId", brandTemplateId);
      if (name.trim()) fd.append("name", name.trim());

      const res = await fetch("/api/strategies", { method: "POST", body: fd });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      if (data.id) {
        router.push(`/strategies/${data.id}?autoAnalyze=1`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/strategies" style={{ fontSize: 12, color: "var(--accent)" }}>
          ← Strategies
        </Link>
      </div>
      <PageHeader
        title="Upload strategy"
        subtitle="PDF marketing strategy (max 20 MB). AI will propose campaigns grounded in quotes from the document."
        icon={<FileText size={28} strokeWidth={1.75} />}
      />

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          Brand
          <select
            className="omg-input"
            value={brandTemplateId}
            onChange={(e) => setBrandTemplateId(e.target.value)}
          >
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          Strategy name (optional)
          <input
            className="omg-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Defaults to PDF filename"
          />
        </label>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              document.getElementById("strategy-pdf-input")?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pickFile(f);
          }}
          onClick={() => document.getElementById("strategy-pdf-input")?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "var(--accent-dim)" : "var(--bg-elevated)",
          }}
        >
          <input
            id="strategy-pdf-input"
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Drop PDF here or click to browse</p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            {file ? file.name : "No file selected"}
          </p>
        </div>

        <button
          type="button"
          className="omg-btn-primary"
          disabled={saving || !file}
          onClick={() => void submit()}
        >
          {saving ? "Uploading…" : "Upload & analyze"}
        </button>
      </div>
    </div>
  );
}
