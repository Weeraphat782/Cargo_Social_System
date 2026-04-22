import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAgentForTopic } from "@/lib/agent/run";
import { runDueCampaigns } from "@/lib/campaigns/scheduler";
import { assertCronSecret } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";

/** Daily: create drafts from active topics up to CONTENT_BUDGET_PER_DAY total new posts. */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
    const env = getServerEnv();
    const budget = env.CONTENT_BUDGET_PER_DAY ?? 3;

    const topics = await prisma.topic.findMany({ where: { active: true } });
    const created: string[] = [];

    for (const t of topics) {
      if (created.length >= budget) break;
      try {
        const { postId } = await runAgentForTopic(t.id);
        created.push(postId);
      } catch (e) {
        console.error(`Agent failed for topic ${t.id}`, e);
      }
    }

    let campaignRuns: { campaignId: string; ok: boolean; postIds: string[]; error?: string }[] = [];
    try {
      const { processed } = await runDueCampaigns();
      campaignRuns = processed;
    } catch (e) {
      console.error("runDueCampaigns failed:", e);
    }

    return NextResponse.json({ ok: true, created, campaignRuns });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
