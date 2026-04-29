import { addDays, addMinutes, addWeeks } from "date-fns";
import { toDate, formatInTimeZone } from "date-fns-tz";
import { enUS } from "date-fns/locale";
import type { Campaign, Prisma } from "@prisma/client";
import { parseScheduleConfig } from "./schedule-config";

/**
 * Pure (client-safe) scheduling math. MUST NOT import prisma, agent, or any
 * Node-only module. The server-side `runDueCampaigns` lives in `./scheduler.ts`
 * and re-exports these helpers for convenience.
 */

const DEFAULT_TZ = "Asia/Bangkok";
const DOW_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function dayOfWeekInTz(d: Date, tz: string): number {
  const name = formatInTimeZone(d, tz, "EEEE", { locale: enUS });
  return DOW_EN.indexOf(name as (typeof DOW_EN)[number]);
}

/**
 * Next calendar instant where local wall time in `tz` is `dow0` (0=Sun) at `hour` o'clock, strictly after `anchor`.
 */
export function nextWeeklySlot(anchor: Date, tz: string, dow0: number, hour: number): Date {
  for (let k = 0; k < 32; k++) {
    const d = k === 0 ? new Date(anchor) : addDays(anchor, k);
    if (dayOfWeekInTz(d, tz) !== dow0) continue;
    const y = formatInTimeZone(d, tz, "yyyy");
    const m = formatInTimeZone(d, tz, "MM");
    const day = formatInTimeZone(d, tz, "dd");
    const iso = `${y}-${m}-${day}T${String(hour).padStart(2, "0")}:00:00`;
    const utc = toDate(iso, { timeZone: tz });
    if (utc.getTime() > anchor.getTime()) return utc;
  }
  return addWeeks(anchor, 1);
}

function nextMultiWeeklySlot(anchor: Date, tz: string, dows: number[], hour: number): Date | null {
  if (dows.length === 0) return null;
  let best: Date | null = null;
  for (const dow of dows) {
    const n = nextWeeklySlot(anchor, tz, dow, hour);
    if (best == null || n.getTime() < best.getTime()) best = n;
  }
  return best;
}

export function nextDailySlot(
  anchor: Date,
  tz: string,
  hour: number,
  minute: number = 0
): Date {
  const mm = Math.max(0, Math.min(59, minute));
  for (let k = 0; k < 400; k++) {
    const d = k === 0 ? new Date(anchor) : addDays(anchor, k);
    const y = formatInTimeZone(d, tz, "yyyy");
    const m = formatInTimeZone(d, tz, "MM");
    const day = formatInTimeZone(d, tz, "dd");
    const iso = `${y}-${m}-${day}T${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    const utc = toDate(iso, { timeZone: tz });
    if (utc.getTime() > anchor.getTime()) return utc;
  }
  return addDays(anchor, 1);
}

/**
 * Next instant in `tz` where local wall clock equals `hhmm` ("HH:mm"), strictly after `anchor`.
 */
export function nextWallClockHmAfter(anchor: Date, tz: string, hhmm: string): Date | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  for (let k = 0; k < 400; k++) {
    const d = k === 0 ? new Date(anchor) : addDays(anchor, k);
    const y = formatInTimeZone(d, tz, "yyyy");
    const mo = formatInTimeZone(d, tz, "MM");
    const day = formatInTimeZone(d, tz, "dd");
    const iso = `${y}-${mo}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    const utc = toDate(iso, { timeZone: tz });
    if (utc.getTime() > anchor.getTime()) return utc;
  }
  return null;
}

function slotOnYmd(ymd: string, tz: string, hour: number): Date {
  return toDate(
    `${ymd}T${String(hour).padStart(2, "0")}:00:00`,
    { timeZone: tz }
  );
}

