import { Prisma, type CampaignCadence } from "@prisma/client";

export type ScheduleConfigJson = Prisma.JsonValue;

/** Parsed schedule; used by scheduler. */
export type NormalizedScheduleConfig = {
  daysOfWeek?: number[]; // WEEKLY_MULTI: 0..6
  dates?: string[]; // SPECIFIC_DATES: YYYY-MM-DD in campaign TZ
  /** TEST_MINUTES: YYYY-MM-DDTHH:mm in campaign TZ (wall clock, no offset) */
  datetimes?: string[];
};

export function parseScheduleConfig(
  cadence: CampaignCadence,
  raw: Prisma.JsonValue | null | undefined
): NormalizedScheduleConfig {
  if (raw == null || raw === false || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
    return {};
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return {};

  const o = raw as Record<string, unknown>;
  if (cadence === "WEEKLY_MULTI" && Array.isArray(o.daysOfWeek)) {
    const days = o.daysOfWeek
      .map((n) => Math.floor(Number(n)))
      .filter((n) => n >= 0 && n <= 6);
    const uniq = [...new Set(days)].sort((a, b) => a - b);
    return { daysOfWeek: uniq.length ? uniq : [1] };
  }
  if (cadence === "SPECIFIC_DATES" && Array.isArray(o.dates)) {
    const dates = o.dates
      .map((d) => String(d).trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    return { dates: [...new Set(dates)] };
  }
  if (cadence === "TEST_MINUTES" && Array.isArray(o.datetimes)) {
    const datetimes = o.datetimes
      .map((d) => String(d).trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d));
    return { datetimes: [...new Set(datetimes)].sort() };
  }
  return {};
}

/** Plain JSON for DB and for preview API (no Prisma types). */
export function buildScheduleConfigJson(
  cadence: CampaignCadence,
  daysOfWeekMulti: number[],
  specificDates: string[],
  testDatetimes: string[] = []
): Record<string, unknown> | null {
  if (cadence === "WEEKLY_MULTI") {
    const d = [...new Set(daysOfWeekMulti.filter((n) => n >= 0 && n <= 6))].sort((a, b) => a - b);
    return { daysOfWeek: d.length ? d : [1] };
  }
  if (cadence === "SPECIFIC_DATES") {
    const s = [
      ...new Set(
        specificDates
          .map((d) => d.trim())
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      ),
    ].sort();
    return { dates: s };
  }
  if (cadence === "TEST_MINUTES") {
    const s = [
      ...new Set(
        testDatetimes
          .map((d) => d.trim())
          .filter((d) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d))
      ),
    ].sort();
    return { datetimes: s };
  }
  if (cadence === "DAILY") return {};
  return null;
}

/** Build JSON to store from UI (DAILY, WEEKLY_MULTI, SPECIFIC_DATES, TEST_MINUTES). */
export function toStoredScheduleConfig(
  cadence: CampaignCadence,
  daysOfWeekMulti: number[],
  specificDates: string[],
  testDatetimes: string[] = []
): Prisma.InputJsonValue | null {
  const o = buildScheduleConfigJson(cadence, daysOfWeekMulti, specificDates, testDatetimes);
  if (o == null) return null;
  return o as Prisma.InputJsonValue;
}
