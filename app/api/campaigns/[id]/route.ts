import { NextResponse } from "next/server";
import {
  CampaignContentMode,
  CampaignStatus,
  PostStatus,
  Prisma,
  type Platform,
} from "@prisma/client";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/campaigns/scheduler";
import { previewNextRuns, previewNextRunsUntil } from "@/lib/campaigns/schedule-math";
import {
  MAX_CUSTOM_DATETIME_SLOTS,
  normalizeScheduledDatetimeSlots,
  parseScheduleConfig,
  toStoredScheduleConfig,
} from "@/lib/campaigns/schedule-config";
import {
  MAX_PUBLISH_TIME_SLOTS,
  normalizePublishTimesFromApi,
  parsePublishTimesJson,
} from "@/lib/campaigns/publish-times";
import type { CampaignCadence, CampaignTheme } from "@prisma/client";
import { isBrandTemplateId } from "@/lib/brands/registry";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

type PatchBody = {
  name?: string;
  description?: string | null;
  keywords?: string;
  contentMode?: CampaignContentMode;
  brandVoice?: string | null;
  theme?: CampaignTheme;
  cadence?: CampaignCadence;
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
  /** @deprecated Use scheduledDatetimes */
  testDatetimes?: string[];
  scheduledDatetimes?: string[];
  scheduleConfig?: Prisma.JsonValue | null;
  brandTemplateId?: string;
  contentLanguage?: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const [c, publishedCount, publishLogs] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } },
        runs: { orderBy: { startedAt: "desc" }, take: 30 },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            createdAt: true,
            scheduledAt: true,
            topic: { select: { name: true } },
            sourceNews: { select: { title: true, url: true } },
            variants: {
              orderBy: { platform: "asc" },
              select: {
                id: true,
                platform: true,
                caption: true,
                hashtags: true,
                title: true,
                slug: true,
                publishedAt: true,
                remoteId: true,
                media: {
                  select: { id: true, imageUrl: true },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        },
      },
    }),
    prisma.post.count({
      where: { campaignId: id, status: PostStatus.PUBLISHED },
    }),
    prisma.publishLog.findMany({
      where: { post: { campaignId: id } },
      include: { post: { select: { topic: { select: { name: true } } } } },
      orderBy: { attemptAt: "desc" },
      take: 20,
    }),
  ]);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schedIn = {
    cadence: c.cadence,
    dayOfWeek: c.dayOfWeek,
    hourOfDay: c.hourOfDay,
    timezone: c.timezone,
    lastRunAt: c.lastRunAt,
    startAt: c.startAt,
    customCron: c.customCron,
    scheduleConfig: c.scheduleConfig,
  };
  const upcomingRuns = (c.endAt
    ? previewNextRunsUntil(schedIn, c.endAt, 16)
    : previewNextRuns(schedIn, 8)
  ).map((d) => d.toISOString());

  return NextResponse.json({ ...c, publishedCount, publishLogs, upcomingRuns });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json()) as PatchBody;

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const u: Prisma.CampaignUpdateInput = {};
  if (body.name != null) u.name = body.name;
  if (body.description !== undefined) u.description = body.description;
  if (body.keywords != null) u.keywords = body.keywords;
  if (body.contentMode != null) {
    if (
      body.contentMode !== CampaignContentMode.NEWS_DRIVEN &&
      body.contentMode !== CampaignContentMode.SELF_PROMO
    ) {
      return NextResponse.json({ error: "invalid contentMode" }, { status: 400 });
    }
    u.contentMode = body.contentMode;
  }
  if (body.brandVoice !== undefined) u.brandVoice = body.brandVoice;
  if (body.brandTemplateId != null) {
    if (!(await isBrandTemplateId(body.brandTemplateId.trim()))) {
      return NextResponse.json({ error: "invalid brandTemplateId" }, { status: 400 });
    }
    u.brandTemplateId = body.brandTemplateId.trim();
  }
  if (body.theme != null) u.theme = body.theme;
  if (body.contentLanguage != null && ["en", "th"].includes(body.contentLanguage)) {
    u.contentLanguage = body.contentLanguage;
  }
  if (body.cadence != null) u.cadence = body.cadence;
  if (body.dayOfWeek !== undefined) u.dayOfWeek = body.dayOfWeek;
  if (body.hourOfDay !== undefined) u.hourOfDay = body.hourOfDay;
  if (body.timezone != null) u.timezone = body.timezone;
  if (body.customCron !== undefined) u.customCron = body.customCron;

  const effectiveCadence = body.cadence ?? existing.cadence;
  const scheduleFieldsTouched =
    body.cadence != null ||
    body.daysOfWeekMulti != null ||
    body.specificDates != null ||
    ((body.scheduledDatetimes !== undefined || body.testDatetimes !== undefined) &&
      (effectiveCadence === "CUSTOM_DATETIMES" || body.cadence === "CUSTOM_DATETIMES"));
  if (scheduleFieldsTouched) {
    const needs =
      effectiveCadence === "DAILY" ||
      effectiveCadence === "WEEKLY_MULTI" ||
      effectiveCadence === "SPECIFIC_DATES" ||
      effectiveCadence === "CUSTOM_DATETIMES";
    if (needs) {
      const pe = parseScheduleConfig(effectiveCadence, existing.scheduleConfig);
      const daysM =
        body.daysOfWeekMulti ??
        pe.daysOfWeek ??
        (effectiveCadence === "WEEKLY_MULTI" ? [existing.dayOfWeek ?? 1] : []);
      const dates = body.specificDates ?? pe.dates ?? [];
      const testD =
        body.scheduledDatetimes !== undefined || body.testDatetimes !== undefined
          ? normalizeScheduledDatetimeSlots(body.scheduledDatetimes, body.testDatetimes)
          : normalizeScheduledDatetimeSlots(pe.datetimes ?? []);
      if (effectiveCadence === "CUSTOM_DATETIMES") {
        if (testD.length === 0) {
          return NextResponse.json(
            { error: "Add at least one scheduled datetime (YYYY-MM-DDTHH:mm)" },
            { status: 400 }
          );
        }
        if (testD.length > MAX_CUSTOM_DATETIME_SLOTS) {
          return NextResponse.json(
            { error: `At most ${MAX_CUSTOM_DATETIME_SLOTS} datetime slots allowed` },
            { status: 400 }
          );
        }
      }
      const sc = toStoredScheduleConfig(effectiveCadence, daysM, dates, testD);
      u.scheduleConfig = sc != null ? sc : Prisma.JsonNull;
    } else {
      u.scheduleConfig = Prisma.JsonNull;
    }
  }
  if (
    body.scheduleConfig !== undefined &&
    body.daysOfWeekMulti == null &&
    body.specificDates == null &&
    body.scheduledDatetimes == null &&
    body.testDatetimes == null
  ) {
    u.scheduleConfig = body.scheduleConfig === null ? Prisma.JsonNull : body.scheduleConfig;
  }
  if (body.postsPerRun != null) {
    u.postsPerRun = Math.min(5, Math.max(1, body.postsPerRun));
  }
  if (body.imagesPerPost != null) {
    u.imagesPerPost = Math.min(4, Math.max(1, body.imagesPerPost));
  }
  if (body.totalPostsCap !== undefined) u.totalPostsCap = body.totalPostsCap;
  if (body.autoApprove != null) u.autoApprove = body.autoApprove;
  if (body.publishHourOfDay !== undefined) {
    u.publishHourOfDay =
      body.publishHourOfDay != null
        ? Math.max(0, Math.min(23, body.publishHourOfDay))
        : null;
    if (body.publishHourOfDay === null) {
      u.publishMinuteOfHour = null;
      u.publishSpacingMinutes = null;
    }
  }
  if (body.publishMinuteOfHour !== undefined) {
    if (typeof body.publishMinuteOfHour === "number") {
      const effHour =
        body.publishHourOfDay !== undefined ? body.publishHourOfDay : existing.publishHourOfDay;
      if (effHour == null) {
        return NextResponse.json(
          { error: "publishHourOfDay is required when publishMinuteOfHour is set" },
          { status: 400 }
        );
      }
      u.publishMinuteOfHour = Math.max(0, Math.min(59, body.publishMinuteOfHour));
    } else {
      u.publishMinuteOfHour = null;
    }
  }
  if (body.publishTimes !== undefined) {
    const list = normalizePublishTimesFromApi(body.publishTimes);
    if (list.length > MAX_PUBLISH_TIME_SLOTS) {
      return NextResponse.json(
        { error: `At most ${MAX_PUBLISH_TIME_SLOTS} publish times allowed` },
        { status: 400 }
      );
    }
    u.publishTimes =
      list.length > 0 ? (list as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    if (list.length > 0) u.publishSpacingMinutes = null;
  }
  if (body.publishSpacingMinutes !== undefined) {
    const mergedTimesLen =
      body.publishTimes !== undefined
        ? normalizePublishTimesFromApi(body.publishTimes).length
        : parsePublishTimesJson(existing.publishTimes).length;
    const effHour =
      body.publishHourOfDay !== undefined ? body.publishHourOfDay : existing.publishHourOfDay;
    if (body.publishSpacingMinutes === null) {
      u.publishSpacingMinutes = null;
    } else if (typeof body.publishSpacingMinutes === "number") {
      if (mergedTimesLen === 0 && effHour != null) {
        u.publishSpacingMinutes = Math.max(
          1,
          Math.min(1440, Math.floor(body.publishSpacingMinutes))
        );
      } else {
        u.publishSpacingMinutes = null;
      }
    } else {
      u.publishSpacingMinutes = null;
    }
  }
  if (body.startAt) u.startAt = new Date(body.startAt);
  if (body.endAt !== undefined) u.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.status != null) u.status = body.status;
  if (body.platforms != null) {
    u.platforms = { set: body.platforms.length ? body.platforms : PLATFORMS };
  }

  const mergedCadence = body.cadence ?? existing.cadence;
  const mergedParsed = parseScheduleConfig(mergedCadence, existing.scheduleConfig);
  const mergedTestD =
    body.scheduledDatetimes !== undefined || body.testDatetimes !== undefined
      ? normalizeScheduledDatetimeSlots(body.scheduledDatetimes, body.testDatetimes)
      : normalizeScheduledDatetimeSlots(mergedParsed.datetimes ?? []);
  const mergedScheduleForCompute: Prisma.JsonValue | null =
    mergedCadence === "DAILY" ||
    mergedCadence === "WEEKLY_MULTI" ||
    mergedCadence === "SPECIFIC_DATES" ||
    mergedCadence === "CUSTOM_DATETIMES"
      ? ((toStoredScheduleConfig(
          mergedCadence,
          body.daysOfWeekMulti ?? mergedParsed.daysOfWeek ?? [existing.dayOfWeek ?? 1],
          body.specificDates ?? mergedParsed.dates ?? [],
          mergedTestD
        ) ?? {}) as Prisma.JsonValue)
      : null;

  const merged = {
    ...existing,
    cadence: mergedCadence as import("@prisma/client").Campaign["cadence"],
    dayOfWeek: body.dayOfWeek ?? existing.dayOfWeek,
    hourOfDay: body.hourOfDay ?? existing.hourOfDay,
    timezone: (body.timezone ?? existing.timezone) as string,
    startAt: body.startAt ? new Date(body.startAt) : existing.startAt,
    lastRunAt: existing.lastRunAt,
    customCron: body.customCron !== undefined ? body.customCron : existing.customCron,
    scheduleConfig:
      body.cadence != null ||
      body.daysOfWeekMulti != null ||
      body.specificDates != null ||
      ((body.scheduledDatetimes !== undefined || body.testDatetimes !== undefined) &&
        mergedCadence === "CUSTOM_DATETIMES")
        ? mergedScheduleForCompute
        : (existing.scheduleConfig as Prisma.JsonValue | null),
  };
  const touchedSchedule =
    body.cadence != null ||
    body.dayOfWeek !== undefined ||
    body.hourOfDay !== undefined ||
    body.timezone != null ||
    body.startAt != null ||
    body.status != null ||
    body.customCron !== undefined ||
    body.daysOfWeekMulti != null ||
    body.specificDates != null ||
    ((body.scheduledDatetimes !== undefined || body.testDatetimes !== undefined) &&
      (mergedCadence === "CUSTOM_DATETIMES" || body.cadence === "CUSTOM_DATETIMES")) ||
    body.scheduleConfig !== undefined;

  if (touchedSchedule) {
    const newStatus = body.status ?? existing.status;
    if (newStatus === CampaignStatus.ACTIVE) {
      const next = computeNextRun(
        {
          cadence: merged.cadence,
          dayOfWeek: merged.dayOfWeek,
          hourOfDay: merged.hourOfDay,
          timezone: merged.timezone,
          lastRunAt: merged.lastRunAt,
          startAt: merged.startAt,
          customCron: merged.customCron,
          scheduleConfig: merged.scheduleConfig,
        },
        new Date()
      );
      if (next == null) {
        return NextResponse.json(
          { error: "This schedule has no future run; adjust dates or stay in DRAFT." },
          { status: 400 }
        );
      }
      u.nextRunAt = next;
    } else {
      u.nextRunAt = null;
    }
  }

  const c = await prisma.campaign.update({ where: { id }, data: u });
  revalidateTag("campaigns");
  return NextResponse.json(c);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    // Delete all posts first (cascades to variants, media, publish logs).
    // Without this, posts get campaignId=null (SetNull) and linger in the queue.
    await prisma.post.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateTag("campaigns");
  revalidateTag("posts");
  return NextResponse.json({ ok: true });
}
