"use client";

import type { Campaign, CampaignContentMode, CampaignTheme, Platform } from "@prisma/client";
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

export type CampaignFormFieldsValue = {
  name: string;
  /** Registry id: omg, acme, etc. */
  brandTemplateId: string;
  contentMode: CampaignContentMode;
  contentLanguage: string;
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
  /** "manual" = posts/cap/auto inside advanced. "ai" = posts+auto after schedule, cap in advanced */
  layout: "manual" | "ai";
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
  const {
    name,
    brandTemplateId,
    contentMode,
    contentLanguage,
    keywords,
    description,
    brandVoice,
    theme,
    schedule,
    platforms,
    postsPerRun,
    imagesPerPost,
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
