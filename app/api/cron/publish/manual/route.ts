import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runDueScheduledPosts } from "@/lib/run-scheduled-publish";

/**
 * Dashboard-only: run the same logic as GET /api/cron/publish without CRON_SECRET.
 * Use in local dev or when you want to force-publish due SCHEDULED posts immediately.
 */
export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processed } = await runDueScheduledPosts();
  return NextResponse.json({ ok: true, processed });
}
