import { NextRequest, NextResponse } from "next/server";
import { CredentialType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptPayload } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const err = searchParams.get("error");
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (err || !code) {
    return NextResponse.redirect(new URL(`/settings/connections?linkedin=error`, base));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL(`/settings/connections?linkedin=config`, base));
  }

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.redirect(new URL(`/settings/connections?linkedin=token`, base));
  }

  const accessToken = tokenJson.access_token;

  const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const me = (await meRes.json()) as { sub?: string };
  if (!meRes.ok || !me.sub) {
    return NextResponse.redirect(new URL(`/settings/connections?linkedin=profile`, base));
  }

  const personUrn = `urn:li:person:${me.sub}`;
  const encryptedPayload = encryptPayload({ accessToken, personUrn });

  await prisma.platformCredential.upsert({
    where: { type: CredentialType.LINKEDIN },
    create: {
      type: CredentialType.LINKEDIN,
      encryptedPayload,
    },
    update: { encryptedPayload },
  });

  return NextResponse.redirect(new URL(`/settings/connections?linkedin=ok`, base));
}
