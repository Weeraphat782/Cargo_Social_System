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
import { parseScheduleConfig, toStoredScheduleConfig } from "@/lib/campaigns/schedule-config";
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
  totalPostsCap?: number | null;
  autoApprove?: boolean;
  publishHourOfDay?: number | null;
  startAt?: string;
  endAt?: string | null;
  status?: CampaignStatus;
  daysOfWeekMulti?: number[];
  specificDates?: string[];
  testDatetimes?: string[];
  scheduleConfig?: Prisma.JsonValue | null;
  brandTemplateId?: string;
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

  const mergedCadenceEarly = body.cadence ?? existing.cadence;
  if (mergedCadenceEarly === "TEST_MINUTES" && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "TEST_MINUTES cadence is not allowed in production" },
      { status: 400 }
    );
  }

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
    (body.testDatetimes != null &&
      (effectiveCadence === "TEST_MINUTES" || body.cadence === "TEST_MINUTES"));
  if (scheduleFieldsTouched) {
    const needs =
      effectiveCadence === "DAILY" ||
      effectiveCadence === "WEEKLY_MULTI" ||
      effectiveCadence === "SPECIFIC_DATES" ||
      effectiveCadence === "TEST_MINUTES";
    if (needs) {
      const pe = parseScheduleConfig(effectiveCadence, existing.scheduleConfig);
      const daysM =
        body.daysOfWeekMulti ??
        pe.daysOfWeek ??
        (effectiveCadence === "WEEKLY_MULTI" ? [existing.dayOfWeek ?? 1] : []);
      const dates = body.specificDates ?? pe.dates ?? [];
      const testD = (body.testDatetimes ?? pe.datetimes ?? []).filter((d) =>
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d)
      );
      if (effectiveCadence === "TEST_MINUTES" && testD.length === 0) {
        return NextResponse.json({ error: "Add at least one test datetime" }, { status: 400 });
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
    body.testDatetimes == null
  ) {
    u.scheduleConfig = body.scheduleConfig === null ? Prisma.JsonNull : body.scheduleConfig;
  }
  if (body.postsPerRun != null) {
    u.postsPerRun = Math.min(5, Math.max(1, body.postsPerRun));
  }
  if (body.totalPostsCap !== undefined) u.totalPostsCap = body.totalPostsCap;
  if (body.autoApprove != null) u.autoApprove = body.autoApprove;
  if (body.publishHourOfDay !== undefined) {
    u.publishHourOfDay =
      body.publishHourOfDay != null
        ? Math.max(0, Math.min(23, body.publishHourOfDay))
        : null;
  }
  if (body.startAt) u.startAt = new Date(body.startAt);
  if (body.endAt !== undefined) u.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.status != null) u.status = body.status;
  if (body.platforms != null) {
    u.platforms = { set: body.platforms.length ? body.platforms : PLATFORMS };
  }

  const mergedCadence = body.cadence ?? existing.cadence;
  const mergedParsed = parseScheduleConfig(mergedCadence, existing.scheduleConfig);
  const mergedTestD = (body.testDatetimes ?? mergedParsed.datetimes ?? []).filter((d) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d)
  );
  const mergedScheduleForCompute: Prisma.JsonValue | null =
    mergedCadence === "DAILY" ||
    mergedCadence === "WEEKLY_MULTI" ||
    mergedCadence === "SPECIFIC_DATES" ||
    mergedCadence === "TEST_MINUTES"
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
      (body.testDatetimes != null && mergedCadence === "TEST_MINUTES")
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
    (body.testDatetimes != null && (mergedCadence === "TEST_MINUTES" || body.cadence === "TEST_MINUTES")) ||
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
    await prisma.campaign.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateTag("campaigns");
  return NextResponse.json({ ok: true });
}
