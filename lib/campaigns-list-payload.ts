import type { Prisma } from "@prisma/client";
import {
  type CampaignCadence,
  type CampaignContentMode,
  type CampaignStatus,
  type CampaignTheme,
  Platform,
  PostStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";

export type CampaignListRowJson = {
  id: string;
  name: string;
  status: CampaignStatus;
  theme: CampaignTheme;
  contentMode: CampaignContentMode;
  cadence: CampaignCadence;
  keywords: string;
  nextRunAt: string | null;
  autoApprove: boolean;
  publishHourOfDay: number | null;
  timezone: string;
  startAt: string;
  endAt: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  postsPerRun: number;
  totalPostsCap: number | null;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue;
  _count: { posts: number; runs: number };
  platforms: Platform[];
  publishedCount: number;
};

/** Same rows as `GET /api/campaigns` (list view). */
export async function fetchCampaignsListForPage(): Promise<CampaignListRowJson[]> {
  const rows = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      theme: true,
      contentMode: true,
      cadence: true,
      keywords: true,
      nextRunAt: true,
      autoApprove: true,
      publishHourOfDay: true,
      timezone: true,
      startAt: true,
      endAt: true,
      dayOfWeek: true,
      hourOfDay: true,
      postsPerRun: true,
      totalPostsCap: true,
      customCron: true,
      platforms: true,
      _count: { select: { posts: true, runs: true } },
    },
  });
  const ids = rows.map((r) => r.id);
  const publishedGroups =
    ids.length > 0
      ? await prisma.post.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: ids }, status: PostStatus.PUBLISHED },
          _count: { _all: true },
        })
      : [];
  const publishedBy = new Map(publishedGroups.map((g) => [g.campaignId, g._count._all]));
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    theme: c.theme,
    contentMode: c.contentMode,
    cadence: c.cadence,
    keywords: c.keywords,
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
    autoApprove: c.autoApprove,
    publishHourOfDay: c.publishHourOfDay,
    timezone: c.timezone,
    startAt: c.startAt.toISOString(),
    endAt: c.endAt?.toISOString() ?? null,
    dayOfWeek: c.dayOfWeek,
    hourOfDay: c.hourOfDay,
    postsPerRun: c.postsPerRun,
    totalPostsCap: c.totalPostsCap,
    customCron: c.customCron,
    scheduleConfig: c.scheduleConfig,
    platforms: c.platforms,
    _count: c._count,
    publishedCount: publishedBy.get(c.id) ?? 0,
  }));
}
