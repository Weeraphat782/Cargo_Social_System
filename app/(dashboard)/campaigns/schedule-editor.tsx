"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addMinutes, addMonths, subMonths } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { enUS } from "date-fns/locale";
import type { CampaignCadence } from "@prisma/client";
import { buildScheduleConfigJson } from "@/lib/campaigns/schedule-config";

const DOW_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const BASE_CADENCE_OPTIONS: { v: CampaignCadence; label: string; short?: string }[] = [
  { v: "DAILY", label: "Every day" },
  { v: "WEEKLY_MULTI", label: "Every week", short: "Pick day(s)" },
  { v: "WEEKLY", label: "Every week (one day)" },
  { v: "BIWEEKLY", label: "Every 2 weeks" },
  { v: "MONTHLY", label: "Monthly" },
  { v: "SPECIFIC_DATES", label: "Specific dates" },
  { v: "CUSTOM", label: "Custom (weekly fallback)" },
];

const DEV_CADENCE_OPTION: { v: CampaignCadence; label: string } = {
  v: "TEST_MINUTES",
  label: "Every few minutes (test)",
};

function cadenceOptions(): { v: CampaignCadence; label: string; short?: string }[] {
  if (process.env.NODE_ENV === "production") return BASE_CADENCE_OPTIONS;
  return [...BASE_CADENCE_OPTIONS, DEV_CADENCE_OPTION];
}

export type ScheduleEditorValue = {
  cadence: CampaignCadence;
  dayOfWeek: number;
  hourOfDay: number;
  timezone: string;
  daysOfWeekMulti: number[];
  specificDates: string[];
  /** TEST_MINUTES: wall times in campaign TZ, format YYYY-MM-DDTHH:mm */
  testDatetimes: string[];
};

type Props = {
  value: ScheduleEditorValue;
  onChange: (patch: Partial<ScheduleEditorValue>) => void;
  idPrefix?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1: number) {
  return new Date(year, month1, 0).getDate();
}

const DOW_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function listMonthCells(
  year: number,
  month1: number,
  tz: string
): { ymd: string; inMonth: boolean; label: string; disabled: boolean }[] {
  const dim = daysInMonth(year, month1);
  const first = toDate(`${year}-${pad2(month1)}-01T12:00:00`, { timeZone: tz });
  const w = formatInTimeZone(first, tz, "EEEE", { locale: enUS });
  const startPad = DOW_EN.indexOf(w as (typeof DOW_EN)[number]);
  const pad = startPad < 0 ? 0 : startPad;
  const todayYmd = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const cells: { ymd: string; inMonth: boolean; label: string; disabled: boolean }[] = [];
  for (let i = 0; i < pad; i++) {
    cells.push({ ymd: "", inMonth: false, label: "", disabled: true });
  }
  for (let d = 1; d <= dim; d++) {
    const ymd = `${year}-${pad2(month1)}-${pad2(d)}`;
    cells.push({
      ymd,
      inMonth: true,
      label: String(d),
      disabled: ymd < todayYmd,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: "", inMonth: false, label: "", disabled: true });
  }
  return cells;
}

