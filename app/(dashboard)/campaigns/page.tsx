"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CampaignCadence,
  CampaignContentMode,
  CampaignStatus,
  CampaignTheme,
  Platform,
} from "@prisma/client";
import {
  CampaignScheduleEditor,
  defaultScheduleValue,
  type ScheduleEditorValue,
} from "./schedule-editor";

type SuggestedCampaign = {
  name: string;
  description: string;
  keywords: string;
  brandVoice: string;
  theme: CampaignTheme;
  contentMode: CampaignContentMode;
  themePitch: string;
  cadence: CampaignCadence;
  dayOfWeek: number;
  hourOfDay: number;
  postsPerRun: number;
  autoApprove: boolean;
  rationale: string;
};

type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  theme: CampaignTheme;
  contentMode: CampaignContentMode;
  cadence: CampaignCadence;
  keywords: string;
  nextRunAt: string | null;
  autoApprove: boolean;
  timezone: string;
  _count: { posts: number; runs: number };
};

const DOW: { v: number; label: string }[] = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

const THEME_LANES: { id: CampaignTheme; label: string }[] = [
  { id: "RELIABILITY_PRO", label: "Reliability & compliance" },
  { id: "INNOVATION_TECH", label: "Innovation & visibility" },
  { id: "SPEED_URGENCY", label: "Speed & time-critical" },
];

const PLATFORMS: { v: Platform; label: string }[] = [
  { v: "FACEBOOK", label: "Facebook" },
  { v: "INSTAGRAM", label: "Instagram" },
  { v: "LINKEDIN", label: "LinkedIn" },
  { v: "OMG", label: "OMG" },
];

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--overlay-scrim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
  backdropFilter: "blur(3px)",
};