function nextSpecificDateSlot(anchor: Date, tz: string, datesYmd: string[], hour: number): Date | null {
  let best: Date | null = null;
  for (const ymd of datesYmd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const slot = slotOnYmd(ymd, tz, hour);
    if (slot.getTime() > anchor.getTime()) {
      if (best == null || slot.getTime() < best.getTime()) best = slot;
    }
  }
  return best;
}

function slotOnYmdHm(ymdHm: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ymdHm)) return null;
  return toDate(`${ymdHm}:00`, { timeZone: tz });
}

function nextCustomDatetimeSlot(anchor: Date, tz: string, ymdHms: string[]): Date | null {
  let best: Date | null = null;
  for (const raw of ymdHms) {
    const slot = slotOnYmdHm(raw, tz);
    if (slot == null) continue;
    if (slot.getTime() > anchor.getTime()) {
      if (best == null || slot.getTime() < best.getTime()) best = slot;
    }
  }
  return best;
}

export function firstWeekdayInNextMonth(anchor: Date, tz: string, dow0: number, hour: number): Date {
  const y = parseInt(formatInTimeZone(anchor, tz, "yyyy"), 10);
  const mo = parseInt(formatInTimeZone(anchor, tz, "M"), 10);
  const nextMo = mo === 12 ? 1 : mo + 1;
  const nextY = mo === 12 ? y + 1 : y;
  const base = toDate(
    `${nextY}-${String(nextMo).padStart(2, "0")}-01T${String(hour).padStart(2, "0")}:00:00`,
    { timeZone: tz }
  );
  for (let d = 0; d < 7; d++) {
    const day = addDays(base, d);
    if (dayOfWeekInTz(day, tz) === dow0) {
      const yy = formatInTimeZone(day, tz, "yyyy");
      const mm = formatInTimeZone(day, tz, "MM");
      const dd = formatInTimeZone(day, tz, "dd");
      return toDate(
        `${yy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:00:00`,
        { timeZone: tz }
      );
    }
  }
  return addWeeks(anchor, 4);
}

export type ComputeNextRunInput = {
  cadence: Campaign["cadence"];
  dayOfWeek: number | null;
  hourOfDay: number | null;
  timezone: string;
  lastRunAt: Date | null;
  startAt: Date;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue | null;
};

export function computeNextRun(c: ComputeNextRunInput, from: Date = new Date()): Date | null {
  const tz = c.timezone?.trim() || DEFAULT_TZ;
  const dow0 = c.dayOfWeek ?? 1;
  const hour = c.hourOfDay ?? 9;
  const parsed = parseScheduleConfig(c.cadence, c.scheduleConfig);
  const startAt = c.startAt;
  const anchor0 = from.getTime() < startAt.getTime() ? startAt : from;
  const anchor =
    c.lastRunAt && c.lastRunAt.getTime() > anchor0.getTime() ? c.lastRunAt : anchor0;
  if (c.cadence === "DAILY") {
    return nextDailySlot(anchor, tz, hour);
  }

  if (c.cadence === "WEEKLY_MULTI") {
    const days = parsed.daysOfWeek?.length ? parsed.daysOfWeek : [dow0];
    return nextMultiWeeklySlot(anchor, tz, days, hour);
  }

  if (c.cadence === "SPECIFIC_DATES") {
    const dates = parsed.dates?.length ? parsed.dates : [];
    return nextSpecificDateSlot(anchor, tz, dates, hour);
  }

  if (c.cadence === "CUSTOM_DATETIMES") {
    const dts = parsed.datetimes?.length ? parsed.datetimes : [];
    return nextCustomDatetimeSlot(anchor, tz, dts);
  }

  if (c.cadence === "CUSTOM" && c.customCron?.trim()) {
    // MVP: custom cron not parsed — same as weekly slot on dayOfWeek
  }

  if (c.cadence === "BIWEEKLY" && c.lastRunAt) {
    return addWeeks(c.lastRunAt, 2);
  }

  if (c.cadence === "MONTHLY") {
    return firstWeekdayInNextMonth(anchor, tz, dow0, hour);
  }

  if (c.cadence === "WEEKLY" || c.cadence === "BIWEEKLY" || c.cadence === "CUSTOM") {
    return nextWeeklySlot(anchor, tz, dow0, hour);
  }

  return nextWeeklySlot(anchor, tz, dow0, hour);
}

