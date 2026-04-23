import { unstable_cache } from "next/cache";
import { DashboardShell } from "@/components/dashboard-shell";
import { prisma } from "@/lib/db";
import { CampaignStatus } from "@prisma/client";

const getActiveCampaignCountCached = unstable_cache(
  async () =>
    prisma.campaign.count({
      where: { status: CampaignStatus.ACTIVE },
    }),
  ["active-campaign-count"],
  { revalidate: 60, tags: ["campaigns"] }
);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const activeCampaignCount = await getActiveCampaignCountCached();

  return <DashboardShell activeCampaignCount={activeCampaignCount}>{children}</DashboardShell>;
}
