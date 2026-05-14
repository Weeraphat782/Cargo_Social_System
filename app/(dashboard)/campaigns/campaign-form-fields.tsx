"use client";

import { useEffect, useState } from "react";
import type { Campaign, CampaignContentMode, CampaignTheme, Platform, Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { parseScheduleConfig } from "@/lib/campaigns/schedule-config";
import { parsePublishTimesJson } from "@/lib/campaigns/publish-times";
import { CampaignScheduleEditor, defaultScheduleValue, type ScheduleEditorValue } from "./schedule-editor";

export const THEME_LANES: { id: CampaignTheme; label: string }[] = [
  { id: "RELIABILITY_PRO", label: "Reliability & compliance" },
  { id: "INNOVATION_TECH", label: "Innovation & visibility" },
  { id: "SPEED_URGENCY", label: "Speed & time-critical" },
];

export const PLATFORM_OPTIONS: { v: Platform; label: string }[] = [
  { v: "FACEBOOK", label: "Facebook" },
  { v: "INSTAGRAM", label: "Instagram" },
  { v: "LINKEDIN", label: "LinkedIn" },
  { v: "OMG", label: "OMG" },
];

export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "th", label: "ภาษาไทย" },
];

export type PlatformStrategiesValue = {
  FACEBOOK: string;
  INSTAGRAM: string;
  LINKEDIN: string;
  OMG: string;
};

export type CampaignFormFieldsValue = {
  name: string;
  /** Registry id: omg, acme, etc. */
  brandTemplateId: string;
  contentMode: CampaignContentMode;
  contentLanguage: string;
  campaignGoal: string;
  targetPersona: string;
  contentPillars: string;
  platformStrategies: PlatformStrategiesValue;
  keywords: string;
  description: string;
  brandVoice: string;
  theme: CampaignTheme;
  schedule: ScheduleEditorValue;
  platforms: Platform[];
  postsPerRun: number;
  imagesPerPost: number;
  totalPostsCap: string;
  autoApprove: boolean;
  publishHourOfDay: number | null;
  publishMinuteOfHour: number | null;
  /** Minutes between posts after first scheduled slot (when using base publish time). Ignored if explicit times set. */
  publishSpacingMinutes: number | null;
  /** Newline-separated HH:mm entries; when non-empty, overrides spacing. */
  publishTimesText: string;
};

type Props = {
  value: CampaignFormFieldsValue;
  onChange: (patch: Partial<CampaignFormFieldsValue>) => void;
  onScheduleChange: (patch: Partial<ScheduleEditorValue>) => void;
  idPrefix: string;
  /** "manual"/"ai" = modal layout. "page" = full-width 2-column layout for dedicated pages. */
  layout: "manual" | "ai" | "page";
  showAdvanced: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  /** When true, advanced fields are always shown (no collapsible details) */
  alwaysShowAdvanced?: boolean;
  brandOptions: { id: string; displayName: string }[];
};

export function defaultCampaignFormFieldsValue(): CampaignFormFieldsValue {
  return {
    name: "",
    brandTemplateId: "omg",
    keywords: "",
    contentMode: "NEWS_DRIVEN",
    contentLanguage: "en",
    campaignGoal: "",
    targetPersona: "",
    contentPillars: "",
    platformStrategies: { FACEBOOK: "", INSTAGRAM: "", LINKEDIN: "", OMG: "" },
    description: "",
    brandVoice: "",
    theme: "INNOVATION_TECH",
    schedule: defaultScheduleValue(),
    platforms: ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"],
    postsPerRun: 1,
    imagesPerPost: 1,
    totalPostsCap: "",
    autoApprove: false,
    publishHourOfDay: null,
    publishMinuteOfHour: null,
    publishSpacingMinutes: null,
    publishTimesText: "",
  };
}

const FORM_PLATFORM_FALLBACK: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