/** Preview the next N run times; stops early if `null` (exhausted). */
export function previewNextRuns(c: ComputeNextRunInput, count: number): Date[] {
  const out: Date[] = [];
  let from = c.startAt.getTime() > new Date().getTime() ? c.startAt : new Date();
  for (let i = 0; i < count; i++) {
    const cI =
      (c.cadence === "BIWEEKLY" && i > 0) ||
      (c.cadence === "MONTHLY" && i > 0) ||
      (c.cadence === "SPECIFIC_DATES" && i > 0) ||
      (c.cadence === "DAILY" && i > 0) ||
      (c.cadence === "WEEKLY_MULTI" && i > 0) ||
      (c.cadence === "CUSTOM_DATETIMES" && i > 0) ||
      ((c.cadence === "WEEKLY" || c.cadence === "CUSTOM") && i > 0)
        ? { ...c, lastRunAt: out[i - 1]! }
        : c;
    const n = computeNextRun(cI, from);
    if (n == null) break;
    out.push(n);
    from = addMinutes(n, 1);
  }
  return out;
}

/** Same as {@link previewNextRuns} but stops when the next run is after `endAt`. */
export function previewNextRunsUntil(
  c: ComputeNextRunInput,
  endAt: Date,
  maxCount: number
): Date[] {
  const out: Date[] = [];
  let from = c.startAt.getTime() > new Date().getTime() ? c.startAt : new Date();
  for (let i = 0; i < maxCount; i++) {
    const cI =
      (c.cadence === "BIWEEKLY" && i > 0) ||
      (c.cadence === "MONTHLY" && i > 0) ||
      (c.cadence === "SPECIFIC_DATES" && i > 0) ||
      (c.cadence === "DAILY" && i > 0) ||
      (c.cadence === "WEEKLY_MULTI" && i > 0) ||
      (c.cadence === "CUSTOM_DATETIMES" && i > 0) ||
      ((c.cadence === "WEEKLY" || c.cadence === "CUSTOM") && i > 0)
        ? { ...c, lastRunAt: out[i - 1]! }
        : c;
    const n = computeNextRun(cI, from);
    if (n == null) break;
    if (n.getTime() > endAt.getTime()) break;
    out.push(n);
    from = addMinutes(n, 1);
  }
  return out;
}

/** All run instants in `[rangeStart, endAt]` (used for expected post budget). */
export function previewNextRunsInRange(
  c: ComputeNextRunInput,
  rangeStart: Date,
  endAt: Date,
  maxCount: number
): Date[] {
  const out: Date[] = [];
  let from = rangeStart;
  for (let i = 0; i < maxCount; i++) {
    const cI =
      (c.cadence === "BIWEEKLY" && i > 0) ||
      (c.cadence === "MONTHLY" && i > 0) ||
      (c.cadence === "SPECIFIC_DATES" && i > 0) ||
      (c.cadence === "DAILY" && i > 0) ||
      (c.cadence === "WEEKLY_MULTI" && i > 0) ||
      (c.cadence === "CUSTOM_DATETIMES" && i > 0) ||
      ((c.cadence === "WEEKLY" || c.cadence === "CUSTOM") && i > 0)
        ? { ...c, lastRunAt: out[i - 1]! }
        : c;
    const n = computeNextRun(cI, from);
    if (n == null) break;
    if (n.getTime() > endAt.getTime()) break;
    if (n.getTime() >= rangeStart.getTime()) out.push(n);
    from = addMinutes(n, 1);
  }
  return out;
}
