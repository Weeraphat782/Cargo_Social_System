import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/cron-auth";
import { refreshMetaOAuthIfConfigured } from "@/lib/meta/refresh-oauth";

/**
 * Scheduled Meta OAuth rotation — exchanges stored user token before expiry (~60d).
 * Vercel: schedule similarly to other cron routes; uses same CRON_SECRET as `/api/cron/publish`.
 */
export async function GET(req: NextRequest) {
  try {
    assertCronSecret(req);
    const force = new URL(req.url).searchParams.get("force") === "true";
    const result = await refreshMetaOAuthIfConfigured({ force });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
