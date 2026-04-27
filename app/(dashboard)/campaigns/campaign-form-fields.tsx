"use client";

import type { Campaign, CampaignContentMode, CampaignTheme, Platform } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { parseScheduleConfig } from "@/lib/campaigns/schedule-config";
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

export type CampaignFormFieldsValue = {
  name: string;
  contentMode: CampaignContentMode;
  keywords: string;
  description: string;
  brandVoice: string;
  theme: CampaignTheme;
  schedule: ScheduleEditorValue;
  platforms: Platform[];
  postsPerRun: number;
  totalPostsCap: string;
  autoApprove: boolean;
  publishHourOfDay: number | null;
};

type Props = {
  value: CampaignFormFieldsValue;
  onChange: (patch: Partial<CampaignFormFieldsValue>) => void;
  onScheduleChange: (patch: Partial<ScheduleEditorValue>) => void;
  idPrefix: string;
  /** "manual" = posts/cap/auto inside advanced. "ai" = posts+auto after schedule, cap in advanced */
  layout: "manual" | "ai";
  showAdvanced: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  /** When true, advanced fields are always shown (no collapsible details) */
  alwaysShowAdvanced?: boolean;
};

export function defaultCampaignFormFieldsValue(): CampaignFormFieldsValue {
  return {
    name: "",
    keywords: "",
    contentMode: "NEWS_DRIVEN",
    description: "",
    brandVoice: "",
    theme: "INNOVATION_TECH",
    schedule: defaultScheduleValue(),
    platforms: ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"],
    postsPerRun: 1,
    totalPostsCap: "",
    autoApprove: false,
    publishHourOfDay: null,
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
    | "totalPostsCap"
    | "autoApprove"
    | "publishHourOfDay"
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
    keywords: c.keywords,
    contentMode: c.contentMode,
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
      testDatetimes: parsed.datetimes?.length ? parsed.datetimes : [],
      runUntilYmd,
    },
    platforms: c.platforms?.length ? [...c.platforms] : [...FORM_PLATFORM_FALLBACK],
    postsPerRun: c.postsPerRun,
    totalPostsCap: c.totalPostsCap != null ? String(c.totalPostsCap) : "",
    autoApprove: c.autoApprove,
    publishHourOfDay: c.publishHourOfDay ?? null,
  };
}

function togglePlatform(prev: Platform[], p: Platform): Platform[] {
  if (prev.includes(p)) {
    const next = prev.filter((x) => x !== p);
    return next.length ? next : prev;
  }
  return [...prev, p];
}

export function CampaignFormFields({
  value,
  onChange,
  onScheduleChange,
  idPrefix,
  layout,
  showAdvanced,
  onAdvancedOpenChange,
  alwaysShowAdvanced = false,
}: Props) {
  const { name, contentMode, keywords, description, brandVoice, theme, schedule, platforms, postsPerRun, autoApprove, publishHourOfDay } = value;

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
        Brand voice
        <textarea
          className="omg-input"
          rows={2}
          value={brandVoice}
          onChange={(e) => onChange({ brandVoice: e.target.value })}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Lane
        <select
          className="omg-input"
          value={theme}
          onChange={(e) => onChange({ theme: e.target.value as CampaignTheme })}
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
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, maxWidth: 220 }}>
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
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => onChange({ autoApprove: e.target.checked })}
            />
            Auto-approve
          </label>
          {autoApprove && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, maxWidth: 220 }}>
              Publish hour (0–23)
              <input
                className="omg-input"
                type="number"
                min={0}
                max={23}
                value={publishHourOfDay ?? ""}
                placeholder="e.g. 10"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onChange({
                    publishHourOfDay: v === "" ? null : Math.max(0, Math.min(23, parseInt(v, 10) || 0)),
                  });
                }}
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.35 }}>
                Posts will publish at this hour. Leave empty to publish ~2 min after the agent runs.
              </span>
            </label>
          )}
        </>
      ) : null}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Campaign name
        <input className="omg-input" value={name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
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
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, maxWidth: 280 }}>
              Publish hour (0–23)
              <input
                className="omg-input"
                type="number"
                min={0}
                max={23}
                value={publishHourOfDay ?? ""}
                placeholder="e.g. 10"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onChange({
                    publishHourOfDay: v === "" ? null : Math.max(0, Math.min(23, parseInt(v, 10) || 0)),
                  });
                }}
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.35 }}>
                Posts will publish at this hour. Leave empty to publish ~2 min after the agent runs.
              </span>
            </label>
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
