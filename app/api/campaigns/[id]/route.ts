import { NextResponse } from "next/server";
import { CampaignStatus, type Platform, type Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/campaigns/scheduler";
import type { CampaignCadence, CampaignTheme } from "@prisma/client";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

type PatchBody = {
  name?: string;
  description?: string | null;
  keywords?: string;
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
  startAt?: string;
  endAt?: string | null;
  status?: CampaignStatus;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 50 },
      posts: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
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
  if (body.brandVoice !== undefined) u.brandVoice = body.brandVoice;
  if (body.theme != null) u.theme = body.theme;
  if (body.cadence != null) u.cadence = body.cadence;
  if (body.dayOfWeek !== undefined) u.dayOfWeek = body.dayOfWeek;
  if (body.hourOfDay !== undefined) u.hourOfDay = body.hourOfDay;
  if (body.timezone != null) u.timezone = body.timezone;
  if (body.customCron !== undefined) u.customCron = body.customCron;
  if (body.postsPerRun != null) {
    u.postsPerRun = Math.min(5, Math.max(1, body.postsPerRun));
  }
  if (body.totalPostsCap !== undefined) u.totalPostsCap = body.totalPostsCap;
  if (body.autoApprove != null) u.autoApprove = body.autoApprove;
  if (body.startAt) u.startAt = new Date(body.startAt);
  if (body.endAt !== undefined) u.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.status != null) u.status = body.status;
  if (body.platforms != null) {
    u.platforms = { set: body.platforms.length ? body.platforms : PLATFORMS };
  }

  const merged = {
    ...existing,
    cadence: (body.cadence ?? existing.cadence) as import("@prisma/client").Campaign["cadence"],
    dayOfWeek: body.dayOfWeek ?? existing.dayOfWeek,
    hourOfDay: body.hourOfDay ?? existing.hourOfDay,
    timezone: (body.timezone ?? existing.timezone) as string,
    startAt: body.startAt ? new Date(body.startAt) : existing.startAt,
    lastRunAt: existing.lastRunAt,
    customCron: body.customCron !== undefined ? body.customCron : existing.customCron,
  };
  const touchedSchedule =
    body.cadence != null ||
    body.dayOfWeek !== undefined ||
    body.hourOfDay !== undefined ||
    body.timezone != null ||
    body.startAt != null ||
    body.status != null ||
    body.customCron !== undefined;

  if (touchedSchedule) {
    const newStatus = body.status ?? existing.status;
    if (newStatus === CampaignStatus.ACTIVE) {
      u.nextRunAt = computeNextRun(
        {
          cadence: merged.cadence,
          dayOfWeek: merged.dayOfWeek,
          hourOfDay: merged.hourOfDay,
          timezone: merged.timezone,
          lastRunAt: merged.lastRunAt,
          startAt: merged.startAt,
          customCron: merged.customCron,
        },
        new Date()
      );
    } else {
      u.nextRunAt = null;
    }
  }

  const c = await prisma.campaign.update({ where: { id }, data: u });
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
  return NextResponse.json({ ok: true });
}
