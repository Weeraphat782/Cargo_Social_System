import { DashboardShell } from "@/components/dashboard-shell";
import { prisma } from "@/lib/db";
import { CampaignStatus } from "@prisma/client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const activeCampaignCount = await prisma.campaign.count({
    where: { status: CampaignStatus.ACTIVE },
  });

  return <DashboardShell activeCampaignCount={activeCampaignCount}>{children}</DashboardShell>;
}
