import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import StrategyReviewClient from "./strategy-review-client";

export default async function StrategyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoAnalyze?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;

  const exists = await prisma.marketingStrategy.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) notFound();

  return (
    <StrategyReviewClient strategyId={id} autoAnalyze={sp.autoAnalyze === "1"} />
  );
}
