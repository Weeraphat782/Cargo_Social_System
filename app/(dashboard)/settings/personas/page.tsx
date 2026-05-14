"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { PageHeader, Skeleton } from "@/components/ui";

type PersonaRow = {
  id: string;
  name: string;
  role: string | null;
  description: string;
  createdAt: string;
};

type PersonaFull = PersonaRow & {
  demographics: string | null;
  painPoints: string | null;
  goals: string | null;
};

const emptyForm = (): Omit<PersonaFull, "id" | "createdAt"> => ({
  name: "",
  role: "",
  demographics: "",
  painPoints: "",
  goals: "",
  description: "",
});

export default function PersonasPage() {
  const [personas, setPersonas] = useState<PersonaRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/personas");
    if (!res.ok) { setErr(`Error ${res.status}`); setPersonas([]); return; }
    const data = (await res.json()) as { personas: PersonaRow[] };
    setPersonas(data.personas);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openEdit(id: string) {
    const res = await fetch(`/api/personas/${id}`);
    if (!res.ok) return;
    const p = (await res.json()) as PersonaFull;
    setForm({
      name: p.name,
      role: p.role ?? "",
      demographics: p.demographics ?? "",
      painPoints: p.painPoints ?? "",
      goals: p.goals ?? "",
      description: p.description,
    });
    setEditingId(id);
    setShowCreate(false);
  }

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setShowCreate(true);
  }

  async function save() {
    if (!form.name.trim() || !form.description.trim()) {
      setErr("Name and description are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const url = editingId ? `/api/personas/${editingId}` : "/api/personas";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role?.trim() || null,
          demographics: form.demographics?.trim() || null,
          painPoints: form.painPoints?.trim() || null,
          goals: form.goals?.trim() || null,
          description: form.description.trim(),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? `Error ${res.status}`);
        return;
      }
      setShowCreate(false);
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this persona?")) return;
    await fetch(`/api/personas/${id}`, { method: "DELETE" });
    await load();
  }

  const isOpen = showCreate || editingId !== null;

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        title="Personas"
        subtitle="Define target audience personas. Select one on a campaign so the AI writes copy for the right person."
        icon={<Users size={26} strokeWidth={1.75} />}
        actions={
          !isOpen ? (
            <button type="button" className="omg-btn-primary" onClick={openCreate}>
              New persona
            </button>
          ) : undefined
        }
      />

      {err && (
        <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{err}</p>
      )}

      {/* Create / Edit form */}
      {isOpen && (
        <div className="omg-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>
            {editingId ? "Edit persona" : "New persona"}
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Name *
                <input
                  className="omg-input"
                  value={form.name}
                  placeholder="e.g. Enterprise Logistics CFO"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Role / title
                <input
                  className="omg-input"
                  value={form.role ?? ""}
                  placeholder="e.g. Chief Financial Officer"
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Demographics
                <input
                  className="omg-input"
                  value={form.demographics ?? ""}
                  placeholder="e.g. 40-55 yrs, SEA, 200-1000 employee company"
                  onChange={(e) => setForm((f) => ({ ...f, demographics: e.target.value }))}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Goals
                <input
                  className="omg-input"
                  value={form.goals ?? ""}
                  placeholder="e.g. Reduce freight cost, improve SLA"
                  onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
                />
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Pain points
              <input
                className="omg-input"
                value={form.painPoints ?? ""}
                placeholder="e.g. Freight cost visibility, customs delays, unreliable ETAs"
                onChange={(e) => setForm((f) => ({ ...f, painPoints: e.target.value }))}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Description (injected into AI prompt) *
              <textarea
                className="omg-input"
                rows={4}
                value={form.description}
                placeholder="Full persona description the AI will use — e.g. 'CFO at a mid-size logistics company in Southeast Asia. Focused on cost visibility and reducing freight spend. Pain points: unpredictable surcharges, customs delays. Goals: SLA reliability, consolidated billing.'"
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                This exact text is injected as &quot;Target persona&quot; in the AI prompt. Be specific.
              </span>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="omg-btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create persona"}
            </button>
            <button
              type="button"
              className="omg-btn-ghost"
              onClick={() => { setShowCreate(false); setEditingId(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {personas === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton variant="card" height={72} />
          <Skeleton variant="card" height={72} />
        </div>
      ) : personas.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No personas yet — create one to start targeting your campaigns.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {personas.map((p) => (
            <div
              key={p.id}
              className="omg-card"
              style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                {p.role && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{p.role}</div>
                )}
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {p.description}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" className="omg-btn-ghost" style={{ fontSize: 12 }} onClick={() => void openEdit(p.id)}>
                  Edit
                </button>
                <button type="button" className="omg-btn-danger" style={{ fontSize: 12 }} onClick={() => void remove(p.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
