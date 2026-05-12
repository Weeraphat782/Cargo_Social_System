import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { PostStatus, type Prisma } from "@prisma/client";
import { previewNextRuns, previewNextRunsUntil } from "@/lib/campaigns/schedule-math";

async function fetchCampaignDetailImpl(id: string) {
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

  if (!c) return null;

  const schedIn = {
    cadence: c.cadence,
    dayOfWeek: c.dayOfWeek,
    hourOfDay: c.hourOfDay,
    timezone: c.timezone,
    lastRunAt: c.lastRunAt,
    startAt: c.startAt,
    customCron: c.customCron,
    scheduleConfig: c.scheduleConfig as Prisma.JsonObject,
  };

  const upcomingRuns = (c.endAt
    ? previewNextRunsUntil(schedIn, c.endAt, 16)
    : previewNextRuns(schedIn, 8)
  ).map((d) => d.toISOString());

  // Serialize dates for Server-to-Client transfer
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    startAt: c.startAt.toISOString(),
    endAt: c.endAt?.toISOString() ?? null,
    lastRunAt: c.lastRunAt?.toISOString() ?? null,
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
    runs: c.runs.map(r => ({
        ...r,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    posts: c.posts.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        scheduledAt: p.scheduledAt?.toISOString() ?? null,
        variants: p.variants.map(v => ({
            ...v,
            publishedAt: v.publishedAt?.toISOString() ?? null,
        }))
    })),
    publishedCount,
    publishLogs: publishLogs.map(l => ({
        ...l,
        attemptAt: l.attemptAt.toISOString(),
    })),
    upcomingRuns,
  };
}

export const fetchCampaignDetail = unstable_cache(
  fetchCampaignDetailImpl,
  ["campaign-detail"],
  { tags: ["campaigns"], revalidate: 30 }
);

export type CampaignDetailData = NonNullable<Awaited<ReturnType<typeof fetchCampaignDetail>>>;
