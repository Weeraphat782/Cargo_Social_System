import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAgentForTopic } from "@/lib/agent/run";
import { runDueCampaigns } from "@/lib/campaigns/scheduler";
import { runDueScheduledPosts } from "@/lib/run-scheduled-publish";
import { assertCronSecret } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";

/** 
 * COMBINED CRON (TICK)
 * Runs both Campaign Drafting and Post Publishing.
 * Recommended for Vercel Free Plan using external cron services like cron-job.org
 */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
    const env = getServerEnv();
    
    // 1. Run Publisher (High Priority)
    const { processed: published } = await runDueScheduledPosts();

    // 2. Run Campaign Scheduler (Agent Drafting)
    const { processed: campaignRuns } = await runDueCampaigns();

    // 3. Legacy Topic-based Agent (opt-in — creates posts without campaignId when enabled)
    const topicPosts: string[] = [];
    if (env.CRON_TOPIC_AGENT_ENABLED) {
      const budget = env.CONTENT_BUDGET_PER_DAY ?? 3;
      const topics = await prisma.topic.findMany({ where: { active: true } });
      for (const t of topics) {
        if (topicPosts.length >= budget) break;
        try {
          const { postId } = await runAgentForTopic(t.id);
          topicPosts.push(postId);
        } catch (e) {
          console.error(`Agent failed for topic ${t.id}`, e);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      publishedCount: published.length,
      draftsCreated: campaignRuns.length + topicPosts.length,
      published,
      campaignRuns,
      topicPosts,
      topicAgentRan: env.CRON_TOPIC_AGENT_ENABLED,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
