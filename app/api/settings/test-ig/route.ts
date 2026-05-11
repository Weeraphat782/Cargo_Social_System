import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { decryptPayload } from "@/lib/crypto";
import type { MetaTokens } from "@/lib/publishers/types";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.platformCredential.findUnique({ where: { type: "META" } });
  if (!row) return NextResponse.json({ error: "Meta not connected" }, { status: 404 });

  const tokens = decryptPayload<MetaTokens>(row.encryptedPayload);

  const results: Record<string, unknown> = {
    igUserId: tokens.igUserId,
    pageId: tokens.pageId,
    hasUserToken: Boolean(tokens.userAccessToken),
    hasPageToken: Boolean(tokens.pageAccessToken),
  };

  // Test 1: read IG account info with user token
  if (tokens.userAccessToken && tokens.igUserId) {
    const url = new URL(`${GRAPH}/${tokens.igUserId}`);
    url.searchParams.set("fields", "id,username,name,account_type");
    url.searchParams.set("access_token", tokens.userAccessToken);
    const res = await fetch(url.toString());
    results.igReadWithUserToken = await res.json();
  }

  // Test 2: read IG account info with page token
  if (tokens.pageAccessToken && tokens.igUserId) {
    const url = new URL(`${GRAPH}/${tokens.igUserId}`);
    url.searchParams.set("fields", "id,username,name,account_type");
    url.searchParams.set("access_token", tokens.pageAccessToken);
    const res = await fetch(url.toString());
    results.igReadWithPageToken = await res.json();
  }

  // Test 3: check user token permissions
  if (tokens.userAccessToken) {
    const url = new URL(`${GRAPH}/me/permissions`);
    url.searchParams.set("access_token", tokens.userAccessToken);
    const res = await fetch(url.toString());
    const data = (await res.json()) as { data?: { permission: string; status: string }[] };
    const igPerm = data.data?.find(p => p.permission === "instagram_content_publish");
    results.igContentPublishPerm = igPerm ?? "not found";
  }

  // Test 4: check page's linked IG via page token
  if (tokens.pageAccessToken && tokens.pageId) {
    const url = new URL(`${GRAPH}/${tokens.pageId}`);
    url.searchParams.set("fields", "id,name,instagram_business_account");
    url.searchParams.set("access_token", tokens.pageAccessToken);
    const res = await fetch(url.toString());
    results.pageIgLink = await res.json();
  }

  return NextResponse.json(results);
}
