import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { fetchCampaignDetail } from "@/lib/campaigns-detail-payload";
import CampaignDetailClient from "./campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const initialData = await fetchCampaignDetail(id);

  if (!initialData) {
    notFound();
  }

  return <CampaignDetailClient initialData={initialData} />;
}
