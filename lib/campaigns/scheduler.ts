import { CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runAgentForCampaign } from "@/lib/agent/run";
import { computeNextRun } from "./schedule-math";

// Re-export the pure (client-safe) schedule math from a single source.
// Client code should prefer importing from `./schedule-math` directly, but
// server code can continue to import from here.
export {
  nextWeeklySlot,
  nextDailySlot,
  firstWeekdayInNextMonth,
  computeNextRun,
  previewNextRuns,
  previewNextRunsUntil,
  previewNextRunsInRange,
  type ComputeNextRunInput,
} from "./schedule-math";

/**
 * One cron pass: all ACTIVE campaigns that are due (start/end window, post cap, nextRunAt).
 * Server-only: imports prisma + agent runner, so DO NOT import this from client code.
 */
export async function runDueCampaigns(): Promise<{
  processed: { campaignId: string; ok: boolean; postIds: string[]; error?: string }[];
}> {
  const now = new Date();
  const due = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.ACTIVE,
      nextRunAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
  });

  const processed: { campaignId: string; ok: boolean; postIds: string[]; error?: string }[] = [];

  for (const campaign of due) {
    if (campaign.totalPostsCap != null) {
      const n = await prisma.post.count({ where: { campaignId: campaign.id } });
      if (n >= campaign.totalPostsCap) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.COMPLETED, lastRunAt: now, nextRunAt: null },
        });
        processed.push({ campaignId: campaign.id, ok: true, postIds: [] });
        continue;
      }
    }
    // Atomic claim: set nextRunAt = null so a concurrent cron tick can't pick this up.
    // updateMany returns count=0 if another process already claimed (nextRunAt already changed).
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, nextRunAt: campaign.nextRunAt, status: CampaignStatus.ACTIVE },
      data: { nextRunAt: null },
    });
    if (claimed.count === 0) continue;

    const run = await prisma.campaignRun.create({
      data: { campaignId: campaign.id },
    });
    try {
      const { postIds } = await runAgentForCampaign(campaign.id, { forCron: true });
      await prisma.campaignRun.update({
        where: { id: run.id },
        data: { ok: true, finishedAt: new Date(), postId: postIds[0] ?? null },
      });
      const runAt = new Date();
      const next = computeNextRun(
        {
          cadence: campaign.cadence,
          dayOfWeek: campaign.dayOfWeek,
          hourOfDay: campaign.hourOfDay,
          timezone: campaign.timezone,
          lastRunAt: runAt,
          startAt: campaign.startAt,
          customCron: campaign.customCron,
          scheduleConfig: campaign.scheduleConfig,
        },
        new Date()
      );
      const capLeft =
        campaign.totalPostsCap == null
          ? true
          : (await prisma.post.count({ where: { campaignId: campaign.id } })) < campaign.totalPostsCap;
      const completed = !capLeft || next == null;
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          lastRunAt: runAt,
          nextRunAt: completed ? null : next,
          status: completed ? CampaignStatus.COMPLETED : CampaignStatus.ACTIVE,
        },
      });
      processed.push({ campaignId: campaign.id, ok: true, postIds });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.campaignRun.update({
        where: { id: run.id },
        data: { ok: false, finishedAt: new Date(), error: msg },
      });
      const next = computeNextRun(
        {
          cadence: campaign.cadence,
          dayOfWeek: campaign.dayOfWeek,
          hourOfDay: campaign.hourOfDay,
          timezone: campaign.timezone,
          lastRunAt: campaign.lastRunAt,
          startAt: campaign.startAt,
          customCron: campaign.customCron,
          scheduleConfig: campaign.scheduleConfig,
        },
        new Date()
      );
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          nextRunAt: next,
          lastRunAt: new Date(),
          status: next == null ? CampaignStatus.COMPLETED : CampaignStatus.ACTIVE,
        },
      });
      processed.push({ campaignId: campaign.id, ok: false, postIds: [], error: msg });
    }
  }

  return { processed };
}