/** Map a Campaign row to the same shape used by create/edit forms. */
export function campaignToFormFieldsValue(
  c: Pick<
    Campaign,
    | "name"
    | "keywords"
    | "contentMode"
    | "contentLanguage"
    | "campaignGoal"
    | "targetPersona"
    | "contentPillars"
    | "platformStrategies"
    | "description"
    | "brandVoice"
    | "theme"
    | "cadence"
    | "dayOfWeek"
    | "hourOfDay"
    | "timezone"
    | "scheduleConfig"
    | "platforms"
    | "postsPerRun"
    | "imagesPerPost"
    | "totalPostsCap"
    | "autoApprove"
    | "publishHourOfDay"
    | "publishMinuteOfHour"
    | "publishSpacingMinutes"
    | "publishTimes"
    | "brandTemplateId"
  > & { endAt?: string | Date | null }
): CampaignFormFieldsValue {
  const base = defaultScheduleValue();
  const parsed = parseScheduleConfig(c.cadence, c.scheduleConfig);
  const peDays = parsed.daysOfWeek?.length
    ? parsed.daysOfWeek
    : c.cadence === "WEEKLY_MULTI"
      ? [c.dayOfWeek ?? 1]
      : base.daysOfWeekMulti;
  const tz = c.timezone || base.timezone;
  const endRaw = c.endAt;
  const runUntilYmd =
    endRaw == null
      ? null
      : formatInTimeZone(
          endRaw instanceof Date ? endRaw : new Date(String(endRaw)),
          tz,
          "yyyy-MM-dd"
        );

  return {
    name: c.name,
    brandTemplateId: c.brandTemplateId ?? "omg",
    keywords: c.keywords,
    contentMode: c.contentMode,
    contentLanguage: c.contentLanguage ?? "en",
    campaignGoal: c.campaignGoal ?? "",
    targetPersona: c.targetPersona ?? "",
    contentPillars: c.contentPillars ?? "",
    platformStrategies: (() => {
      const ps = (c.platformStrategies ?? {}) as Prisma.JsonObject;
      return {
        FACEBOOK: typeof ps.FACEBOOK === "string" ? ps.FACEBOOK : "",
        INSTAGRAM: typeof ps.INSTAGRAM === "string" ? ps.INSTAGRAM : "",
        LINKEDIN: typeof ps.LINKEDIN === "string" ? ps.LINKEDIN : "",
        OMG: typeof ps.OMG === "string" ? ps.OMG : "",
      };
    })(),
    description: c.description ?? "",
    brandVoice: c.brandVoice ?? "",
    theme: c.theme,
    schedule: {
      cadence: c.cadence,
      dayOfWeek: c.dayOfWeek ?? base.dayOfWeek,
      hourOfDay: c.hourOfDay ?? base.hourOfDay,
      timezone: tz,
      daysOfWeekMulti: peDays,
      specificDates: parsed.dates?.length ? parsed.dates : [],
      scheduledDatetimes: parsed.datetimes?.length ? parsed.datetimes : [],
      runUntilYmd,
    },
    platforms: c.platforms?.length ? [...c.platforms] : [...FORM_PLATFORM_FALLBACK],
    postsPerRun: c.postsPerRun,
    imagesPerPost: c.imagesPerPost ?? 1,
    totalPostsCap: c.totalPostsCap != null ? String(c.totalPostsCap) : "",
    autoApprove: c.autoApprove,
    publishHourOfDay: c.publishHourOfDay ?? null,
    publishMinuteOfHour:
      c.publishHourOfDay != null ? (c.publishMinuteOfHour ?? 0) : null,
    publishSpacingMinutes: c.publishSpacingMinutes ?? null,
    publishTimesText: parsePublishTimesJson(c.publishTimes).join("\n"),
  };
}

function togglePlatform(prev: Platform[], p: Platform): Platform[] {
  if (prev.includes(p)) {
    const next = prev.filter((x) => x !== p);
    return next.length ? next : prev;
  }
  return [...prev, p];
}

