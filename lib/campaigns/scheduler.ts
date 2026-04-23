import { addDays, addMinutes, addWeeks } from "date-fns";
import { toDate, formatInTimeZone } from "date-fns-tz";
import { enUS } from "date-fns/locale";
import { Campaign, CampaignStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAgentForCampaign } from "@/lib/agent/run";
import { parseScheduleConfig } from "./schedule-config";

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

/** Nearest of multiple weekdays at `hour`, strictly after `anchor`. */
function nextMultiWeeklySlot(anchor: Date, tz: string, dows: number[], hour: number): Date | null {
  if (dows.length === 0) return null;
  let best: Date | null = null;
  for (const dow of dows) {
    const n = nextWeeklySlot(anchor, tz, dow, hour);
    if (best == null || n.getTime() < best.getTime()) best = n;
  }
  return best;
}

/**
 * Next calendar day in `tz` at `hour`:00, strictly after `anchor`.
 */
export function nextDailySlot(anchor: Date, tz: string, hour: number): Date {
  for (let k = 0; k < 400; k++) {
    const d = k === 0 ? new Date(anchor) : addDays(anchor, k);
    const y = formatInTimeZone(d, tz, "yyyy");
    const m = formatInTimeZone(d, tz, "MM");
    const day = formatInTimeZone(d, tz, "dd");
    const iso = `${y}-${m}-${day}T${String(hour).padStart(2, "0")}:00:00`;
    const utc = toDate(iso, { timeZone: tz });
    if (utc.getTime() > anchor.getTime()) return utc;
  }
  return addDays(anchor, 1);
}

/** YYYY-MM-DD at hour in `tz` → UTC. */
function slotOnYmd(ymd: string, tz: string, hour: number): Date {
  return toDate(
    `${ymd}T${String(hour).padStart(2, "0")}:00:00`,
    { timeZone: tz }
  );
}

/** Earliest YMD in the list with slot strictly after `anchor`. */
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

/** YYYY-MM-DDTHH:mm (wall time in `tz`) → UTC instant. */
function slotOnYmdHm(ymdHm: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ymdHm)) return null;
  return toDate(`${ymdHm}:00`, { timeZone: tz });
}

/** Earliest parseable datetime in the list strictly after `anchor` (for TEST_MINUTES). */
function nextTestMinutesSlot(anchor: Date, tz: string, ymdHms: string[]): Date | null {
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

/** First `dow0`@`hour` on/after the 1st of the *next* calendar month in `tz` (per-user monthly slot). */
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

/**
 * When `field` (cadence / day / hour / tz) change, recompute the next run from "now" or from `from`.
 * Returns `null` when the schedule is exhausted (e.g. SPECIFIC_DATES with no future slot).
 */
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
    const days = parsed.daysOfWeek?.length
      ? parsed.daysOfWeek
      : [dow0];
    return nextMultiWeeklySlot(anchor, tz, days, hour);
  }

  if (c.cadence === "SPECIFIC_DATES") {
    const dates = parsed.dates?.length ? parsed.dates : [];
    return nextSpecificDateSlot(anchor, tz, dates, hour);
  }

  if (c.cadence === "TEST_MINUTES") {
    const dts = parsed.datetimes?.length ? parsed.datetimes : [];
    return nextTestMinutesSlot(anchor, tz, dts);
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

  // Fallback: weekly on dow0
  return nextWeeklySlot(anchor, tz, dow0, hour);
}

/** Preview the next N run times; stops early if `null` (exhausted). */
export function previewNextRuns(
  c: ComputeNextRunInput,
  count: number
): Date[] {
  const out: Date[] = [];
  let from = c.startAt.getTime() > new Date().getTime() ? c.startAt : new Date();
  for (let i = 0; i < count; i++) {
    const cI =
      (c.cadence === "BIWEEKLY" && i > 0) ||
      (c.cadence === "MONTHLY" && i > 0) ||
      (c.cadence === "SPECIFIC_DATES" && i > 0) ||
      (c.cadence === "DAILY" && i > 0) ||
      (c.cadence === "WEEKLY_MULTI" && i > 0) ||
      (c.cadence === "TEST_MINUTES" && i > 0) ||
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

/**
 * One cron pass: all ACTIVE campaigns that are due (start/end window, post cap, nextRunAt).
 */
export async function runDueCampaigns(): Promise<{
  processed: { campaignId: string; ok: boolean; postIds: string[]; error?: string }[];
}> {
  const now = new Date();
  const due = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.ACTIVE,
      nextRunAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
  });

  const processed: { campaignId: string; ok: boolean; postIds: string[]; error?: string }[] = [];

  for (const campaign of due) {
    if (campaign.totalPostsCap != null) {
      const n = await prisma.post.count({ where: { campaignId: campaign.id } });
      if (n >= campaign.totalPostsCap) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.COMPLETED, lastRunAt: now, nextRunAt: null },
        });
        processed.push({ campaignId: campaign.id, ok: true, postIds: [] });
        continue;
      }
    }
    const run = await prisma.campaignRun.create({
      data: { campaignId: campaign.id },
    });
    try {
      const { postIds } = await runAgentForCampaign(campaign.id, { forCron: true });
      await prisma.campaignRun.update({
        where: { id: run.id },
        data: { ok: true, finishedAt: new Date(), postId: postIds[0] ?? null },
      });
      const runAt = new Date();
      const next = computeNextRun(
        {
          cadence: campaign.cadence,
          dayOfWeek: campaign.dayOfWeek,
          hourOfDay: campaign.hourOfDay,
          timezone: campaign.timezone,
          lastRunAt: runAt,
          startAt: campaign.startAt,
          customCron: campaign.customCron,
          scheduleConfig: campaign.scheduleConfig,
        },
        new Date()
      );
      const capLeft =
        campaign.totalPostsCap == null
          ? true
          : (await prisma.post.count({ where: { campaignId: campaign.id } })) < campaign.totalPostsCap;
      const completed = !capLeft || next == null;
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          lastRunAt: runAt,
          nextRunAt: completed ? null : next,
          status: completed ? CampaignStatus.COMPLETED : CampaignStatus.ACTIVE,
        },
      });
      processed.push({ campaignId: campaign.id, ok: true, postIds });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.campaignRun.update({
        where: { id: run.id },
        data: { ok: false, finishedAt: new Date(), error: msg },
      });
      const next = computeNextRun(
        {
          cadence: campaign.cadence,
          dayOfWeek: campaign.dayOfWeek,
          hourOfDay: campaign.hourOfDay,
          timezone: campaign.timezone,
          lastRunAt: campaign.lastRunAt,
          startAt: campaign.startAt,
          customCron: campaign.customCron,
          scheduleConfig: campaign.scheduleConfig,
        },
        new Date()
      );
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          nextRunAt: next,
          lastRunAt: new Date(),
          status: next == null ? CampaignStatus.COMPLETED : CampaignStatus.ACTIVE,
        },
      });
      processed.push({ campaignId: campaign.id, ok: false, postIds: [], error: msg });
    }
  }

  return { processed };
}
