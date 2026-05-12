import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchDashboardData } from "@/lib/dashboard-payload";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const data = await fetchDashboardData();

  return (
    <DashboardClient
      initialStats={data.stats}
      initialTopics={data.topics}
      activeCampaignTotal={data.activeCampaignTotal}
      initialCampaigns={data.campaigns}
      initialUpcoming={data.upcoming}
      initialRecentRuns={data.recentRuns}
    />
  );
}