export function CampaignScheduleEditor({ value, onChange, idPrefix = "sched" }: Props) {
  const { cadence, dayOfWeek, hourOfDay, timezone, daysOfWeekMulti, specificDates } = value;
  const [view, setView] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1 };
  });
  const [manualDate, setManualDate] = useState(() =>
    formatInTimeZone(new Date(), value.timezone || "Asia/Bangkok", "yyyy-MM-dd")
  );
  const [manualTime, setManualTime] = useState("12:00");

  const [preview, setPreview] = useState<string[]>([]);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPreview = useCallback(async () => {
    const testDatetimes = value.testDatetimes ?? [];
    const sc = buildScheduleConfigJson(
      cadence,
      daysOfWeekMulti,
      specificDates,
      testDatetimes
    );
    const res = await fetch("/api/campaigns/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cadence,
        dayOfWeek,
        hourOfDay,
        timezone,
        startAt: new Date().toISOString(),
        scheduleConfig:
          sc &&
          (cadence === "DAILY" ||
            cadence === "WEEKLY_MULTI" ||
            cadence === "SPECIFIC_DATES" ||
            cadence === "TEST_MINUTES")
            ? sc
            : null,
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as { dates: string[] };
      setPreview(d.dates ?? []);
    }
  }, [cadence, dayOfWeek, hourOfDay, timezone, daysOfWeekMulti, specificDates, value.testDatetimes]);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      void runPreview();
    }, 400);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [runPreview]);

  const toggleDow = (d: number) => {
    const set = new Set(daysOfWeekMulti);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    const arr = [...set].sort((a, b) => a - b);
    onChange({ daysOfWeekMulti: arr.length ? arr : [d] });
  };

  const toggleYmd = (ymd: string) => {
    if (!ymd) return;
    const set = new Set(specificDates);
    if (set.has(ymd)) set.delete(ymd);
    else set.add(ymd);
    onChange({ specificDates: [...set].sort() });
  };

  const cells = listMonthCells(view.y, view.m, timezone);

  const testDatetimes = value.testDatetimes ?? [];

  const appendQuickMins = (n: number) => {
    const raw = formatInTimeZone(addMinutes(new Date(), n), timezone, "yyyy-MM-dd'T'HH:mm");
    const next = [...new Set([...testDatetimes, raw])].sort();
    onChange({ testDatetimes: next });
  };

  const addManualSlot = () => {
    const tPart = manualTime.length >= 5 ? manualTime.slice(0, 5) : manualTime;
    const raw = `${manualDate}T${tPart}`;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return;
    const next = [...new Set([...testDatetimes, raw])].sort();
    onChange({ testDatetimes: next });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Repeat</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {cadenceOptions().map((opt) => (
            <button
              key={opt.v}
              type="button"
              className={cadence === opt.v ? "omg-btn-primary" : "omg-btn-ghost"}
              style={{ fontSize: 11, padding: "6px 10px" }}
              onClick={() => {
                if (opt.v === "WEEKLY_MULTI" && (value.daysOfWeekMulti?.length ?? 0) === 0) {
                  onChange({ cadence: opt.v, daysOfWeekMulti: [value.dayOfWeek] });
                } else if (opt.v === "SPECIFIC_DATES") {
                  onChange({ cadence: opt.v, specificDates: value.specificDates.length ? value.specificDates : [] });
                } else if (opt.v === "TEST_MINUTES") {
                  onChange({
                    cadence: opt.v,
                    testDatetimes: value.testDatetimes?.length ? value.testDatetimes : [],
                  });
                } else {
                  onChange({ cadence: opt.v });
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {cadence === "WEEKLY_MULTI" && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Days (one or more)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DOW_FULL.map((label, d) => (
              <button
                key={d}
                type="button"
                className={daysOfWeekMulti.includes(d) ? "omg-btn-primary" : "omg-btn-ghost"}
                style={{ fontSize: 11, minWidth: 40, padding: "6px 8px" }}
                onClick={() => toggleDow(d)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(cadence === "WEEKLY" || cadence === "BIWEEKLY" || cadence === "MONTHLY" || cadence === "CUSTOM") && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Day of week
          <select
            className="omg-input"
            id={`${idPrefix}-dow`}
            value={dayOfWeek}
            onChange={(e) => onChange({ dayOfWeek: parseInt(e.target.value, 10) })}
          >
            {DOW_FULL.map((label, d) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: cadence === "TEST_MINUTES" ? "1fr" : "1fr 1fr",
          gap: 10,
        }}
      >
        {cadence !== "TEST_MINUTES" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Hour (0–23)
            <input
              id={`${idPrefix}-hr`}
              className="omg-input"
              type="number"
              min={0}
              max={23}
              value={hourOfDay}
              onChange={(e) =>
                onChange({ hourOfDay: Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)) })
              }
            />
          </label>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Timezone
          <input
            id={`${idPrefix}-tz`}
            className="omg-input"
            value={timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
          />
        </label>
      </div>

      {cadence === "TEST_MINUTES" && (
        <div
          className="omg-card"
          style={{ padding: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Test run times (minute precision)</div>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Dev-only. Campaign auto-completes after the last slot fires. Times are in the campaign timezone
            above.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {([5, 10, 15, 30] as const).map((n) => (
              <button
                key={n}
                type="button"
                className="omg-btn-ghost"
                style={{ fontSize: 11, padding: "6px 10px" }}
                onClick={() => appendQuickMins(n)}
              >
                +{n} min
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Date
              <input
                className="omg-input"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Time
              <input
                className="omg-input"
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
              />
            </label>
            <button type="button" className="omg-btn-primary" style={{ fontSize: 11, padding: "6px 12px" }} onClick={addManualSlot}>
              Add
            </button>
          </div>
          {testDatetimes.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button
                type="button"
                className="omg-btn-ghost"
                style={{ fontSize: 11, padding: "4px 8px", color: "var(--danger)" }}
                onClick={() => onChange({ testDatetimes: [] })}
              >
                Clear all
              </button>
            </div>
          )}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {[...testDatetimes]
              .sort()
              .map((t) => (
                <li key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ flex: 1, fontFamily: "ui-monospace, monospace" }}>{t.replace("T", " ")}</span>
                  <button
                    type="button"
                    className="omg-btn-ghost"
                    style={{ fontSize: 16, lineHeight: 1, padding: "0 6px", color: "var(--danger)" }}
                    title="Remove"
                    onClick={() => onChange({ testDatetimes: testDatetimes.filter((x) => x !== t) })}
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {cadence === "SPECIFIC_DATES" && (
        <div
          className="omg-card"
          style={{ padding: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>Select dates (click days)</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="omg-btn-ghost"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setView((v) => {
                  const d = new Date(v.y, v.m - 1, 1);
                  const p = subMonths(d, 1);
                  return { y: p.getFullYear(), m: p.getMonth() + 1 };
                })}
              >
                ←
              </button>
              <span style={{ fontSize: 12, minWidth: 120, textAlign: "center" }}>
                {formatInTimeZone(
                  toDate(`${view.y}-${pad2(view.m)}-15T12:00:00`, { timeZone: timezone }),
                  timezone,
                  "MMMM yyyy"
                )}
              </span>
              <button
                type="button"
                className="omg-btn-ghost"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setView((v) => {
                  const d = new Date(v.y, v.m - 1, 1);
                  const p = addMonths(d, 1);
                  return { y: p.getFullYear(), m: p.getMonth() + 1 };
                })}
              >
                →
              </button>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              fontSize: 10,
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            {DOW_FULL.map((d) => (
              <div key={d} style={{ textAlign: "center" }}>
                {d}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
            }}
          >
            {cells.map((cell, idx) => (
              <div key={idx} style={{ aspectRatio: "1", minHeight: 32 }}>
                {cell.inMonth ? (
                  <button
                    type="button"
                    disabled={cell.disabled}
                    onClick={() => toggleYmd(cell.ymd)}
                    className={specificDates.includes(cell.ymd) ? "omg-btn-primary" : "omg-btn-ghost"}
                    style={{
                      width: "100%",
                      height: "100%",
                      fontSize: 12,
                      padding: 0,
                      opacity: cell.disabled ? 0.35 : 1,
                    }}
                  >
                    {cell.label}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
          {specificDates.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)" }}>
              Selected: {specificDates.length} day{specificDates.length !== 1 ? "s" : ""} — {specificDates.join(", ")}
            </div>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)" }}>Upcoming runs (preview)</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {preview.map((d) => (
              <li key={d}>{new Date(d).toLocaleString(undefined, { timeZone: timezone })}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function defaultScheduleValue(): ScheduleEditorValue {
  return {
    cadence: "WEEKLY",
    dayOfWeek: 1,
    hourOfDay: 9,
    timezone: "Asia/Bangkok",
    daysOfWeekMulti: [1, 3, 5],
    specificDates: [],
    testDatetimes: [],
  };
}