function PublishTimeFields({
  idPrefix,
  publishHourOfDay,
  publishMinuteOfHour,
  publishSpacingMinutes,
  publishTimesText,
  onChange,
}: {
  idPrefix: string;
  publishHourOfDay: number | null;
  publishMinuteOfHour: number | null;
  publishSpacingMinutes: number | null;
  publishTimesText: string;
  onChange: (patch: Partial<CampaignFormFieldsValue>) => void;
}) {
  const explicitTimes = publishTimesText.trim().length > 0;
  const spacingEnabled = publishHourOfDay != null && !explicitTimes;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>Publish time (campaign TZ)</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, width: 110 }}>
          Hour (0–23)
          <input
            className="omg-input"
            type="number"
            min={0}
            max={23}
            id={`${idPrefix}-pub-h`}
            value={publishHourOfDay ?? ""}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === "") {
                onChange({
                  publishHourOfDay: null,
                  publishMinuteOfHour: null,
                  publishSpacingMinutes: null,
                });
                return;
              }
              const h = Math.max(0, Math.min(23, parseInt(v, 10) || 0));
              onChange({
                publishHourOfDay: h,
                publishMinuteOfHour: publishMinuteOfHour ?? 0,
              });
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, width: 110 }}>
          Minute (0–59)
          <input
            className="omg-input"
            type="number"
            min={0}
            max={59}
            disabled={publishHourOfDay == null}
            id={`${idPrefix}-pub-m`}
            value={publishHourOfDay != null ? publishMinuteOfHour ?? 0 : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (publishHourOfDay == null) return;
              if (v === "") {
                onChange({ publishMinuteOfHour: 0 });
                return;
              }
              onChange({
                publishMinuteOfHour: Math.max(0, Math.min(59, parseInt(v, 10) || 0)),
              });
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, width: 120 }}>
          Between posts (min)
          <input
            className="omg-input"
            type="number"
            min={1}
            max={1440}
            disabled={!spacingEnabled}
            id={`${idPrefix}-pub-gap`}
            value={spacingEnabled ? publishSpacingMinutes ?? "" : ""}
            placeholder="5"
            title="Minutes after the first post’s scheduled time for each additional post"
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({
                publishSpacingMinutes:
                  v === "" ? null : Math.max(1, Math.min(1440, parseInt(v, 10) || 5)),
              });
            }}
          />
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Specific publish times (HH:mm), one per line — overrides spacing
        <textarea
          className="omg-input"
          rows={4}
          id={`${idPrefix}-pub-times`}
          value={publishTimesText}
          placeholder={"09:00\n09:15\n09:30"}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          onChange={(e) => onChange({ publishTimesText: e.target.value })}
        />
      </label>
      <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.35 }}>
        With auto-approve: set a base hour/minute and gap (e.g. 15) so each post in the run schedules at
        increasing times; or list exact HH:mm values (cycles if there are more posts than lines). Leave hour
        empty to publish ~2 min after the agent runs.
      </span>
    </div>
  );
}

type PersonaOption = { id: string; name: string; role: string | null; description: string };

