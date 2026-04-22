import { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { executePublishPost } from "@/lib/publish-run";

export type ScheduledPublishResult = { id: string; ok: boolean; error?: string };

/**
 * Find posts in SCHEDULED status whose time has passed and publish them.
 * Same logic as GET /api/cron/publish (used by dev scheduler + manual trigger).
 */
export async function runDueScheduledPosts(): Promise<{
  processed: ScheduledPublishResult[];
}> {
  const now = new Date();
  const due = await prisma.post.findMany({
    where: {
      status: PostStatus.SCHEDULED,
      scheduledAt: { lte: now },
    },
  });

  const processed: ScheduledPublishResult[] = [];

  for (const p of due) {
    try {
      await executePublishPost(p.id);
      processed.push({ id: p.id, ok: true });
    } catch (e) {
      processed.push({
        id: p.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { processed };
}
