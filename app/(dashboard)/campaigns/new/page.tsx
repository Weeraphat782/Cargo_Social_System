"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CampaignCadence, CampaignContentMode, CampaignStatus, CampaignTheme } from "@prisma/client";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui";
import {
  defaultCampaignFormFieldsValue,
  CampaignFormFields,
  type CampaignFormFieldsValue,
} from "../campaign-form-fields";
import { defaultScheduleValue, endOfDayYmdToIso } from "../schedule-editor";
import { MAX_PUBLISH_TIME_SLOTS, parsePublishTimesFromText } from "@/lib/campaigns/publish-times";

type Step = "chooser" | "manual" | "ai" | "ai-confirm";

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
  imagesPerPost: number;
  autoApprove: boolean;
  rationale: string;
  campaignGoal?: string;
  contentPillars?: string;
};

const DOW: { v: number; label: string }[] = [
  { v: 0, label: "Sun" }, { v: 1, label: "Mon" }, { v: 2, label: "Tue" },
  { v: 3, label: "Wed" }, { v: 4, label: "Thu" }, { v: 5, label: "Fri" }, { v: 6, label: "Sat" },
];

const DEFAULT_BRAND_OPTIONS = [
  { id: "omg", displayName: "OMG" },
  { id: "acme", displayName: "Acme (demo)" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("chooser");
  const [brandOptions, setBrandOptions] = useState(DEFAULT_BRAND_OPTIONS);
  const [form, setForm] = useState<CampaignFormFieldsValue>(() => defaultCampaignFormFieldsValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI state
  const [suggestHint, setSuggestHint] = useState("");
  const [aiBrand, setAiBrand] = useState("omg");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedCampaign[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [confirmAi, setConfirmAi] = useState<SuggestedCampaign | null>(null);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { brands?: { id: string; displayName: string }[] } | null) => {
        if (d?.brands?.length) setBrandOptions(d.brands);
      })
      .catch(() => {});
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
        body: JSON.stringify({ hint: hint || undefined, brandTemplateId: aiBrand }),
      });
      const data = (await res.json()) as { campaigns?: SuggestedCampaign[]; error?: string };
      if (!res.ok) { setSuggestError(data.error ?? `Error ${res.status}`); return; }
      setSuggestions(data.campaigns ?? []);
      setLastHint(hint || null);
    } catch {
      setSuggestError("Network error");
    } finally {
      setSuggesting(false);
    }
  }

  function openAiConfirm(s: SuggestedCampaign) {
    setConfirmAi(s);
    setForm({
      ...defaultCampaignFormFieldsValue(),
      name: s.name,
      brandTemplateId: aiBrand,
      contentMode: s.contentMode ?? "NEWS_DRIVEN",
      contentLanguage: "en",
      campaignGoal: s.campaignGoal ?? "",
      targetPersona: "",
      contentPillars: s.contentPillars ?? "",
      platformStrategies: { FACEBOOK: "", INSTAGRAM: "", LINKEDIN: "", OMG: "" },
      keywords: s.keywords,
      description: s.description,
      brandVoice: s.brandVoice,
      theme: s.theme,
      platforms: ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"],
      postsPerRun: s.postsPerRun,
      imagesPerPost: s.imagesPerPost ?? 1,
      totalPostsCap: "",
      autoApprove: s.autoApprove,
      publishHourOfDay: null,
      publishMinuteOfHour: null,
      publishSpacingMinutes: null,
      publishTimesText: "",
      schedule: {
        ...defaultScheduleValue(),
        cadence: s.cadence,
        dayOfWeek: s.dayOfWeek,
        hourOfDay: s.hourOfDay,
        daysOfWeekMulti: [s.dayOfWeek],
        specificDates: [],
        scheduledDatetimes: [],
      },
    });
    setStep("ai-confirm");
  }

  async function createFromPayload(status: CampaignStatus) {
    const { name, brandTemplateId, keywords, contentMode, contentLanguage, campaignGoal, targetPersona, contentPillars, description, brandVoice, theme, schedule, platforms, postsPerRun, imagesPerPost, totalPostsCap, autoApprove } = form;
    if (!name.trim()) { setError("Campaign name is required."); return; }
    if (contentMode === "NEWS_DRIVEN" && !keywords.trim()) { setError("Keywords are required for news-driven campaigns."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brandTemplateId,
          keywords: keywords.trim(),
          contentMode,
          contentLanguage,
          campaignGoal: campaignGoal.trim() || undefined,
          targetPersona: targetPersona.trim() || undefined,
          contentPillars: contentPillars.trim() || undefined,
          platformStrategies: form.platformStrategies,
          description: description.trim() || undefined,
          brandVoice: brandVoice.trim() || undefined,
          theme,
          cadence: schedule.cadence,
          dayOfWeek: schedule.dayOfWeek,
          hourOfDay: schedule.hourOfDay,
          timezone: schedule.timezone,
          daysOfWeekMulti: schedule.daysOfWeekMulti,
          specificDates: schedule.specificDates,
          scheduledDatetimes: schedule.scheduledDatetimes,
          platforms: platforms.length ? platforms : undefined,
          postsPerRun,
          imagesPerPost,
          totalPostsCap: totalPostsCap ? parseInt(totalPostsCap, 10) : undefined,
          autoApprove,
          publishHourOfDay: form.publishHourOfDay,
          publishMinuteOfHour: form.publishMinuteOfHour,
          publishSpacingMinutes: form.publishSpacingMinutes,
          publishTimes: parsePublishTimesFromText(form.publishTimesText, MAX_PUBLISH_TIME_SLOTS),
          endAt: schedule.runUntilYmd?.trim() ? endOfDayYmdToIso(schedule.runUntilYmd.trim(), schedule.timezone) : null,
          status,
        }),
      });
      if (res.ok) {
        const c = (await res.json()) as { id: string };
        router.push(`/campaigns/${c.id}`);
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Error ${res.status}`);
      }
    } finally {
      setSaving(false);
    }
  }

  // ── CHOOSER ─────────────────────────────────────────────────────────────────
  if (step === "chooser") {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <Link href="/campaigns" style={{ fontSize: 12, color: "var(--accent)" }}>← Campaigns</Link>
        </div>
        <PageHeader
          title="New campaign"
          subtitle="Choose how you want to create your campaign."
          icon={<Megaphone size={28} strokeWidth={1.75} />}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 700, marginTop: 8 }}>
          <button
            type="button"
            className="omg-card"
            style={{ padding: 28, cursor: "pointer", textAlign: "left", border: "1px solid var(--border)", background: "var(--bg-surface)" }}
            onClick={() => { setForm(defaultCampaignFormFieldsValue()); setError(null); setStep("manual"); }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Build it myself</div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Fill in the name, mode, keywords, schedule, strategy, and platform guidance yourself — all fields on one page.
            </p>
          </button>
          <button
            type="button"
            className="omg-card"
            style={{ padding: 28, cursor: "pointer", textAlign: "left", border: "1px solid var(--border)", background: "var(--bg-surface)" }}
            onClick={() => { setSuggestions([]); setSuggestError(null); setStep("ai"); }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Let AI design it</div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Describe what you want in plain language, get 3 ideas from AI, pick one — then review and confirm the details.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ── AI — HINT + SUGGESTIONS ──────────────────────────────────────────────────
  if (step === "ai") {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={() => setStep("chooser")} style={{ background: "none", border: "none", fontSize: 12, color: "var(--accent)", cursor: "pointer", padding: 0 }}>← Back</button>
        </div>
        <PageHeader title="Campaign from AI" subtitle="Describe your goal and let AI suggest 3 tailored campaign ideas." icon={<Megaphone size={28} strokeWidth={1.75} />} />

        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 28, alignItems: "start", marginTop: 8 }}>
          {/* LEFT — Input panel */}
          <div className="omg-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Brand template
              <select className="omg-input" value={aiBrand} onChange={(e) => setAiBrand(e.target.value)}>
                {brandOptions.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Your prompt
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -2 }}>Optional — the more specific, the better</span>
              <textarea
                className="omg-input"
                rows={5}
                value={suggestHint}
                onChange={(e) => setSuggestHint(e.target.value)}
                placeholder="e.g. Focus on air-freight news for pharma shippers, one post per week on Thursdays around 4pm"
                style={{ resize: "vertical" }}
              />
            </label>
            <button type="button" className="omg-btn-primary" disabled={suggesting} onClick={() => void requestSuggestions()}>
              {suggesting ? "Thinking…" : "Get 3 ideas from AI"}
            </button>
            {suggestError && <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>{suggestError}</p>}
          </div>

          {/* RIGHT — Suggestions */}
          <div>
            {lastHint && suggestions.length > 0 && (
              <div style={{ marginBottom: 14, padding: "8px 14px", borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--ring-accent)", fontSize: 12, color: "var(--accent)" }}>
                AI ideas based on: <strong>&ldquo;{lastHint}&rdquo;</strong>
              </div>
            )}
            {suggestions.length === 0 && !suggesting && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 10 }}>
                Your 3 campaign ideas will appear here after clicking <strong>Get 3 ideas from AI</strong>.
              </div>
            )}
            {suggestions.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {suggestions.map((s, i) => (
                  <div key={i} className="omg-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--accent)" }}>{s.themePitch}</div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                      {s.description.slice(0, 200)}{s.description.length > 200 ? "…" : ""}
                    </p>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {s.contentMode === "SELF_PROMO" ? "Self-promo" : "News-driven"} ·{" "}
                      {DOW.find((d) => d.v === s.dayOfWeek)?.label} · {s.hourOfDay}:00 · {s.cadence}
                    </div>
                    {s.rationale && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{s.rationale}</div>
                    )}
                    <button type="button" className="omg-btn-primary" style={{ marginTop: 4 }} onClick={() => openAiConfirm(s)}>
                      Use this idea →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MANUAL / AI-CONFIRM — Full-page form ─────────────────────────────────────
  const isAiConfirm = step === "ai-confirm";
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => { setError(null); setStep(isAiConfirm ? "ai" : "chooser"); }} style={{ background: "none", border: "none", fontSize: 12, color: "var(--accent)", cursor: "pointer", padding: 0 }}>
          ← {isAiConfirm ? "Back to ideas" : "Back"}
        </button>
      </div>
      <PageHeader
        title={isAiConfirm ? `Review: ${confirmAi?.name ?? "Campaign"}` : "New campaign"}
        subtitle={isAiConfirm ? (confirmAi?.themePitch ?? "Review and adjust the AI-generated details before saving.") : "Fill in the details below — all fields are on this page."}
        icon={<Megaphone size={28} strokeWidth={1.75} />}
      />

      {error && (
        <div style={{ padding: "10px 14px", marginBottom: 16, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <CampaignFormFields
        value={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onScheduleChange={(patch) => setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }))}
        idPrefix={isAiConfirm ? "aic" : "new"}
        layout="page"
        showAdvanced={true}
        onAdvancedOpenChange={() => {}}
        brandOptions={brandOptions}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="omg-btn-primary" disabled={saving} onClick={() => void createFromPayload("ACTIVE")}>
          {saving ? "Creating…" : "Start now (Active)"}
        </button>
        <button type="button" className="omg-btn-ghost" disabled={saving} onClick={() => void createFromPayload("DRAFT")}>
          {saving ? "…" : "Save as draft"}
        </button>
        <Link href="/campaigns" className="omg-btn-ghost" style={{ textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
