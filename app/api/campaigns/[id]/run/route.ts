import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runAgentForCampaign } from "@/lib/agent/run";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const { postIds } = await runAgentForCampaign(id, { forCron: false });
    return NextResponse.json({ ok: true, postIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
