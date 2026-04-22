import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledPosts } from "@/lib/run-scheduled-publish";
import { assertCronSecret } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
    const { processed: results } = await runDueScheduledPosts();

    return NextResponse.json({ ok: true, processed: results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
