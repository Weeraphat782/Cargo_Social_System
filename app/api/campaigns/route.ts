import { NextResponse } from "next/server";
import {
  CampaignStatus,
  type CampaignCadence,
  type CampaignTheme,
  type Platform,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/campaigns/scheduler";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { posts: true, runs: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name: string;
    description?: string | null;
    keywords: string;
    brandVoice?: string | null;
    theme: CampaignTheme;
    cadence: CampaignCadence;
    dayOfWeek?: number | null;
    hourOfDay?: number | null;
    timezone?: string;
    customCron?: string | null;
    platforms?: Platform[];
    postsPerRun?: number;
    totalPostsCap?: number | null;
    autoApprove?: boolean;
    startAt?: string;
    endAt?: string | null;
    status?: CampaignStatus;
  };

  if (!body.name?.trim() || !body.keywords?.trim()) {
    return NextResponse.json({ error: "name and keywords required" }, { status: 400 });
  }
  if (!body.theme || !body.cadence) {
    return NextResponse.json({ error: "theme and cadence required" }, { status: 400 });
  }

  const status = body.status ?? CampaignStatus.DRAFT;
  const startAt = body.startAt ? new Date(body.startAt) : new Date();
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const platforms = body.platforms?.length
    ? body.platforms
    : PLATFORMS;
  const postsPerRun = Math.min(5, Math.max(1, body.postsPerRun ?? 1));
  const dayOfWeek = body.dayOfWeek ?? 1;
  const hourOfDay = body.hourOfDay ?? 9;
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
          },
          new Date()
        )
      : null;

  const c = await prisma.campaign.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      status,
      keywords: body.keywords.trim(),
      brandVoice: body.brandVoice?.trim() || null,
      theme: body.theme,
      cadence: body.cadence,
      dayOfWeek,
      hourOfDay,
      timezone,
      customCron: body.customCron?.trim() || null,
      platforms,
      postsPerRun,
      totalPostsCap: body.totalPostsCap ?? null,
      autoApprove: body.autoApprove ?? false,
      startAt,
      endAt,
      nextRunAt,
    },
  });

  return NextResponse.json(c);
}
