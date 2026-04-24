"use client";

import { useCallback, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CampaignCadence,
  CampaignContentMode,
  CampaignStatus,
  CampaignTheme,
  Prisma,
} from "@prisma/client";
import { Megaphone } from "lucide-react";
import { PageHeader, ProgressBar, Skeleton, StatCard } from "@/components/ui";
import { getCampaignProgressBar } from "@/lib/campaigns-progress";
import {
  defaultCampaignFormFieldsValue,
  CampaignFormFields,
  type CampaignFormFieldsValue,
} from "./campaign-form-fields";
import { defaultScheduleValue, endOfDayYmdToIso, type ScheduleEditorValue } from "./schedule-editor";

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
  startAt: string;
  endAt: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  postsPerRun: number;
  totalPostsCap: number | null;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue;
  _count: { posts: number; runs: number };
  publishedCount: number;
};

/** Short countdown line for campaign row (list view). */
function formatNextRunShort(iso: string) {
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  if (diff <= 0) return "Due now";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `Next in ${h}h ${m}m`;
  if (m > 0) return `Next in ${m}m`;
  return "Due soon";
}

const DOW: { v: number; label: string }[] = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
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

type AiDraft = Omit<CampaignFormFieldsValue, "schedule">;

export default function CampaignsClient({ initialCampaigns }: { initialCampaigns: CampaignRow[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [createModal, setCreateModal] = useState<"closed" | "chooser" | "ai" | "manual">("closed");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const [manualForm, setManualForm] = useState<CampaignFormFieldsValue>(() => defaultCampaignFormFieldsValue());
  const [aiThemePitch, setAiThemePitch] = useState<string | null>(null);
  const [aiAdvancedOpen, setAiAdvancedOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const cRes = await fetch("/api/campaigns");
    if (cRes.ok) setCampaigns(await cRes.json());
    setLoading(false);
  }, []);

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
    setManualForm(defaultCampaignFormFieldsValue());
    setAiThemePitch(null);
    setShowAdvanced(false);
  }

  function openCreate() {
    setCreateModal("chooser");
    setSuggestions([]);
    setSuggestError(null);
  }

  async function createFromPayload(status: CampaignStatus) {
    const {
      name,
      keywords,
      contentMode,
      description,
      brandVoice,
      theme,
      schedule,
      platforms,
      postsPerRun,
      totalPostsCap,
      autoApprove,
    } = manualForm;
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
          endAt: schedule.runUntilYmd?.trim()
            ? endOfDayYmdToIso(schedule.runUntilYmd.trim(), schedule.timezone)
            : null,
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
    setAiAdvancedOpen(true);
    setAiSchedule({
      ...defaultScheduleValue(),
      timezone: manualForm.schedule.timezone,
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
          endAt: sch.runUntilYmd?.trim()
            ? endOfDayYmdToIso(sch.runUntilYmd.trim(), sch.timezone)
            : null,
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

  const statusCounts = {
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    draft: campaigns.filter((c) => c.status === "DRAFT").length,
    done: campaigns.filter((c) => c.status === "COMPLETED").length,
  };

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle='Create a campaign with one AI click, or fill in the details yourself — lane, platforms, and caps are tucked away under "Advanced".'
        icon={<Megaphone size={28} strokeWidth={1.75} />}
        actions={
          <button type="button" className="omg-btn-primary" onClick={openCreate}>
            New campaign
          </button>
        }
      />

      {!loading && campaigns.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="Active" value={statusCounts.active} />
          <StatCard label="Draft" value={statusCounts.draft} />
          <StatCard label="Completed" value={statusCounts.done} />
        </div>
      )}

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
                AI angle: <strong>{aiThemePitch}</strong> ({manualForm.theme})
              </p>
            )}
            <div style={{ display: "grid", gap: 12 }}>
              <CampaignFormFields
                value={manualForm}
                onChange={(patch) => setManualForm((prev) => ({ ...prev, ...patch }))}
                onScheduleChange={(patch) =>
                  setManualForm((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }))
                }
                idPrefix="man"
                layout="manual"
                showAdvanced={showAdvanced}
                onAdvancedOpenChange={setShowAdvanced}
              />

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
              <CampaignFormFields
                value={{ ...aiDraft, schedule: aiSchedule }}
                onChange={(patch) => setAiDraft((d) => (d ? { ...d, ...patch } : d))}
                onScheduleChange={(patch) =>
                  setAiSchedule((prev) => (prev ? { ...prev, ...patch } : prev))
                }
                idPrefix="ai"
                layout="ai"
                showAdvanced={aiAdvancedOpen}
                onAdvancedOpenChange={setAiAdvancedOpen}
              />
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
        </div>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No campaigns yet — click &quot;New campaign&quot; above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campaigns.map((c) => {
            const progress = getCampaignProgressBar({
              totalPostsCap: c.totalPostsCap,
              endAt: c.endAt,
              cadence: c.cadence,
              dayOfWeek: c.dayOfWeek,
              hourOfDay: c.hourOfDay,
              timezone: c.timezone,
              startAt: c.startAt,
              postsPerRun: c.postsPerRun,
              customCron: c.customCron,
              scheduleConfig: c.scheduleConfig,
              postCount: c._count.posts,
              publishedCount: c.publishedCount,
            });
            return (
            <div
              key={c.id}
              className="omg-card is-interactive"
              style={{
                position: "relative",
                padding: "12px 16px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16, flex: 1, minWidth: 0 }}>
                <div
                  style={{
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
                    {c.endAt
                      ? ` · until ${new Date(c.endAt).toLocaleDateString()}`
                      : null}
                  </div>
                </div>
                <div
                  style={{
                    width: 160,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    alignItems: "stretch",
                  }}
                >
                  {progress.showBar ? (
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--text-muted)" }}>{progress.subtitle}</p>
                      <ProgressBar
                        value={progress.value}
                        max={Math.max(1, progress.max)}
                        label="Posts"
                        compact
                        ratioLabelOverride={progress.ratioLabel}
                      />
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{progress.subtitle}</p>
                  )}
                  {c.nextRunAt && c.status === "ACTIVE" ? (
                    <span
                      className="omg-badge omg-badge-scheduled"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        maxWidth: "100%",
                      }}
                    >
                      <span
                        className="pulse-dot"
                        style={{ width: 6, height: 6, flexShrink: 0 }}
                        aria-hidden
                      />
                      <span suppressHydrationWarning>{formatNextRunShort(c.nextRunAt)}</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div
                style={{ display: "flex", gap: 6, flexShrink: 0, position: "relative", zIndex: 2 }}
                onClick={(e) => e.stopPropagation()}
              >
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
              <Link
                href={`/campaigns/${c.id}`}
                aria-label={`Open ${c.name}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  borderRadius: "inherit",
                }}
              />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
