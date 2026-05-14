import { Prisma } from "@prisma/client";
import {
  type CampaignCadence,
  type CampaignContentMode,
  type CampaignStatus,
  type CampaignTheme,
  Platform,
  PostStatus,
} from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Fetches brandTemplateId without going through the typed findMany `select` path.
 * If Prisma Client was generated from an older schema, `select: { brandTemplateId: true }`
 * throws; the column still exists in PostgreSQL after migrate, so we read it via raw SQL.
 */
async function getCampaignBrandTemplateIds(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const raw = await prisma.$queryRaw<Array<{ id: string; brandTemplateId: string }>>(
    Prisma.sql`SELECT "id", "brandTemplateId"::text AS "brandTemplateId" FROM "Campaign" WHERE "id" IN (${Prisma.join(ids)})`
  );
  for (const row of raw) map.set(row.id, row.brandTemplateId);
  return map;
}

export type CampaignListRowJson = {
  id: string;
  name: string;
  brandTemplateId: string;
  status: CampaignStatus;
  theme: CampaignTheme;
  contentMode: CampaignContentMode;
  cadence: CampaignCadence;
  keywords: string;
  nextRunAt: string | null;
  autoApprove: boolean;
  publishHourOfDay: number | null;
  publishMinuteOfHour: number | null;
  publishSpacingMinutes: number | null;
  publishTimes: Prisma.JsonValue | null;
  timezone: string;
  startAt: string;
  endAt: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  postsPerRun: number;
  imagesPerPost: number;
  totalPostsCap: number | null;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue;
  _count: { posts: number; runs: number };
  platforms: Platform[];
  publishedCount: number;
};

/** Same rows as `GET /api/campaigns` (list view). Cached 30 s; bust with revalidateTag("campaigns"). */
export const fetchCampaignsListForPage = unstable_cache(
  async (): Promise<CampaignListRowJson[]> => fetchCampaignsListImpl(),
  ["campaigns-list"],
  { tags: ["campaigns"], revalidate: 30 }
);

const campaignListRowSelect = {
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
  publishMinuteOfHour: true,
  publishSpacingMinutes: true,
  publishTimes: true,
  timezone: true,
  startAt: true,
  endAt: true,
  dayOfWeek: true,
  hourOfDay: true,
  postsPerRun: true,
  imagesPerPost: true,
  totalPostsCap: true,
  customCron: true,
  scheduleConfig: true,
  platforms: true,
  _count: { select: { posts: true, runs: true } },
} as const;

type CampaignListRowDb = Prisma.CampaignGetPayload<{ select: typeof campaignListRowSelect }>;

function mapCampaignRowToListJson(
  c: CampaignListRowDb,
  brandTemplateId: string,
  publishedCount: number
): CampaignListRowJson {
  return {
    id: c.id,
    name: c.name,
    brandTemplateId,
    status: c.status,
    theme: c.theme,
    contentMode: c.contentMode,
    cadence: c.cadence,
    keywords: c.keywords,
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
    autoApprove: c.autoApprove,
    publishHourOfDay: c.publishHourOfDay,
    publishMinuteOfHour: c.publishMinuteOfHour,
    publishSpacingMinutes: c.publishSpacingMinutes,
    publishTimes: c.publishTimes,
    timezone: c.timezone,
    startAt: c.startAt.toISOString(),
    endAt: c.endAt?.toISOString() ?? null,
    dayOfWeek: c.dayOfWeek,
    hourOfDay: c.hourOfDay,
    postsPerRun: c.postsPerRun,
    imagesPerPost: c.imagesPerPost,
    totalPostsCap: c.totalPostsCap,
    customCron: c.customCron,
    scheduleConfig: c.scheduleConfig,
    platforms: c.platforms,
    _count: c._count,
    publishedCount,
  };
}

/** Fresh list row for PATCH responses (not cached). */
export async function fetchCampaignListRowById(id: string): Promise<CampaignListRowJson | null> {
  const row = await prisma.campaign.findUnique({
    where: { id },
    select: campaignListRowSelect,
  });
  if (!row) return null;
  const brandById = await getCampaignBrandTemplateIds([id]);
  const publishedCount = await prisma.post.count({
    where: { campaignId: id, status: PostStatus.PUBLISHED },
  });
  return mapCampaignRowToListJson(row, brandById.get(id) ?? "omg", publishedCount);
}

async function fetchCampaignsListImpl(): Promise<CampaignListRowJson[]> {
  const rows = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    select: campaignListRowSelect,
  });
  const ids = rows.map((r) => r.id);
  const brandById = await getCampaignBrandTemplateIds(ids);
  const publishedGroups =
    ids.length > 0
      ? await prisma.post.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: ids }, status: PostStatus.PUBLISHED },
          _count: { _all: true },
        })
      : [];
  const publishedBy = new Map(publishedGroups.map((g) => [g.campaignId, g._count._all]));
  return rows.map((c) =>
    mapCampaignRowToListJson(c, brandById.get(c.id) ?? "omg", publishedBy.get(c.id) ?? 0)
  );
}
