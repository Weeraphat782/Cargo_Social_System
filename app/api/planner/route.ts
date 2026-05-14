import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { previewNextRunsInRange } from "@/lib/campaigns/schedule-math";

/**
 * GET /api/planner?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns merged list of computed slots + existing PostPlans for the date range.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required (YYYY-MM-DD)" }, { status: 400 });

  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T23:59:59Z`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const [campaigns, existingPlans] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      select: {
        id: true,
        name: true,
        status: true,
        cadence: true,
        dayOfWeek: true,
        hourOfDay: true,
        timezone: true,
        customCron: true,
        scheduleConfig: true,
        startAt: true,
        endAt: true,
        lastRunAt: true,
        postsPerRun: true,
        contentPillars: true,
        theme: true,
        contentMode: true,
        platforms: true,
      },
    }),
    prisma.postPlan.findMany({
      where: { scheduledFor: { gte: fromDate, lte: toDate } },
      include: { post: { select: { id: true, status: true } } },
    }),
  ]);

  const planIndex = new Map<string, (typeof existingPlans)[number]>();
  for (const p of existingPlans) {
    planIndex.set(`${p.campaignId}:${p.scheduledFor.toISOString()}:${p.indexInRun}`, p);
  }

  const campaignIds = campaigns.map((c) => c.id);

  type RangePostRow = {
    id: string;
    campaignId: string | null;
    status: import("@prisma/client").PostStatus;
    createdAt: Date;
    scheduledAt: Date | null;
  };
  type PostCountRow = { campaignId: string | null; _count: { _all: number } };

  let postCountRows: PostCountRow[];
  let rangePostRows: RangePostRow[];

  if (campaignIds.length === 0) {
    postCountRows = [];
    rangePostRows = [];
  } else {
    const pair = await Promise.all([
      prisma.post.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds }, createdAt: { lt: fromDate } },
        _count: { _all: true },
      }),
      prisma.post.findMany({
        where: {
          campaignId: { in: campaignIds },
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          campaignId: true,
          status: true,
          createdAt: true,
          scheduledAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    postCountRows = pair[0];
    rangePostRows = pair[1];
  }

  const postCountMap = new Map(postCountRows.map((r) => [r.campaignId, r._count._all]));

  const postsByCampaign = new Map<string, typeof rangePostRows>();
  for (const post of rangePostRows) {
    if (!postsByCampaign.has(post.campaignId!)) postsByCampaign.set(post.campaignId!, []);
    postsByCampaign.get(post.campaignId!)!.push(post);
  }

  const slots: {
    key: string;
    campaignId: string;
    campaignName: string;
    campaignStatus: string;
    platforms: string[];
    scheduledFor: string;
    indexInRun: number;
    pillar: string | null;
    brief: string | null;
    keywordHint: string | null;
    planStatus: string;
    planId: string | null;
    postId: string | null;
    postStatus: string | null;
    theme: string;
    contentMode: string;
  }[] = [];

  const matchedPlanIds = new Set<string>();

  for (const c of campaigns) {
    const pillars = (c.contentPillars ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const upperBound = c.endAt && c.endAt < toDate ? c.endAt : toDate;

    let runDates: Date[] = [];
    try {
      runDates = previewNextRunsInRange(
        {
          cadence: c.cadence,
          dayOfWeek: c.dayOfWeek,
          hourOfDay: c.hourOfDay,
          timezone: c.timezone,
          lastRunAt: c.lastRunAt,
          startAt: c.startAt,
          customCron: c.customCron,
          scheduleConfig: c.scheduleConfig as import("@prisma/client").Prisma.JsonObject,
        },
        fromDate,
        upperBound,
        60
      );
    } catch {
      continue;
    }

    const filtered = runDates.filter((d) => d <= toDate);
    let globalPostIndex = postCountMap.get(c.id) ?? 0;

    const campaignPosts = postsByCampaign.get(c.id) ?? [];
    let orphanIdx = 0;

    for (const runDate of filtered) {
      for (let idx = 0; idx < c.postsPerRun; idx++) {
        const pillarAuto = pillars.length > 0 ? (pillars[globalPostIndex % pillars.length] ?? null) : null;
        globalPostIndex++;

        const key = `${c.id}:${runDate.toISOString()}:${idx}`;
        const plan = planIndex.get(key);

        if (plan?.id) matchedPlanIds.add(plan.id);

        let resolvedPostId = plan?.postId ?? null;
        let resolvedPostStatus = plan?.post?.status ?? null;
        let resolvedPlanStatus: string = plan?.status ?? "NONE";

        if (resolvedPlanStatus === "PENDING" && runDate < new Date()) {
          while (orphanIdx < campaignPosts.length) {
            const p = campaignPosts[orphanIdx];
            const postTime = (p.scheduledAt ?? p.createdAt).getTime();
            const slotTime = runDate.getTime();
            if (Math.abs(postTime - slotTime) <= 4 * 60 * 60 * 1000) {
              resolvedPostId = p.id;
              resolvedPostStatus = p.status;
              resolvedPlanStatus = "EXECUTED";
              orphanIdx++;
              break;
            }
            if (postTime < slotTime - 4 * 60 * 60 * 1000) {
              orphanIdx++;
            } else {
              break;
            }
          }
        }

        slots.push({
          key,
          campaignId: c.id,
          campaignName: c.name,
          campaignStatus: c.status,
          platforms: c.platforms as string[],
          scheduledFor: runDate.toISOString(),
          indexInRun: idx,
          pillar: plan?.pillar ?? pillarAuto,
          brief: plan?.brief ?? null,
          keywordHint: plan?.keywordHint ?? null,
          planStatus: resolvedPlanStatus,
          planId: plan?.id ?? null,
          postId: resolvedPostId,
          postStatus: resolvedPostStatus,
          theme: c.theme,
          contentMode: c.contentMode,
        });
      }
    }
  }

  const unmatchedPlans = existingPlans.filter((p) => !matchedPlanIds.has(p.id));
  for (const p of unmatchedPlans) {
    const campaign = campaigns.find((ca) => ca.id === p.campaignId);
    if (!campaign) continue;

    let resolvedPostId = p.postId;
    let resolvedPostStatus = p.post?.status ?? null;
    let resolvedPlanStatus: string = p.status;

    if (resolvedPlanStatus === "PENDING" && p.scheduledFor < new Date()) {
      const campaignPosts = postsByCampaign.get(p.campaignId) ?? [];
      const slotTime = p.scheduledFor.getTime();
      const orphan = campaignPosts.find((post) => {
        const postTime = (post.scheduledAt ?? post.createdAt).getTime();
        return Math.abs(postTime - slotTime) <= 4 * 60 * 60 * 1000;
      });
      if (orphan) {
        resolvedPostId = orphan.id;
        resolvedPostStatus = orphan.status;
        resolvedPlanStatus = "EXECUTED";
      }
    }

    slots.push({
      key: `${p.campaignId}:${p.scheduledFor.toISOString()}:${p.indexInRun}`,
      campaignId: p.campaignId,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      platforms: campaign.platforms as string[],
      scheduledFor: p.scheduledFor.toISOString(),
      indexInRun: p.indexInRun,
      pillar: p.pillar,
      brief: p.brief,
      keywordHint: p.keywordHint,
      planStatus: resolvedPlanStatus,
      planId: p.id,
      postId: resolvedPostId,
      postStatus: resolvedPostStatus,
      theme: campaign.theme,
      contentMode: campaign.contentMode,
    });
  }

  slots.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  return NextResponse.json({ slots });
}
