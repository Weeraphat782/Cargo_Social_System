import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** POST /api/planner/plans — create or upsert a PostPlan */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    campaignId: string;
    scheduledFor: string;
    indexInRun?: number;
    pillar?: string | null;
    brief?: string | null;
    keywordHint?: string | null;
  };

  if (!body.campaignId || !body.scheduledFor) {
    return NextResponse.json({ error: "campaignId and scheduledFor are required" }, { status: 400 });
  }

  const scheduledFor = new Date(body.scheduledFor);
  if (isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledFor" }, { status: 400 });
  }

  const indexInRun = body.indexInRun ?? 0;

  const plan = await prisma.postPlan.upsert({
    where: {
      campaignId_scheduledFor_indexInRun: {
        campaignId: body.campaignId,
        scheduledFor,
        indexInRun,
      },
    },
    create: {
      campaignId: body.campaignId,
      scheduledFor,
      indexInRun,
      pillar: body.pillar ?? null,
      brief: body.brief ?? null,
      keywordHint: body.keywordHint ?? null,
    },
    update: {
      pillar: body.pillar ?? null,
      brief: body.brief ?? null,
      keywordHint: body.keywordHint ?? null,
    },
  });

  return NextResponse.json(plan);
}