type AiDraft = {
  name: string;
  contentMode: CampaignContentMode;
  keywords: string;
  description: string;
  brandVoice: string;
  theme: CampaignTheme;
  platforms: Platform[];
  postsPerRun: number;
  totalPostsCap: string;
  autoApprove: boolean;
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [createModal, setCreateModal] = useState<"closed" | "chooser" | "ai" | "manual">("closed");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiCreating, setAiCreating] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestHint, setSuggestHint] = useState("");
  const [lastHintUsed, setLastHintUsed] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedCampaign[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [confirmAi, setConfirmAi] = useState<SuggestedCampaign | null>(null);
  const [aiSchedule, setAiSchedule] = useState<ScheduleEditorValue | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [contentMode, setContentMode] = useState<CampaignContentMode>("NEWS_DRIVEN");
  const [description, setDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [aiThemePitch, setAiThemePitch] = useState<string | null>(null);
  const [theme, setTheme] = useState<CampaignTheme>("INNOVATION_TECH");
  const [schedule, setSchedule] = useState<ScheduleEditorValue>(() => defaultScheduleValue());
  const [platforms, setPlatforms] = useState<Platform[]>(["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"]);
  const [postsPerRun, setPostsPerRun] = useState(1);
  const [totalPostsCap, setTotalPostsCap] = useState<string>("");
  const [autoApprove, setAutoApprove] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const cRes = await fetch("/api/campaigns");
    if (cRes.ok) setCampaigns(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestSuggestions() {
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions([]);
    const hint = suggestHint.trim();
    try {
      const res = await fetch("/api/campaigns/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: hint || undefined }),
      });
      const data = (await res.json()) as { campaigns?: SuggestedCampaign[]; error?: string };
      if (!res.ok) {
        setSuggestError(data.error ?? `Error ${res.status}`);
        return;
      }
      setSuggestions(data.campaigns ?? []);
      setLastHintUsed(hint || null);
    } catch {
      setSuggestError("Network error");
    } finally {
      setSuggesting(false);
    }
  }

  function resetManualForm() {
    setName("");
    setKeywords("");
    setContentMode("NEWS_DRIVEN");
    setDescription("");
    setBrandVoice("");
    setAiThemePitch(null);
    setTheme("INNOVATION_TECH");
    setSchedule(defaultScheduleValue());
    setPlatforms(["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"]);
    setPostsPerRun(1);
    setTotalPostsCap("");
    setAutoApprove(false);
    setShowAdvanced(false);
  }

  function openCreate() {
    setCreateModal("chooser");
    setSuggestions([]);
    setSuggestError(null);
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function toggleAiPlatform(p: Platform) {
    setAiDraft((prev) => {
      if (!prev) return prev;
      const next = prev.platforms.includes(p) ? prev.platforms.filter((x) => x !== p) : [...prev.platforms, p];
      return { ...prev, platforms: next.length ? next : prev.platforms };
    });
  }

  async function createFromPayload(status: CampaignStatus) {
    if (!name.trim()) return;
    if (contentMode === "NEWS_DRIVEN" && !keywords.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          keywords: keywords.trim(),
          contentMode,
          description: description.trim() || undefined,
          brandVoice: brandVoice.trim() || undefined,
          theme,
          cadence: schedule.cadence,
          dayOfWeek: schedule.dayOfWeek,
          hourOfDay: schedule.hourOfDay,
          timezone: schedule.timezone,
          daysOfWeekMulti: schedule.daysOfWeekMulti,
          specificDates: schedule.specificDates,
          testDatetimes: schedule.testDatetimes,
          platforms: platforms.length ? platforms : undefined,
          postsPerRun,
          totalPostsCap: totalPostsCap ? parseInt(totalPostsCap, 10) : undefined,
          autoApprove,
          status,
        }),
      });
      if (res.ok) {
        const c = (await res.json()) as { id: string };
        setCreateModal("closed");
        resetManualForm();
        await load();
        if (status === "ACTIVE") {
          router.push(`/campaigns/${c.id}`);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function createCampaignManual(startActive: boolean) {
    await createFromPayload(startActive ? "ACTIVE" : "DRAFT");
  }

  function openAiConfirm(s: SuggestedCampaign) {
    setConfirmAi(s);
    setAiSchedule({
      ...defaultScheduleValue(),
      timezone: schedule.timezone,
      cadence: s.cadence,
      dayOfWeek: s.dayOfWeek,
      hourOfDay: s.hourOfDay,
      daysOfWeekMulti: [s.dayOfWeek],
      specificDates: [],
      testDatetimes: [],
    });
    setAiDraft({
      name: s.name,
      contentMode: s.contentMode ?? "NEWS_DRIVEN",
      keywords: s.keywords,
      description: s.description,
      brandVoice: s.brandVoice,
      theme: s.theme,
      platforms: ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"],
      postsPerRun: s.postsPerRun,
      totalPostsCap: "",
      autoApprove: s.autoApprove,
    });
  }

  async function createFromAiSuggestion(sch: ScheduleEditorValue, draft: AiDraft, startActive: boolean) {
    if (!draft.name.trim()) return;
    if (draft.contentMode === "NEWS_DRIVEN" && !draft.keywords.trim()) return;
    if (draft.platforms.length === 0) return;
    setAiCreating(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          keywords: draft.keywords.trim(),
          contentMode: draft.contentMode,
          description: draft.description.trim() || undefined,
          brandVoice: draft.brandVoice.trim() || undefined,
          theme: draft.theme,
          cadence: sch.cadence,
          dayOfWeek: sch.dayOfWeek,
          hourOfDay: sch.hourOfDay,
          timezone: sch.timezone,
          daysOfWeekMulti: sch.daysOfWeekMulti,
          specificDates: sch.specificDates,
          testDatetimes: sch.testDatetimes,
          platforms: draft.platforms.length ? draft.platforms : undefined,
          postsPerRun: draft.postsPerRun,
          totalPostsCap: draft.totalPostsCap ? parseInt(draft.totalPostsCap, 10) : undefined,
          autoApprove: draft.autoApprove,
          status: (startActive ? "ACTIVE" : "DRAFT") as CampaignStatus,
        }),
      });
      if (res.ok) {
        const c = (await res.json()) as { id: string };
        setConfirmAi(null);
        setAiSchedule(null);
        setAiDraft(null);
        setCreateModal("closed");
        setSuggestions([]);
        setLastHintUsed(null);
        setSuggestHint("");
        await load();
        router.push(`/campaigns/${c.id}`);
      }
    } finally {
      setAiCreating(false);
    }
  }

  async function patchStatus(id: string, next: CampaignStatus) {
    setPatchingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) await load();
    } finally {
      setPatchingId(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Campaigns
          </h1>
          <p className="page-subtitle" style={{ maxWidth: 640 }}>
            Create a campaign with one AI click, or fill in the details yourself — lane, platforms, and caps
            are tucked away under &quot;Advanced&quot;.
          </p>
        </div>
        <button type="button" className="omg-btn-primary" onClick={openCreate}>
          New campaign
        </button>
      </div>

      {/* Create flow modals */}
      {createModal === "chooser" && (
        <div style={overlayStyle} onClick={() => setCreateModal("closed")} role="presentation">
          <div
            className="omg-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, padding: 24 }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Choose how to create</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>
              Let AI design it for you, or fill in a short form yourself.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                type="button"
                className="omg-card"
                style={{
                  padding: 20,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                }}
                onClick={() => {
                  setCreateModal("ai");
                  setSuggestions([]);
                  setSuggestError(null);
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "var(--text-primary)",
                  }}
                >
                  Let AI design it
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Describe what you want, get 3 ideas, then pick one — you&apos;ll confirm the schedule before we save.
                </p>
              </button>
              <button
                type="button"
                className="omg-card"
                style={{
                  padding: 20,
                  cursor: "pointer",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                }}
                onClick={() => {
                  resetManualForm();
                  setCreateModal("manual");
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "var(--text-primary)",
                  }}
                >
                  Build it myself
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Name, content mode, keywords, schedule — more options inside &quot;Advanced&quot;.
                </p>
              </button>
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="omg-btn-ghost" onClick={() => setCreateModal("closed")}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {createModal === "ai" && (
        <div style={overlayStyle} onClick={() => setCreateModal("closed")} role="presentation">
          <div
            className="omg-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 720, padding: 24, maxHeight: "90vh", overflow: "auto" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Campaign from AI</h2>
              <button type="button" className="omg-btn-ghost" onClick={() => setCreateModal("chooser")}>
                ← Back
              </button>
            </div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "var(--text-secondary)" }}>
              Your prompt for the AI
              <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                (optional — the more specific, the better)
              </span>
            </label>
            <textarea
              className="omg-input"
              style={{ width: "100%", minHeight: 72 }}
              value={suggestHint}
              onChange={(e) => setSuggestHint(e.target.value)}
              placeholder={
                "e.g. Focus on air-freight news for pharma shippers, one post per week on Thursdays around 4pm"
              }
            />
            <p style={{ margin: "6px 0 12px", fontSize: 11, color: "var(--text-muted)" }}>
              We send this exact text to Gemini as the highest-priority request. Every idea must serve your prompt.
            </p>
            <button
              type="button"
              className="omg-btn-primary"
              disabled={suggesting}
              onClick={() => void requestSuggestions()}
            >
              {suggesting ? "Thinking…" : "Get 3 ideas from AI"}
            </button>
            {suggestError && (
              <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>{suggestError}</p>
            )}

            {lastHintUsed && suggestions.length > 0 && (
              <div
                style={{
                  marginTop: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--accent-dim)",
                  border: "1px solid var(--ring-accent)",
                  fontSize: 12,
                  color: "var(--accent)",
                }}
              >
                Using your prompt: <strong>&ldquo;{lastHintUsed}&rdquo;</strong>
              </div>
            )}

            {suggestions.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="omg-card"
                    style={{ padding: 14, background: "var(--bg-elevated)" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 6 }}>{s.themePitch}</div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        margin: "0 0 8px",
                        lineHeight: 1.4,
                      }}
                    >
                      {s.description.slice(0, 180)}
                      {s.description.length > 180 ? "…" : ""}
                    </p>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                      {s.contentMode === "SELF_PROMO" ? "Self-promo" : "News-driven"} ·{" "}
                      {DOW.find((d) => d.v === s.dayOfWeek)?.label} · {s.hourOfDay}:00 · {s.cadence}
                    </div>
                    {s.rationale && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                          margin: "0 0 10px",
                        }}
                      >
                        {s.rationale}
                      </div>
                    )}
                    <button
                      type="button"
                      className="omg-btn-primary"
                      style={{ width: "100%", fontSize: 12 }}
                      onClick={() => openAiConfirm(s)}
                    >
                      Use this idea →
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="omg-btn-ghost" onClick={() => setCreateModal("closed")}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {createModal === "manual" && (
        <div style={overlayStyle} onClick={() => setCreateModal("closed")} role="presentation">
          <div
            className="omg-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, padding: 24, maxHeight: "92vh", overflow: "auto" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New campaign</h2>
              <button
                type="button"
                className="omg-btn-ghost"
                onClick={() => {
                  setCreateModal("chooser");
                }}
              >
                ← Back
              </button>
            </div>
            {aiThemePitch && (
              <p style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 12px" }}>
                AI angle: <strong>{aiThemePitch}</strong> ({theme})
              </p>
            )}
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Campaign name
                <input className="omg-input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Content mode</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      name="contentMode"
                      checked={contentMode === "NEWS_DRIVEN"}
                      onChange={() => setContentMode("NEWS_DRIVEN")}
                    />
                    News / trend
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      name="contentMode"
                      checked={contentMode === "SELF_PROMO"}
                      onChange={() => setContentMode("SELF_PROMO")}
                    />
                    Self-promo
                  </label>
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                {contentMode === "NEWS_DRIVEN"
                  ? "Keywords (used as Google search query)"
                  : "Topics / services (optional)"}
                <input
                  className="omg-input"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={
                    contentMode === "NEWS_DRIVEN" ? "air cargo, logistics" : "e.g. charter services"
                  }
                />
              </label>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Schedule</div>
                <CampaignScheduleEditor
                  idPrefix="man"
                  value={schedule}
                  onChange={(patch) => setSchedule((prev) => ({ ...prev, ...patch }))}
                />
              </div>

              <details
                open={showAdvanced}
                onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
              >
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Advanced — lane, platforms, posts per run, cap, description
                </summary>
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    Description
                    <textarea
                      className="omg-input"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    Brand voice
                    <textarea
                      className="omg-input"
                      rows={2}
                      value={brandVoice}
                      onChange={(e) => setBrandVoice(e.target.value)}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    Lane
                    <select
                      className="omg-input"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as CampaignTheme)}
                    >
                      {THEME_LANES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id} — {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Platforms</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {PLATFORMS.map((p) => (
                        <label
                          key={p.v}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                        >
                          <input
                            type="checkbox"
                            checked={platforms.includes(p.v)}
                            onChange={() => togglePlatform(p.v)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                      Posts per run
                      <input
                        className="omg-input"
                        type="number"
                        min={1}
                        max={5}
                        value={postsPerRun}
                        onChange={(e) => setPostsPerRun(parseInt(e.target.value, 10) || 1)}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                      Total cap (optional)
                      <input
                        className="omg-input"
                        type="number"
                        min={0}
                        placeholder="∞"
                        value={totalPostsCap}
                        onChange={(e) => setTotalPostsCap(e.target.value)}
                      />
                    </label>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                    />
                    Auto-approve
                  </label>
                </div>
              </details>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="omg-btn-ghost"
                  disabled={saving}
                  onClick={() => void createCampaignManual(false)}
                >
                  {saving ? "…" : "Save as draft"}
                </button>
                <button
                  type="button"
                  className="omg-btn-primary"
                  disabled={saving}
                  onClick={() => void createCampaignManual(true)}
                >
                  {saving ? "…" : "Start now"}
                </button>
                <button
                  type="button"
                  className="omg-btn-ghost"
                  onClick={() => setCreateModal("closed")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmAi && aiSchedule && aiDraft && (
        <div
          style={overlayStyle}
          onClick={() => {
            setConfirmAi(null);
            setAiSchedule(null);
            setAiDraft(null);
          }}
          role="presentation"
        >
          <div
            className="omg-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, padding: 24, maxHeight: "92vh", overflow: "auto" }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700 }}>Review and schedule</h3>
            {confirmAi.themePitch && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.4 }}>
                {confirmAi.themePitch}
              </p>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Campaign name
                <input
                  className="omg-input"
                  value={aiDraft.name}
                  onChange={(e) => setAiDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                />
              </label>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Content mode</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      name="aiContentMode"
                      checked={aiDraft.contentMode === "NEWS_DRIVEN"}
                      onChange={() => setAiDraft((d) => (d ? { ...d, contentMode: "NEWS_DRIVEN" } : d))}
                    />
                    News / trend
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      name="aiContentMode"
                      checked={aiDraft.contentMode === "SELF_PROMO"}
                      onChange={() => setAiDraft((d) => (d ? { ...d, contentMode: "SELF_PROMO" } : d))}
                    />
                    Self-promo
                  </label>
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                {aiDraft.contentMode === "NEWS_DRIVEN"
                  ? "Keywords (used as Google search query)"
                  : "Topics / services (optional)"}
                <input
                  className="omg-input"
                  value={aiDraft.keywords}
                  onChange={(e) => setAiDraft((d) => (d ? { ...d, keywords: e.target.value } : d))}
                  placeholder={
                    aiDraft.contentMode === "NEWS_DRIVEN" ? "air cargo, logistics" : "e.g. charter services"
                  }
                />
              </label>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Schedule</div>
                <CampaignScheduleEditor
                  idPrefix="ai"
                  value={aiSchedule}
                  onChange={(patch) => setAiSchedule((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  Posts per run
                  <input
                    className="omg-input"
                    type="number"
                    min={1}
                    max={5}
                    value={aiDraft.postsPerRun}
                    onChange={(e) =>
                      setAiDraft((d) =>
                        d
                          ? {
                              ...d,
                              postsPerRun: Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)),
                            }
                          : d
                      )
                    }
                  />
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    alignSelf: "end",
                    paddingBottom: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={aiDraft.autoApprove}
                    onChange={(e) =>
                      setAiDraft((d) => (d ? { ...d, autoApprove: e.target.checked } : d))
                    }
                  />
                  Auto-approve
                </label>
              </div>

              <details open>
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Advanced — description, brand voice, lane, platforms, cap
                </summary>
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    Description
                    <textarea
                      className="omg-input"
                      rows={2}
                      value={aiDraft.description}
                      onChange={(e) => setAiDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    Brand voice
                    <textarea
                      className="omg-input"
                      rows={2}
                      value={aiDraft.brandVoice}
                      onChange={(e) => setAiDraft((d) => (d ? { ...d, brandVoice: e.target.value } : d))}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    Lane
                    <select
                      className="omg-input"
                      value={aiDraft.theme}
                      onChange={(e) =>
                        setAiDraft((d) =>
                          d ? { ...d, theme: e.target.value as CampaignTheme } : d
                        )
                      }
                    >
                      {THEME_LANES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id} — {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Platforms</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {PLATFORMS.map((p) => (
                        <label
                          key={p.v}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                        >
                          <input
                            type="checkbox"
                            checked={aiDraft.platforms.includes(p.v)}
                            onChange={() => toggleAiPlatform(p.v)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, maxWidth: 260 }}>
                    Total cap (optional)
                    <input
                      className="omg-input"
                      type="number"
                      min={0}
                      placeholder="∞"
                      value={aiDraft.totalPostsCap}
                      onChange={(e) => setAiDraft((d) => (d ? { ...d, totalPostsCap: e.target.value } : d))}
                    />
                  </label>
                </div>
              </details>
            </div>

            <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              <strong>Save as draft</strong> keeps the campaign off the scheduler.{" "}
              <strong>Start now</strong> sets it <strong>ACTIVE</strong> so the scheduler runs on schedule.
            </p>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
              <button
                type="button"
                className="omg-btn-ghost"
                onClick={() => {
                  setConfirmAi(null);
                  setAiSchedule(null);
                  setAiDraft(null);
                }}
                disabled={aiCreating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="omg-btn-ghost"
                disabled={aiCreating}
                onClick={() => void createFromAiSuggestion(aiSchedule, aiDraft, false)}
              >
                {aiCreating ? "…" : "Save as draft"}
              </button>
              <button
                type="button"
                className="omg-btn-primary"
                disabled={aiCreating}
                onClick={() => void createFromAiSuggestion(aiSchedule, aiDraft, true)}
              >
                {aiCreating ? "Creating…" : "Start now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No campaigns yet — click &quot;New campaign&quot; above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="omg-card"
              style={{
                padding: "12px 16px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <Link
                href={`/campaigns/${c.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  flex: 1,
                  minWidth: 200,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {c.status} · {c.contentMode === "SELF_PROMO" ? "self-promo" : "news"} · {c.cadence} ·{" "}
                  {c.theme}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 480,
                  }}
                >
                  {c.keywords}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>
                  Next: {c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "—"} · {c._count.posts} posts
                </div>
              </Link>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.preventDefault()}>
                {c.status === "DRAFT" && (
                  <button
                    type="button"
                    className="omg-btn-primary"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    disabled={patchingId === c.id}
                    onClick={(e) => {
                      e.preventDefault();
                      void patchStatus(c.id, "ACTIVE");
                    }}
                  >
                    {patchingId === c.id ? "…" : "Activate"}
                  </button>
                )}
                {c.status === "ACTIVE" && (
                  <button
                    type="button"
                    className="omg-btn-ghost"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                    disabled={patchingId === c.id}
                    onClick={(e) => {
                      e.preventDefault();
                      void patchStatus(c.id, "DRAFT");
                    }}
                  >
                    {patchingId === c.id ? "…" : "Pause"}
                  </button>
                )}
                <Link
                  href={`/campaigns/${c.id}`}
                  className="omg-btn-ghost"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
