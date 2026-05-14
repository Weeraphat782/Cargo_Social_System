"use client";

import { useState, useCallback, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = {
  key: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  platforms: string[];
  scheduledFor: string;
  indexInRun: number;
  pillar: string | null;
  brief: string | null;
  keywordHint: string | null;
  planStatus: "NONE" | "PENDING" | "EXECUTED" | "SKIPPED";
  planId: string | null;
  postId: string | null;
  postStatus: string | null;
  theme: string;
  contentMode: string;
};

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: "#1877F2",
  INSTAGRAM: "#E1306C",
  LINKEDIN: "#0A66C2",
  OMG: "#f97316",
};

function PlatformDots({ platforms }: { platforms: string[] }) {
  if (!platforms?.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center", marginLeft: 3 }}>
      {platforms.map((p) => (
        <span key={p} title={p.charAt(0) + p.slice(1).toLowerCase()}
          style={{ width: 5, height: 5, borderRadius: "50%", background: PLATFORM_COLORS[p] ?? "#888", flexShrink: 0 }} />
      ))}
    </span>
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function slotColor(slot: Slot): { bg: string; text: string; border: string } {
  if (slot.postStatus === "PUBLISHED" || slot.postStatus === "SCHEDULED") {
    return { bg: "#16a34a1a", text: "#16a34a", border: "#16a34a40" };
  }
  if (slot.planStatus === "EXECUTED" || slot.postId) {
    return { bg: "#2563eb1a", text: "#2563eb", border: "#2563eb40" };
  }
  if (slot.planStatus === "SKIPPED") {
    return { bg: "var(--bg-muted)", text: "var(--text-muted)", border: "var(--border)" };
  }
  if (slot.planStatus === "PENDING") {
    return { bg: "#d9770620", text: "#d97706", border: "#d9770640" };
  }
  return { bg: "var(--bg-muted)", text: "var(--text-secondary)", border: "var(--border)" };
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { bg: "var(--bg-muted)", border: "var(--border)", label: "Unplanned" },
    { bg: "#d9770620", border: "#d9770640", label: "Planned" },
    { bg: "#2563eb1a", border: "#2563eb40", label: "Generated" },
    { bg: "#16a34a1a", border: "#16a34a40", label: "Published" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: it.bg, border: `1px solid ${it.border}`, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

type DetailPanelProps = {
  slot: Slot;
  onClose: () => void;
  onSaved: (updated: Slot) => void;
};

function DetailPanel({ slot, onClose, onSaved }: DetailPanelProps) {
  const [pillar, setPillar] = useState(slot.pillar ?? "");
  const [brief, setBrief] = useState(slot.brief ?? "");
  const [keywordHint, setKeywordHint] = useState(slot.keywordHint ?? "");
  const [saving, setSaving] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when slot changes (e.g. after batch advise)
  useEffect(() => {
    setPillar(slot.pillar ?? "");
    setBrief(slot.brief ?? "");
    setKeywordHint(slot.keywordHint ?? "");
  }, [slot.key, slot.pillar, slot.brief, slot.keywordHint]);

  const isExecuted = slot.planStatus === "EXECUTED";
  const isReadOnly = isExecuted;
  const date = parseISO(slot.scheduledFor);

  async function handleGenerateBrief() {
    setGeneratingBrief(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: slot.campaignId,
          scheduledFor: slot.scheduledFor,
          indexInRun: slot.indexInRun,
          pillar: pillar || null,
          keywordHint: keywordHint || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setBrief(data.brief ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brief generation failed");
    } finally {
      setGeneratingBrief(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let res: Response;
      const body = { pillar: pillar || null, brief: brief || null, keywordHint: keywordHint || null };
      if (slot.planId) {
        res = await fetch(`/api/planner/plans/${slot.planId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/planner/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: slot.campaignId, scheduledFor: slot.scheduledFor, indexInRun: slot.indexInRun, ...body }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved({ ...slot, pillar: data.pillar, brief: data.brief, keywordHint: data.keywordHint, planStatus: data.status, planId: data.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    setError(null);
    try {
      let res: Response;
      if (slot.planId) {
        res = await fetch(`/api/planner/plans/${slot.planId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SKIPPED" }),
        });
      } else {
        const createRes = await fetch("/api/planner/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: slot.campaignId, scheduledFor: slot.scheduledFor, indexInRun: slot.indexInRun, pillar: pillar || null, brief: brief || null, keywordHint: keywordHint || null }),
        });
        const created = await createRes.json();
        res = await fetch(`/api/planner/plans/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SKIPPED" }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Skip failed");
      onSaved({ ...slot, planStatus: "SKIPPED", planId: data.id ?? slot.planId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skip failed");
    } finally {
      setSkipping(false);
    }
  }

  async function handleUnplan() {
    if (!slot.planId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/planner/plans/${slot.planId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onSaved({ ...slot, pillar: null, brief: null, keywordHint: null, planStatus: "NONE", planId: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unplan failed");
    } finally {
      setSaving(false);
    }
  }

  const colors = slotColor(slot);

  return (
    <div style={{ width: 480, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 18px 14px", borderBottom: "1px solid var(--border)", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "2px 8px" }}>
              {slot.planStatus === "NONE" ? "Unplanned" : slot.planStatus === "PENDING" ? "Planned" : slot.planStatus === "EXECUTED" ? "Generated" : "Skipped"}
            </span>
            {slot.contentMode === "NEWS_DRIVEN" && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px" }}>News</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slot.campaignName}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{format(date, "EEEE, d MMMM yyyy")} · {format(date, "HH:mm")}</span>
            {slot.indexInRun > 0 && <span>· Post {slot.indexInRun + 1}</span>}
            {slot.platforms?.length > 0 && (
              <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                ·
                {slot.platforms.map((p) => (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: PLATFORM_COLORS[p] ?? "#888", flexShrink: 0 }} />
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {slot.postId && (
          <a href={`/posts/${slot.postId}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            View generated post ({slot.postStatus ?? "draft"})
          </a>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Content Pillar</label>
          <input type="text" value={pillar} onChange={(e) => setPillar(e.target.value)} disabled={isReadOnly} placeholder="e.g. Educational, Promotional, Behind the scenes"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: isReadOnly ? "var(--bg-muted)" : "var(--bg-input, var(--bg-surface))", color: "var(--text-primary)", outline: "none" }} />
        </div>

        {slot.contentMode === "NEWS_DRIVEN" && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              Keyword Hint <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(overrides campaign keywords)</span>
            </label>
            <input type="text" value={keywordHint} onChange={(e) => setKeywordHint(e.target.value)} disabled={isReadOnly} placeholder="Leave blank to use campaign keywords"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 6, background: isReadOnly ? "var(--bg-muted)" : "var(--bg-input, var(--bg-surface))", color: "var(--text-primary)", outline: "none" }} />
          </div>
        )}

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Editorial Brief</label>
            {!isReadOnly && (
              <button type="button" onClick={handleGenerateBrief} disabled={generatingBrief}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-dim)", cursor: generatingBrief ? "default" : "pointer", opacity: generatingBrief ? 0.6 : 1, fontWeight: 600 }}>
                {generatingBrief ? "Generating…" : "✦ AI Brief"}
              </button>
            )}
          </div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} disabled={isReadOnly}
            placeholder="Describe what angle this post should take, what it should achieve, and what the audience should feel."
            rows={9}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 13, lineHeight: 1.6, border: "1px solid var(--border)", borderRadius: 6, background: isReadOnly ? "var(--bg-muted)" : "var(--bg-input, var(--bg-surface))", color: "var(--text-primary)", resize: "vertical", outline: "none" }} />
        </div>

        {error && <div style={{ fontSize: 12, color: "#ef4444", background: "#ef444415", border: "1px solid #ef444430", borderRadius: 6, padding: "8px 12px" }}>{error}</div>}
      </div>

      {/* Footer */}
      {!isReadOnly && (
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : slot.planId ? "Update plan" : "Save plan"}
          </button>
          {slot.planStatus !== "SKIPPED" && (
            <button type="button" onClick={handleSkip} disabled={skipping}
              style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-muted)", color: "var(--text-secondary)", cursor: skipping ? "default" : "pointer", opacity: skipping ? 0.7 : 1 }}>
              Skip
            </button>
          )}
          {slot.planId && (
            <button type="button" onClick={handleUnplan} disabled={saving} title="Remove plan"
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: saving ? "default" : "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calendar slot chip ───────────────────────────────────────────────────────

function SlotChip({ slot, isSelected, onClick }: { slot: Slot; isSelected: boolean; onClick: () => void }) {
  const c = slotColor(slot);
  const time = format(parseISO(slot.scheduledFor), "HH:mm");
  const campaignShort = slot.campaignName.length > 13 ? slot.campaignName.slice(0, 12) + "…" : slot.campaignName;
  const pillarShort = slot.pillar ? (slot.pillar.length > 16 ? slot.pillar.slice(0, 15) + "…" : slot.pillar) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${time} · ${slot.campaignName}${slot.pillar ? ` · ${slot.pillar}` : ""}${slot.brief ? " · has brief" : ""}`}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "3px 5px 3px", borderRadius: 4,
        border: `1px solid ${isSelected ? c.text : c.border}`,
        background: c.bg, color: c.text,
        cursor: "pointer", lineHeight: 1.3,
        outline: isSelected ? `2px solid ${c.text}` : "none",
        outlineOffset: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
        <span style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isSelected ? 600 : 500, flex: 1, minWidth: 0 }}>
          {time} {campaignShort}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0, marginLeft: 3 }}>
          {slot.brief && <span style={{ fontSize: 9, opacity: 0.7 }}>✦</span>}
          <PlatformDots platforms={slot.platforms} />
        </span>
      </div>
      {pillarShort && (
        <div style={{ fontSize: 9, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
          {pillarShort}
        </div>
      )}
    </button>
  );
}

// ─── Calendar day cell ────────────────────────────────────────────────────────

function CalendarDay({ date, isCurrentMonth, slots, selectedKey, onSelectSlot }: {
  date: Date; isCurrentMonth: boolean; slots: Slot[]; selectedKey: string | null; onSelectSlot: (s: Slot) => void;
}) {
  const today = isToday(date);
  const MAX_VISIBLE = 3;
  const visible = slots.slice(0, MAX_VISIBLE);
  const overflow = slots.length - MAX_VISIBLE;

  return (
    <div style={{ minHeight: 96, padding: "5px 5px 3px", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: isCurrentMonth ? "var(--bg-surface)" : "var(--bg-muted)" }}>
      <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: today ? "var(--accent)" : "none", color: today ? "#fff" : isCurrentMonth ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: today ? 700 : 400, marginBottom: 3 }}>
        {format(date, "d")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {visible.map((slot) => (
          <SlotChip key={slot.key} slot={slot} isSelected={slot.key === selectedKey} onClick={() => onSelectSlot(slot)} />
        ))}
        {overflow > 0 && <span style={{ fontSize: 9, color: "var(--text-muted)", paddingLeft: 3 }}>+{overflow} more</span>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlannerClient() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [batchState, setBatchState] = useState<{ mode: "plan" | "advise"; done: number; total: number } | null>(null);

  const gridStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

  const loadSlots = useCallback(async (month: Date) => {
    setLoading(true);
    try {
      const from = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const to = format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const res = await fetch(`/api/planner?from=${from}&to=${to}`);
      if (!res.ok) return;
      const data = await res.json();
      setSlots(data.slots ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSlots(currentMonth); }, [currentMonth, loadSlots]);

  function handleSlotSaved(updated: Slot) {
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s.key === updated.key);
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setSelectedSlot(updated);
  }

  // Slots in the current calendar month only (not padded days)
  const monthSlots = slots.filter((s) => isSameMonth(parseISO(s.scheduledFor), currentMonth));
  const unplannedSlots = monthSlots.filter((s) => s.planStatus === "NONE");
  const plannedCount = monthSlots.filter((s) => s.planStatus === "PENDING").length;
  const executedCount = monthSlots.filter((s) => s.planStatus === "EXECUTED" || s.postId).length;

  // ── Plan All (no AI, just save plans with current pillar) ──────────────────
  async function handlePlanAll() {
    if (unplannedSlots.length === 0) return;
    setBatchState({ mode: "plan", done: 0, total: unplannedSlots.length });
    const CHUNK = 50;
    let done = 0;
    const updated: Slot[] = [];

    for (let i = 0; i < unplannedSlots.length; i += CHUNK) {
      const chunk = unplannedSlots.slice(i, i + CHUNK);
      try {
        const res = await fetch("/api/planner/plans/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slots: chunk.map((s) => ({
              campaignId: s.campaignId,
              scheduledFor: s.scheduledFor,
              indexInRun: s.indexInRun,
              pillar: s.pillar ?? null,
              brief: null,
              keywordHint: null,
            })),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { plans?: { id: string; pillar: string | null }[] };
          const plans = data.plans ?? [];
          chunk.forEach((slot, j) => {
            const plan = plans[j];
            if (plan) {
              updated.push({
                ...slot,
                planStatus: "PENDING",
                planId: plan.id,
                pillar: plan.pillar ?? slot.pillar,
              });
            }
          });
        }
      } catch {
        /* continue */
      }
      done += chunk.length;
      setBatchState({ mode: "plan", done: Math.min(done, unplannedSlots.length), total: unplannedSlots.length });
    }

    setSlots((prev) => {
      const next = [...prev];
      for (const u of updated) {
        const idx = next.findIndex((s) => s.key === u.key);
        if (idx !== -1) next[idx] = u;
      }
      return next;
    });
    if (selectedSlot) {
      const found = updated.find((u) => u.key === selectedSlot.key);
      if (found) setSelectedSlot(found);
    }
    setBatchState(null);
  }

  // ── AI Advise All (generate briefs + save plans for all unplanned slots) ───
  async function handleAdviseAll() {
    if (unplannedSlots.length === 0) return;
    const CHUNK = 10;
    const total = unplannedSlots.length;
    setBatchState({ mode: "advise", done: 0, total });

    let done = 0;
    const allSaved: { key: string; planId?: string; brief?: string; pillar?: string | null }[] = [];

    for (let i = 0; i < unplannedSlots.length; i += CHUNK) {
      const chunk = unplannedSlots.slice(i, i + CHUNK);
      try {
        const res = await fetch("/api/planner/advise-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slots: chunk.map((s) => ({
              campaignId: s.campaignId,
              scheduledFor: s.scheduledFor,
              indexInRun: s.indexInRun,
              pillar: s.pillar ?? null,
              keywordHint: s.keywordHint ?? null,
            })),
          }),
        });
        if (res.ok) {
          done += chunk.length;
        }
      } catch { /* continue */ }
      done = Math.min(done + chunk.length, total);
      setBatchState({ mode: "advise", done, total });
    }

    // Reload slots to get fresh data with briefs
    await loadSlots(currentMonth);
    setBatchState(null);
  }

  // Build calendar grid
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const slotsByDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    const dateKey = format(parseISO(slot.scheduledFor), "yyyy-MM-dd");
    if (!slotsByDate.has(dateKey)) slotsByDate.set(dateKey, []);
    slotsByDate.get(dateKey)!.push(slot);
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const isBusy = !!batchState;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Content Planner</h1>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                Plan what your campaigns post — the agent follows this blueprint at execution time.
              </p>
            </div>

            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-primary)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", minWidth: 140, textAlign: "center" }}>
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button type="button" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-primary)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <button type="button" onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}>
                Today
              </button>
            </div>
          </div>

          {/* Stats + action row */}
          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            {loading ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</span>
            ) : batchState ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {batchState.mode === "plan" ? "Planning" : "Generating AI briefs"} {batchState.done}/{batchState.total}…
              </span>
            ) : (
              <>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{monthSlots.length}</strong> slots
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <strong style={{ color: "#d97706" }}>{plannedCount}</strong> planned
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <strong style={{ color: "#2563eb" }}>{executedCount}</strong> generated
                </span>
                {unplannedSlots.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    <strong style={{ color: "var(--text-secondary)" }}>{unplannedSlots.length}</strong> unplanned
                  </span>
                )}
              </>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Legend />
              {unplannedSlots.length > 0 && !isBusy && (
                <>
                  <button type="button" onClick={handlePlanAll} disabled={isBusy}
                    style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 500 }}>
                    Plan all ({unplannedSlots.length})
                  </button>
                  <button type="button" onClick={handleAdviseAll} disabled={isBusy}
                    style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
                    ✦ AI Advise all ({unplannedSlots.length})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
            {dayNames.map((d) => (
              <div key={d} style={{ padding: "7px 7px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderRight: "1px solid var(--border)" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              return (
                <CalendarDay
                  key={dateKey}
                  date={day}
                  isCurrentMonth={isSameMonth(day, currentMonth)}
                  slots={slotsByDate.get(dateKey) ?? []}
                  selectedKey={selectedSlot?.key ?? null}
                  onSelectSlot={(slot) => setSelectedSlot(slot)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedSlot && (
        <DetailPanel
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSaved={handleSlotSaved}
        />
      )}
    </div>
  );
}
