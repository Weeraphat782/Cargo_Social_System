import { NextResponse } from "next/server";
import {
  CampaignContentMode,
  CampaignStatus,
  Prisma,
  type CampaignCadence,
  type CampaignTheme,
  type Platform,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fetchCampaignsListForPage } from "@/lib/campaigns-list-payload";
import { computeNextRun } from "@/lib/campaigns/scheduler";
import { toStoredScheduleConfig } from "@/lib/campaigns/schedule-config";
import { revalidateTag } from "next/cache";
import { isBrandTemplateId } from "@/lib/brands/registry";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await fetchCampaignsListForPage();
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
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
    totalPostsCap?: number | null;
    autoApprove?: boolean;
    publishHourOfDay?: number | null;
    startAt?: string;
    endAt?: string | null;
    status?: CampaignStatus;
    daysOfWeekMulti?: number[];
    specificDates?: string[];
    testDatetimes?: string[];
    brandTemplateId?: string;
  };

  let brandTemplateId = "omg";
  if (body.brandTemplateId != null && body.brandTemplateId !== "") {
    const tid = body.brandTemplateId.trim();
    if (!(await isBrandTemplateId(tid))) {
      return NextResponse.json({ error: "invalid brandTemplateId" }, { status: 400 });
    }
    brandTemplateId = tid;
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!body.theme || !body.cadence) {
    return NextResponse.json({ error: "theme and cadence required" }, { status: 400 });
  }

  const contentMode = body.contentMode ?? CampaignContentMode.NEWS_DRIVEN;
  if (
    contentMode !== CampaignContentMode.NEWS_DRIVEN &&
    contentMode !== CampaignContentMode.SELF_PROMO
  ) {
    return NextResponse.json({ error: "invalid contentMode" }, { status: 400 });
  }

  const keywordsTrim = (body.keywords ?? "").trim();
  if (contentMode === CampaignContentMode.NEWS_DRIVEN && !keywordsTrim) {
    return NextResponse.json(
      { error: "keywords required for news-driven campaigns" },
      { status: 400 }
    );
  }

  if (body.cadence === "WEEKLY_MULTI") {
    const d = (body.daysOfWeekMulti ?? []).filter((n) => n >= 0 && n <= 6);
    if (d.length === 0) {
      return NextResponse.json({ error: "Select at least one day of the week" }, { status: 400 });
    }
  }
  if (body.cadence === "SPECIFIC_DATES") {
    const s = (body.specificDates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (s.length === 0) {
      return NextResponse.json({ error: "Select at least one post date" }, { status: 400 });
    }
  }
  if (body.cadence === "TEST_MINUTES") {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "TEST_MINUTES cadence is not allowed in production" },
        { status: 400 }
      );
    }
    const td = (body.testDatetimes ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d));
    if (td.length === 0) {
      return NextResponse.json({ error: "Add at least one test datetime" }, { status: 400 });
    }
  }

  const needsScheduleConfig =
    body.cadence === "DAILY" ||
    body.cadence === "WEEKLY_MULTI" ||
    body.cadence === "SPECIFIC_DATES" ||
    body.cadence === "TEST_MINUTES";
  const scRaw = toStoredScheduleConfig(
    body.cadence,
    body.daysOfWeekMulti ?? [],
    body.specificDates ?? [],
    body.testDatetimes ?? []
  );
  const scheduleConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull = needsScheduleConfig
    ? (scRaw != null ? scRaw : ({} as Prisma.InputJsonValue))
    : Prisma.JsonNull;

  const status = body.status ?? CampaignStatus.DRAFT;
  const startAt = body.startAt ? new Date(body.startAt) : new Date();
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const platforms = body.platforms?.length
    ? body.platforms
    : PLATFORMS;
  const postsPerRun = Math.min(5, Math.max(1, body.postsPerRun ?? 1));
  const dayOfWeek = body.dayOfWeek ?? 1;
  const hourOfDay = body.hourOfDay ?? 9;
  const publishHourOfDay =
    body.publishHourOfDay != null
      ? Math.max(0, Math.min(23, body.publishHourOfDay))
      : null;
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
    return NextResponse.json(
      {
        error: "This schedule has no future run; add future dates or set status to DRAFT.",
      },
      { status: 400 }
    );
  }

  const c = await prisma.campaign.create({
    data: {
      name: body.name.trim(),
      brandTemplateId,
      description: body.description?.trim() || null,
      status,
      keywords: keywordsTrim,
      contentMode,
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
      totalPostsCap: body.totalPostsCap ?? null,
      autoApprove: body.autoApprove ?? false,
      publishHourOfDay,
      startAt,
      endAt,
      nextRunAt,
    },
  });

  revalidateTag("campaigns");
  return NextResponse.json(c);
}
