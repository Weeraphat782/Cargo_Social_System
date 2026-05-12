import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CampaignStatus, PostStatus } from "@prisma/client";

async function fetchDashboardImpl() {
  const [
    postStatsGroup,
    topicCount,
    topics,
    activeCampaignTotal,
    activeCampaigns,
    upcomingPosts,
    recentRuns,
  ] = await Promise.all([
    prisma.post.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.topic.count(),
    prisma.topic.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, keywords: true, active: true },
    }),
    prisma.campaign.count({ where: { status: CampaignStatus.ACTIVE } }),
    prisma.campaign.findMany({
      where: { status: CampaignStatus.ACTIVE },
      orderBy: { nextRunAt: "asc" },
      take: 3,
      select: {
        id: true,
        name: true,
        cadence: true,
        nextRunAt: true,
        theme: true,
        platforms: true,
        postsPerRun: true,
        totalPostsCap: true,
        startAt: true,
        endAt: true,
        dayOfWeek: true,
        hourOfDay: true,
        timezone: true,
        customCron: true,
        scheduleConfig: true,
        _count: { select: { runs: true, posts: true } },
      },
    }),
    prisma.post.findMany({
      where: { status: PostStatus.SCHEDULED, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        campaign: { select: { name: true } },
        variants: {
          take: 1,
          orderBy: { platform: "asc" },
          select: { platform: true, caption: true },
        },
      },
    }),
    prisma.campaignRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 3,
      select: {
        id: true,
        startedAt: true,
        ok: true,
        campaign: { select: { name: true } },
      },
    }),
  ]);

  const campaignIds = activeCampaigns.map((c) => c.id);
  const publishedRows =
    campaignIds.length > 0
      ? await prisma.post.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: campaignIds }, status: PostStatus.PUBLISHED },
          _count: { _all: true },
        })
      : [];
  const publishedByCampaign = new Map(publishedRows.map((r) => [r.campaignId!, r._count._all]));

  const statsMap = Object.fromEntries(postStatsGroup.map((g) => [g.status, g._count._all]));

  return {
    stats: {
      pending: statsMap[PostStatus.PENDING_APPROVAL] || 0,
      approved: statsMap[PostStatus.APPROVED] || 0,
      scheduled: statsMap[PostStatus.SCHEDULED] || 0,
      published: statsMap[PostStatus.PUBLISHED] || 0,
      topics: topicCount,
    },
    topics,
    activeCampaignTotal,
    campaigns: activeCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      cadence: c.cadence,
      theme: c.theme,
      nextRunAt: c.nextRunAt?.toISOString() ?? null,
      platforms: c.platforms,
      postsPerRun: c.postsPerRun,
      totalPostsCap: c.totalPostsCap,
      startAt: c.startAt.toISOString(),
      endAt: c.endAt?.toISOString() ?? null,
      dayOfWeek: c.dayOfWeek,
      hourOfDay: c.hourOfDay,
      timezone: c.timezone,
      customCron: c.customCron,
      scheduleConfig: c.scheduleConfig,
      publishedCount: publishedByCampaign.get(c.id) ?? 0,
      _count: c._count,
    })),
    upcoming: upcomingPosts.map((p) => {
      const v = p.variants[0];
      const cap = (v?.caption ?? "").replace(/\s+/g, " ").trim();
      return {
        id: p.id,
        scheduledAt: p.scheduledAt!.toISOString(),
        campaignName: p.campaign?.name ?? null,
        platform: v?.platform ?? "FACEBOOK",
        captionSnippet: cap.length > 80 ? `${cap.slice(0, 77)}…` : cap,
      };
    }),
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      startedAt: r.startedAt.toISOString(),
      ok: r.ok,
      campaignName: r.campaign.name,
    })),
  };
}

export const fetchDashboardData = unstable_cache(
  fetchDashboardImpl,
  ["dashboard-data"],
  { tags: ["campaigns", "posts"], revalidate: 30 }
);

export type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;
