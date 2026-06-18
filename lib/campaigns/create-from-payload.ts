import {
  CampaignContentMode,
  CampaignStatus,
  Prisma,
  type Campaign,
  type CampaignCadence,
  type CampaignTheme,
  type Platform,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/campaigns/scheduler";
import {
  MAX_CUSTOM_DATETIME_SLOTS,
  normalizeScheduledDatetimeSlots,
  toStoredScheduleConfig,
} from "@/lib/campaigns/schedule-config";
import {
  MAX_PUBLISH_TIME_SLOTS,
  normalizePublishTimesFromApi,
} from "@/lib/campaigns/publish-times";
import { isBrandTemplateId } from "@/lib/brands/registry";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

/** Same shape as `POST /api/campaigns` JSON body. */
export type CreateCampaignPayload = {
  name: string;
  description?: string | null;
  keywords?: string;
  brandVoice?: string | null;
  theme: CampaignTheme;
  contentMode?: CampaignContentMode;
  cadence: CampaignCadence;
  dayOfWeek?: number | null;
  hourOfDay?: number | null;
  timezone?: string;
  customCron?: string | null;
  platforms?: Platform[];
  postsPerRun?: number;
  imagesPerPost?: number;
  totalPostsCap?: number | null;
  autoApprove?: boolean;
  publishHourOfDay?: number | null;
  publishMinuteOfHour?: number | null;
  publishSpacingMinutes?: number | null;
  publishTimes?: string[] | null;
  startAt?: string;
  endAt?: string | null;
  status?: CampaignStatus;
  daysOfWeekMulti?: number[];
  specificDates?: string[];
  testDatetimes?: string[];
  scheduledDatetimes?: string[];
  brandTemplateId?: string;
  contentLanguage?: string;
  campaignGoal?: string | null;
  targetPersona?: string | null;
  contentPillars?: string | null;
  platformStrategies?: Record<string, string> | null;
};

export type CreateCampaignResult =
  | { ok: true; campaign: Campaign }
  | { ok: false; status: number; error: string };

export type CampaignCreateDb = {
  campaign: { create: typeof prisma.campaign.create };
};

export async function createCampaignFromPayload(
  body: CreateCampaignPayload,
  options?: { strategyId?: string | null },
  db: CampaignCreateDb = prisma
): Promise<CreateCampaignResult> {
  let brandTemplateId = "omg";
  if (body.brandTemplateId != null && body.brandTemplateId !== "") {
    const tid = body.brandTemplateId.trim();
    if (!(await isBrandTemplateId(tid))) {
      return { ok: false, status: 400, error: "invalid brandTemplateId" };
    }
    brandTemplateId = tid;
  }

  if (!body.name?.trim()) {
    return { ok: false, status: 400, error: "name required" };
  }
  if (!body.theme || !body.cadence) {
    return { ok: false, status: 400, error: "theme and cadence required" };
  }

  const contentMode = body.contentMode ?? CampaignContentMode.NEWS_DRIVEN;
  if (
    contentMode !== CampaignContentMode.NEWS_DRIVEN &&
    contentMode !== CampaignContentMode.SELF_PROMO
  ) {
    return { ok: false, status: 400, error: "invalid contentMode" };
  }

  const keywordsTrim = (body.keywords ?? "").trim();
  if (contentMode === CampaignContentMode.NEWS_DRIVEN && !keywordsTrim) {
    return {
      ok: false,
      status: 400,
      error: "keywords required for news-driven campaigns",
    };
  }

  if (body.cadence === "WEEKLY_MULTI") {
    const d = (body.daysOfWeekMulti ?? []).filter((n) => n >= 0 && n <= 6);
    if (d.length === 0) {
      return { ok: false, status: 400, error: "Select at least one day of the week" };
    }
  }
  if (body.cadence === "SPECIFIC_DATES") {
    const s = (body.specificDates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (s.length === 0) {
      return { ok: false, status: 400, error: "Select at least one post date" };
    }
  }
  if (body.cadence === "CUSTOM_DATETIMES") {
    const td = normalizeScheduledDatetimeSlots(body.scheduledDatetimes, body.testDatetimes);
    if (td.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "Add at least one scheduled datetime (YYYY-MM-DDTHH:mm)",
      };
    }
    if (td.length > MAX_CUSTOM_DATETIME_SLOTS) {
      return {
        ok: false,
        status: 400,
        error: `At most ${MAX_CUSTOM_DATETIME_SLOTS} datetime slots allowed`,
      };
    }
  }

  const needsScheduleConfig =
    body.cadence === "DAILY" ||
    body.cadence === "WEEKLY_MULTI" ||
    body.cadence === "SPECIFIC_DATES" ||
    body.cadence === "CUSTOM_DATETIMES";
  const scRaw = toStoredScheduleConfig(
    body.cadence,
    body.daysOfWeekMulti ?? [],
    body.specificDates ?? [],
    normalizeScheduledDatetimeSlots(body.scheduledDatetimes, body.testDatetimes)
  );
  const scheduleConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull = needsScheduleConfig
    ? (scRaw != null ? scRaw : ({} as Prisma.InputJsonValue))
    : Prisma.JsonNull;

  const status = body.status ?? CampaignStatus.DRAFT;
  const startAt = body.startAt ? new Date(body.startAt) : new Date();
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const platforms = body.platforms?.length ? body.platforms : PLATFORMS;
  const postsPerRun = Math.min(5, Math.max(1, body.postsPerRun ?? 1));
  const imagesPerPost = Math.min(4, Math.max(1, body.imagesPerPost ?? 1));
  const dayOfWeek = body.dayOfWeek ?? 1;
  const hourOfDay = body.hourOfDay ?? 9;
  if (typeof body.publishMinuteOfHour === "number" && body.publishHourOfDay == null) {
    return {
      ok: false,
      status: 400,
      error: "publishHourOfDay is required when publishMinuteOfHour is set",
    };
  }

  const publishHourOfDay =
    body.publishHourOfDay != null
      ? Math.max(0, Math.min(23, body.publishHourOfDay))
      : null;
  const publishTimesNorm = normalizePublishTimesFromApi(body.publishTimes);
  if (publishTimesNorm.length > MAX_PUBLISH_TIME_SLOTS) {
    return {
      ok: false,
      status: 400,
      error: `At most ${MAX_PUBLISH_TIME_SLOTS} publish times allowed`,
    };
  }

  const publishMinuteOfHour =
    publishHourOfDay != null && typeof body.publishMinuteOfHour === "number"
      ? Math.max(0, Math.min(59, body.publishMinuteOfHour))
      : null;

  let publishSpacingMinutes: number | null = null;
  if (
    publishTimesNorm.length === 0 &&
    publishHourOfDay != null &&
    typeof body.publishSpacingMinutes === "number"
  ) {
    publishSpacingMinutes = Math.max(1, Math.min(1440, Math.floor(body.publishSpacingMinutes)));
  }

  const timezone = (body.timezone ?? "Asia/Bangkok").trim() || "Asia/Bangkok";

  const nextRunAt =
    status === CampaignStatus.ACTIVE
      ? computeNextRun(
          {
            cadence: body.cadence,
            dayOfWeek,
            hourOfDay,
            timezone,
            lastRunAt: null,
            startAt,
            customCron: body.customCron ?? null,
            scheduleConfig: needsScheduleConfig
              ? ((scRaw as Prisma.JsonValue) ?? ({} as Prisma.JsonValue))
              : null,
          },
          new Date()
        )
      : null;

  if (status === CampaignStatus.ACTIVE && nextRunAt == null) {
    return {
      ok: false,
      status: 400,
      error:
        "This schedule has no future run; add future dates or set status to DRAFT.",
    };
  }

  const contentLanguage = ["en", "th"].includes(body.contentLanguage ?? "")
    ? body.contentLanguage!
    : "en";

  const strategyId = options?.strategyId?.trim() || null;

  const c = await db.campaign.create({
    data: {
      campaignGoal: body.campaignGoal?.trim() || null,
      targetPersona: body.targetPersona?.trim() || null,
      contentPillars: body.contentPillars?.trim() || null,
      platformStrategies: body.platformStrategies ?? Prisma.JsonNull,
      name: body.name.trim(),
      brandTemplateId,
      description: body.description?.trim() || null,
      status,
      keywords: keywordsTrim,
      contentMode,
      contentLanguage,
      brandVoice: body.brandVoice?.trim() || null,
      theme: body.theme,
      cadence: body.cadence,
      dayOfWeek,
      hourOfDay,
      timezone,
      customCron: body.customCron?.trim() || null,
      scheduleConfig,
      platforms,
      postsPerRun,
      imagesPerPost,
      totalPostsCap: body.totalPostsCap ?? null,
      autoApprove: body.autoApprove ?? false,
      publishHourOfDay,
      publishMinuteOfHour,
      publishSpacingMinutes,
      publishTimes:
        publishTimesNorm.length > 0
          ? (publishTimesNorm as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      startAt,
      endAt,
      nextRunAt,
      strategyId,
    },
  });

  return { ok: true, campaign: c };
}
