import { runDueScheduledPosts } from "@/lib/run-scheduled-publish";
import { runDueCampaigns } from "@/lib/campaigns/scheduler";

const GLOBAL_KEY = Symbol.for("omg.devSchedulerStarted");

/**
 * In development, poll every 60s for due SCHEDULED posts and publish them.
 * Production uses Vercel Cron → GET /api/cron/publish.
 */
export function registerDevScheduler(): void {
  if (process.env.NODE_ENV === "production") return;

  const g = globalThis as unknown as Record<symbol, boolean>;
  if (g[GLOBAL_KEY]) return;
  g[GLOBAL_KEY] = true;

  const intervalMs = 60_000;

  async function tick() {
    try {
      const { processed } = await runDueScheduledPosts();
      if (processed.length) {
        const ok = processed.filter((p) => p.ok).length;
        const fail = processed.length - ok;
        console.log(
          `[dev-scheduler] tick: processed ${processed.length} post(s) — ok: ${ok}, failed: ${fail}`
        );
      }
    } catch (e) {
      console.error("[dev-scheduler] tick failed:", e);
    }
    try {
      const { processed } = await runDueCampaigns();
      if (processed.length) {
        const ok = processed.filter((p) => p.ok).length;
        console.log(
          `[dev-scheduler] campaigns: ${processed.length} run(s) — ok: ${ok}`
        );
      }
    } catch (e) {
      console.error("[dev-scheduler] campaigns tick failed:", e);
    }
  }

  void tick();
  setInterval(() => {
    void tick();
  }, intervalMs);

  console.log(
    `[dev-scheduler] started (every ${intervalMs / 1000}s) — due SCHEDULED posts will auto-publish`
  );
}
