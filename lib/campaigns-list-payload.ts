import type {
  CampaignCadence,
  CampaignContentMode,
  CampaignStatus,
  CampaignTheme,
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
  timezone: string;
  _count: { posts: number; runs: number };
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
      timezone: true,
      _count: { select: { posts: true, runs: true } },
    },
  });
  return rows.map((c) => ({
    ...c,
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
  }));
}
