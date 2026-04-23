import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchCampaignsListForPage } from "@/lib/campaigns-list-payload";
import CampaignsClient from "./campaigns-client";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const initialCampaigns = await fetchCampaignsListForPage();
  return <CampaignsClient initialCampaigns={initialCampaigns} />;
}