export function CampaignFormFields({
  value,
  onChange,
  onScheduleChange,
  idPrefix,
  layout,
  showAdvanced,
  onAdvancedOpenChange,
  alwaysShowAdvanced = false,
  brandOptions,
}: Props) {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => (r.ok ? r.json() : { personas: [] }))
      .then((d: { personas: PersonaOption[] }) => setPersonas(d.personas ?? []))
      .catch(() => {});
  }, []);

  const {
    name,
    brandTemplateId,
    contentMode,
    contentLanguage,
    campaignGoal,
    targetPersona,
    contentPillars,
    platformStrategies,
    keywords,
    description,
    brandVoice,
    theme,
    schedule,
    platforms,
    postsPerRun,
    imagesPerPost,
    totalPostsCap,
    autoApprove,
    publishHourOfDay,
    publishMinuteOfHour,
    publishSpacingMinutes,
    publishTimesText,
  } = value;

  const advancedBlock = (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Description
        <textarea
          className="omg-input"
          rows={2}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Campaign goal
        <input
          className="omg-input"
          value={campaignGoal}
          placeholder="e.g. Brand Awareness, Lead Generation, Engagement"
          onChange={(e) => onChange({ campaignGoal: e.target.value })}
        />
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {personas.length > 0 && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Load persona
            <select
              className="omg-input"
              style={{ maxWidth: 320 }}
              value={selectedPersonaId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedPersonaId(pid);
                if (pid) {
                  const p = personas.find((x) => x.id === pid);
                  if (p) onChange({ targetPersona: p.description });
                }
              }}
            >
              <option value="">— select a saved persona —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.role ? ` · ${p.role}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Target persona
          <textarea
            className="omg-input"
            rows={2}
            value={targetPersona}
            placeholder="e.g. CFO at mid-size logistics company — pain: cost visibility, goal: reduce freight spend"
            onChange={(e) => {
              setSelectedPersonaId("");
              onChange({ targetPersona: e.target.value });
            }}
          />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Select a saved persona above or type a custom description. AI will tailor copy for this audience.
          </span>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Content pillars
        <input
          className="omg-input"
          value={contentPillars}
          placeholder="e.g. Educational, Promotional, Behind the scenes"
          onChange={(e) => onChange({ contentPillars: e.target.value })}
        />
      </label>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Platform strategy</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.4 }}>
          Optional per-platform guidance — AI will apply these when writing copy for each channel.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(
            [
              { key: "FACEBOOK", label: "Facebook", placeholder: "e.g. Storytelling-led, focus on industry trends, use questions to drive engagement, mix news + promo" },
              { key: "INSTAGRAM", label: "Instagram", placeholder: "e.g. Visual-first hook in first line, aspirational tone, short punchy captions, strong hashtag mix" },
              { key: "LINKEDIN", label: "LinkedIn", placeholder: "e.g. Thought leadership tone, cite industry data, short paragraphs, tag relevant companies" },
              { key: "OMG", label: "OMG article", placeholder: "e.g. Long-form analysis, SEO structure, deep operational insight, link to related services" },
            ] as const
          ).map(({ key, label, placeholder }) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
              {label}
              <textarea
                className="omg-input"
                rows={2}
                value={platformStrategies[key]}
                placeholder={placeholder}
                onChange={(e) =>
                  onChange({ platformStrategies: { ...platformStrategies, [key]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Brand voice
        <textarea
          className="omg-input"
          rows={2}
          value={brandVoice}
          onChange={(e) => onChange({ brandVoice: e.target.value })}
        />
      </label>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Platforms</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLATFORM_OPTIONS.map((p) => (
            <label
              key={p.v}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <input
                type="checkbox"
                checked={platforms.includes(p.v)}
                onChange={() => onChange({ platforms: togglePlatform(platforms, p.v) })}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>
      {layout === "manual" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Posts per run
              <input
                className="omg-input"
                type="number"
                min={1}
                max={5}
                value={postsPerRun}
                onChange={(e) => onChange({ postsPerRun: parseInt(e.target.value, 10) || 1 })}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Images per post
              <input
                className="omg-input"
                type="number"
                min={1}
                max={4}
                value={imagesPerPost}
                onChange={(e) =>
                  onChange({ imagesPerPost: Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)) })
                }
              />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => onChange({ autoApprove: e.target.checked })}
            />
            Auto-approve
          </label>
          {autoApprove && (
            <PublishTimeFields
              idPrefix={`${idPrefix}-adv`}
              publishHourOfDay={publishHourOfDay}
              publishMinuteOfHour={publishMinuteOfHour}
              publishSpacingMinutes={publishSpacingMinutes}
              publishTimesText={publishTimesText}
              onChange={onChange}
            />
          )}
        </>
      ) : null}
    </div>
  );

  const secHeader: React.CSSProperties = {
    margin: "0 0 14px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    paddingBottom: 8,
    borderBottom: "1px solid var(--border)",
  };

  if (layout === "page") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

        {/* ── Row 1: Core + Strategy (2-col) ─────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, alignItems: "start" }}>

          {/* LEFT — Core settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={secHeader}>Core settings</p>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Campaign name
              <input className="omg-input" value={name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Air Freight Insights Q3" />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Brand template
              <select className="omg-input" value={brandTemplateId} onChange={(e) => onChange({ brandTemplateId: e.target.value })}>
                {brandOptions.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Content mode</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="radio" name={`${idPrefix}cm`} checked={contentMode === "NEWS_DRIVEN"} onChange={() => onChange({ contentMode: "NEWS_DRIVEN" })} />
                    News / trend
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="radio" name={`${idPrefix}cm`} checked={contentMode === "SELF_PROMO"} onChange={() => onChange({ contentMode: "SELF_PROMO" })} />
                    Self-promo
                  </label>
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Language
                <select className="omg-input" value={contentLanguage} onChange={(e) => onChange({ contentLanguage: e.target.value })} style={{ minWidth: 110 }}>
                  {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              {contentMode === "NEWS_DRIVEN" ? "Keywords (search query)" : "Topics / services"}
              <input className="omg-input" value={keywords} onChange={(e) => onChange({ keywords: e.target.value })} placeholder={contentMode === "NEWS_DRIVEN" ? "air cargo, pharma logistics" : "charter, warehousing"} />
            </label>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Theme lane</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {THEME_LANES.map((t) => (
                  <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "9px 12px", borderRadius: 7, border: `1px solid ${theme === t.id ? "var(--accent)" : "var(--border)"}`, background: theme === t.id ? "var(--accent-dim)" : "var(--bg-surface)", cursor: "pointer" }}>
                    <input type="radio" name={`${idPrefix}theme`} checked={theme === t.id} onChange={() => onChange({ theme: t.id })} style={{ accentColor: "var(--accent)" }} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Platforms</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATFORM_OPTIONS.map((p) => (
                  <label key={p.v} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "7px 12px", borderRadius: 7, border: `1px solid ${platforms.includes(p.v) ? "var(--accent)" : "var(--border)"}`, background: platforms.includes(p.v) ? "var(--accent-dim)" : "var(--bg-surface)", cursor: "pointer" }}>
                    <input type="checkbox" checked={platforms.includes(p.v)} onChange={() => onChange({ platforms: togglePlatform(platforms, p.v) })} style={{ accentColor: "var(--accent)" }} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Campaign strategy */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={secHeader}>Campaign strategy</p>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Campaign goal
              <input className="omg-input" value={campaignGoal} placeholder="e.g. Brand Awareness, Lead Generation, Engagement" onChange={(e) => onChange({ campaignGoal: e.target.value })} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {personas.length > 0 && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  Load persona
                  <select className="omg-input" value={selectedPersonaId} onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedPersonaId(pid);
                    if (pid) { const p = personas.find((x) => x.id === pid); if (p) onChange({ targetPersona: p.description }); }
                  }}>
                    <option value="">— select a saved persona —</option>
                    {personas.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ""}</option>)}
                  </select>
                </label>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Target persona
                <textarea className="omg-input" rows={3} value={targetPersona} placeholder="e.g. CFO at mid-size logistics company — pain: cost visibility, goal: reduce freight spend" onChange={(e) => { setSelectedPersonaId(""); onChange({ targetPersona: e.target.value }); }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>AI tailors copy tone and messaging for this audience.</span>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Content pillars
              <input className="omg-input" value={contentPillars} placeholder="e.g. Educational, Promotional, Behind the scenes" onChange={(e) => onChange({ contentPillars: e.target.value })} />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Comma-separated — posts rotate through these pillars each run.</span>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Description
              <textarea className="omg-input" rows={2} value={description} placeholder="Internal notes about this campaign's purpose" onChange={(e) => onChange({ description: e.target.value })} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Brand voice
              <textarea className="omg-input" rows={2} value={brandVoice} placeholder="e.g. Professional, compliance-aware, trustworthy" onChange={(e) => onChange({ brandVoice: e.target.value })} />
            </label>
          </div>
        </div>

        {/* ── Row 2: Per-platform copy guidance ───────────────────── */}
        <div>
          <p style={secHeader}>Per-platform copy guidance</p>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
            Optional — AI applies these when writing copy for each channel.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {(
              [
                { key: "FACEBOOK", label: "Facebook", placeholder: "e.g. Storytelling-led, focus on industry trends, drive engagement with questions" },
                { key: "INSTAGRAM", label: "Instagram", placeholder: "e.g. Visual-first hook in first line, aspirational tone, punchy captions" },
                { key: "LINKEDIN", label: "LinkedIn", placeholder: "e.g. Thought leadership, cite industry data, short paragraphs, tag companies" },
                { key: "OMG", label: "OMG article", placeholder: "e.g. Long-form analysis, SEO structure, deep operational insight" },
              ] as const
            ).map(({ key, label, placeholder }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                {label}
                <textarea className="omg-input" rows={3} value={platformStrategies[key]} placeholder={placeholder} onChange={(e) => onChange({ platformStrategies: { ...platformStrategies, [key]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>

        {/* ── Row 3: Schedule ─────────────────────────────────────── */}
        <div>
          <p style={secHeader}>Schedule</p>
          <CampaignScheduleEditor idPrefix={idPrefix} value={schedule} onChange={onScheduleChange} />
        </div>

        {/* ── Row 4: Production ───────────────────────────────────── */}
        <div>
          <p style={secHeader}>Production settings</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Posts per run
              <input className="omg-input" type="number" min={1} max={5} value={postsPerRun} onChange={(e) => onChange({ postsPerRun: Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)) })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Images per post
              <input className="omg-input" type="number" min={1} max={4} value={imagesPerPost} onChange={(e) => onChange({ imagesPerPost: Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)) })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Total posts cap
              <input className="omg-input" type="number" min={1} value={totalPostsCap} placeholder="unlimited" onChange={(e) => onChange({ totalPostsCap: e.target.value })} />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12 }}>
            <input type="checkbox" checked={autoApprove} onChange={(e) => onChange({ autoApprove: e.target.checked })} />
            Auto-approve posts (publish without manual approval)
          </label>
          {autoApprove && (
            <PublishTimeFields idPrefix={`${idPrefix}-page`} publishHourOfDay={publishHourOfDay} publishMinuteOfHour={publishMinuteOfHour} publishSpacingMinutes={publishSpacingMinutes} publishTimesText={publishTimesText} onChange={onChange} />
          )}
        </div>

      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Campaign name
        <input className="omg-input" value={name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, maxWidth: 320 }}>
        Brand template
        <select
          className="omg-input"
          value={brandTemplateId}
          onChange={(e) => onChange({ brandTemplateId: e.target.value })}
        >
          {brandOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Content mode</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name={`${idPrefix}ContentMode`}
                checked={contentMode === "NEWS_DRIVEN"}
                onChange={() => onChange({ contentMode: "NEWS_DRIVEN" })}
              />
              News / trend
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name={`${idPrefix}ContentMode`}
                checked={contentMode === "SELF_PROMO"}
                onChange={() => onChange({ contentMode: "SELF_PROMO" })}
              />
              Self-promo
            </label>
          </div>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Language
          <select
            className="omg-input"
            value={contentLanguage}
            onChange={(e) => onChange({ contentLanguage: e.target.value })}
            style={{ minWidth: 130 }}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        {contentMode === "NEWS_DRIVEN"
          ? "Keywords (used as Google search query)"
          : "Topics / services (optional)"}
        <input
          className="omg-input"
          value={keywords}
          onChange={(e) => onChange({ keywords: e.target.value })}
          placeholder={contentMode === "NEWS_DRIVEN" ? "air cargo, logistics" : "e.g. charter services"}
        />
      </label>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Schedule</div>
        <CampaignScheduleEditor idPrefix={idPrefix} value={schedule} onChange={onScheduleChange} />
      </div>

      {layout === "ai" && (
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
              value={postsPerRun}
              onChange={(e) =>
                onChange({
                  postsPerRun: Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)),
                })
              }
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Images per post
            <input
              className="omg-input"
              type="number"
              min={1}
              max={4}
              value={imagesPerPost}
              onChange={(e) =>
                onChange({ imagesPerPost: Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)) })
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
              checked={autoApprove}
              onChange={(e) => onChange({ autoApprove: e.target.checked })}
            />
            Auto-approve
          </label>
          {autoApprove && (
            <div style={{ gridColumn: "1 / -1" }}>
              <PublishTimeFields
                idPrefix={`${idPrefix}-ai`}
                publishHourOfDay={publishHourOfDay}
                publishMinuteOfHour={publishMinuteOfHour}
                publishSpacingMinutes={publishSpacingMinutes}
                publishTimesText={publishTimesText}
                onChange={onChange}
              />
            </div>
          )}
        </div>
      )}

      {alwaysShowAdvanced ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Details</div>
          {advancedBlock}
        </div>
      ) : (
        <details
          open={showAdvanced}
          onToggle={(e) => onAdvancedOpenChange((e.target as HTMLDetailsElement).open)}
        >
          <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {layout === "ai"
              ? "Advanced — description, brand voice, lane, platforms, cap"
              : "Advanced — lane, platforms, posts per run, cap, description"}
          </summary>
          <div style={{ marginTop: 12 }}>{advancedBlock}</div>
        </details>
      )}
    </div>
  );
}
