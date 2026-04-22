import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runAgentForTopic } from "@/lib/agent/run";
import { assertCronSecret } from "@/lib/cron-auth";

export async function POST(req: NextRequest) {
  try {
    const cron = req.headers.get("authorization")?.startsWith("Bearer ");
    if (cron) {
      assertCronSecret(req);
    } else {
      const session = await auth();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await req.json()) as { topicId: string };
    if (!body.topicId) {
      return NextResponse.json({ error: "topicId required" }, { status: 400 });
    }

    const { postId } = await runAgentForTopic(body.topicId);
    return NextResponse.json({ ok: true, postId });
  } catch (e) {
    console.error("[/api/agent/run] error:", e);
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
