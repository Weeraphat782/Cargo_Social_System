import { addDays, addMinutes, addWeeks } from "date-fns";
import { toDate, formatInTimeZone } from "date-fns-tz";
import { enUS } from "date-fns/locale";
import { Campaign, CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAgentForCampaign } from "@/lib/agent/run";

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

/**
 * When `field` (cadence / day / hour / tz) change, recompute the next run from "now" or from `from`.
 */
export function computeNextRun(
  c: {
    cadence: Campaign["cadence"];
    dayOfWeek: number | null;
    hourOfDay: number | null;
    timezone: string;
    lastRunAt: Date | null;
    startAt: Date;
    customCron: string | null;
  },
  from: Date = new Date()
): Date {
  const tz = c.timezone?.trim() || DEFAULT_TZ;
  const dow0 = c.dayOfWeek ?? 1;
  const hour = c.hourOfDay ?? 9;

  if (c.cadence === "CUSTOM" && c.customCron?.trim()) {
    // MVP: if custom cron is set, fall back to weekly until a cron parser is added.
  }

  if (c.cadence === "BIWEEKLY" && c.lastRunAt) {
    return addWeeks(c.lastRunAt, 2);
  }

  if (c.cadence === "MONTHLY") {
    return firstWeekdayInNextMonth(from, tz, dow0, hour);
  }

  if (c.cadence === "WEEKLY" || c.cadence === "BIWEEKLY" || c.cadence === "CUSTOM") {
    const anchor = from < c.startAt ? c.startAt : from;
    return nextWeeklySlot(anchor, tz, dow0, hour);
  }

  return addWeeks(from, 1);
}

/** Preview the next N run times (BIWEEKLY: second slot assumes lastRunAt = previous preview). */
export function previewNextRuns(
  c: Parameters<typeof computeNextRun>[0],
  count: number
): Date[] {
  const out: Date[] = [];
  let from = c.startAt > new Date() ? c.startAt : new Date();
  for (let i = 0; i < count; i++) {
    const cWithLast =
      c.cadence === "BIWEEKLY" && i > 0
        ? { ...c, lastRunAt: out[i - 1]! }
        : c;
    const n = computeNextRun(cWithLast, from);
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
          data: { status: CampaignStatus.COMPLETED, lastRunAt: now },
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
      const next = computeNextRun(
        { ...campaign, lastRunAt: new Date() },
        new Date()
      );
      const capLeft =
        campaign.totalPostsCap == null
          ? true
          : (await prisma.post.count({ where: { campaignId: campaign.id } })) < campaign.totalPostsCap;
      const completed = !capLeft;
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          lastRunAt: new Date(),
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
        { ...campaign, lastRunAt: campaign.lastRunAt },
        new Date()
      );
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { nextRunAt: next, lastRunAt: new Date() },
      });
      processed.push({ campaignId: campaign.id, ok: false, postIds: [], error: msg });
    }
  }

  return { processed };
}
