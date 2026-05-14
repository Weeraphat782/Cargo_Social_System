import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type SlotBody = {
  campaignId: string;
  scheduledFor: string;
  indexInRun?: number;
  pillar?: string | null;
  brief?: string | null;
  keywordHint?: string | null;
};

/** POST /api/planner/plans/batch — upsert many PostPlans in one transaction */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { slots?: SlotBody[] };
  if (!Array.isArray(body.slots) || body.slots.length === 0) {
    return NextResponse.json({ error: "slots array required" }, { status: 400 });
  }

  const slots = body.slots.slice(0, 80);

  const parsed: Array<{
    campaignId: string;
    scheduledFor: Date;
    indexInRun: number;
    pillar: string | null;
    brief: string | null;
    keywordHint: string | null;
  }> = [];

  for (const s of slots) {
    if (!s.campaignId || !s.scheduledFor) {
      return NextResponse.json({ error: "each slot needs campaignId and scheduledFor" }, { status: 400 });
    }
    const scheduledFor = new Date(s.scheduledFor);
    if (isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledFor" }, { status: 400 });
    }
    parsed.push({
      campaignId: s.campaignId,
      scheduledFor,
      indexInRun: s.indexInRun ?? 0,
      pillar: s.pillar ?? null,
      brief: s.brief ?? null,
      keywordHint: s.keywordHint ?? null,
    });
  }

  const plans = await prisma.$transaction(
    parsed.map((p) =>
      prisma.postPlan.upsert({
        where: {
          campaignId_scheduledFor_indexInRun: {
            campaignId: p.campaignId,
            scheduledFor: p.scheduledFor,
            indexInRun: p.indexInRun,
          },
        },
        create: {
          campaignId: p.campaignId,
          scheduledFor: p.scheduledFor,
          indexInRun: p.indexInRun,
          pillar: p.pillar,
          brief: p.brief,
          keywordHint: p.keywordHint,
        },
        update: {
          pillar: p.pillar,
          brief: p.brief,
          keywordHint: p.keywordHint,
        },
      })
    )
  );

  return NextResponse.json({ plans });
}
