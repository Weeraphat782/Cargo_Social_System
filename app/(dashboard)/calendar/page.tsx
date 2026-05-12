import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CampaignStatus, PostStatus } from "@prisma/client";
import CalendarClient from "./calendar-client";
import { getCampaignProgressBar } from "@/lib/campaigns-progress";

const postSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  publishedAt: true,
  topic: { select: { name: true } },
  variants: { select: { platform: true } },
} as const;

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [scheduledRows, publishedRows, upcomingCampaigns] = await Promise.all([
    prisma.post.findMany({
      where: { status: PostStatus.SCHEDULED },
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: postSelect,
    }),
    prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: postSelect,
    }),
    prisma.campaign.findMany({
      where: { status: CampaignStatus.ACTIVE, nextRunAt: { not: null } },
      orderBy: { nextRunAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        nextRunAt: true,
        postsPerRun: true,
        platforms: true,
        totalPostsCap: true,
        endAt: true,
        cadence: true,
        dayOfWeek: true,
        hourOfDay: true,
        timezone: true,
        startAt: true,
        customCron: true,
        scheduleConfig: true,
        _count: { select: { posts: true } },
      },
    }),
  ]);

  const mapPost = (p: (typeof scheduledRows)[number]) => ({
    ...p,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  });

  const scheduledPosts = scheduledRows.map(mapPost);
  const publishedPosts = publishedRows.map(mapPost);

  // Fetch published counts for active campaigns to compute progress
  const campaignIds = upcomingCampaigns.map((c) => c.id);
  const publishedGroups = campaignIds.length > 0
    ? await prisma.post.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds }, status: PostStatus.PUBLISHED },
        _count: { _all: true },
      })
    : [];
  const publishedById = new Map(publishedGroups.map((g) => [g.campaignId, g._count._all]));

  // Filter out campaigns whose progress bar is full (completed)
  const upcoming = upcomingCampaigns
    .filter((c) => {
      const progress = getCampaignProgressBar({
        totalPostsCap: c.totalPostsCap,
        endAt: c.endAt?.toISOString() ?? null,
        cadence: c.cadence,
        dayOfWeek: c.dayOfWeek,
        hourOfDay: c.hourOfDay,
        timezone: c.timezone,
        startAt: c.startAt.toISOString(),
        postsPerRun: c.postsPerRun,
        customCron: c.customCron,
        scheduleConfig: c.scheduleConfig,
        postCount: c._count.posts,
        publishedCount: publishedById.get(c.id) ?? 0,
      });
      return !(progress.showBar && progress.value >= progress.max);
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      nextRunAt: c.nextRunAt!.toISOString(),
      postsPerRun: c.postsPerRun,
      platforms: c.platforms,
    }));

  return <CalendarClient scheduledPosts={scheduledPosts} publishedPosts={publishedPosts} upcomingCampaigns={upcoming} />;
}
