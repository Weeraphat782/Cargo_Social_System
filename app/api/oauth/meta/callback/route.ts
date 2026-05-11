import { NextRequest, NextResponse } from "next/server";
import { CredentialType } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encryptPayload } from "@/lib/crypto";
import { getAppBaseUrl } from "@/lib/env";
import type { MetaTokens } from "@/lib/publishers/types";
import {
  exchangeCodeForShortLivedUserToken,
  exchangeForLongLivedUserToken,
  fetchInstagramBusinessAccountId,
  fetchMeAccounts,
  fetchPageByIdWithUserToken,
  pickPageAccountForMeta,
} from "@/lib/meta/oauth-graph";

const META_OAUTH_STATE_COOKIE = "meta_oauth_state";

function redirectWithClearedCookie(pathWithQuery: string) {
  const res = NextResponse.redirect(new URL(pathWithQuery, getAppBaseUrl()));
  res.cookies.delete(META_OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const base = getAppBaseUrl();
  const { searchParams } = new URL(req.url);

  const errParam = searchParams.get("error");
  const errDesc = searchParams.get("error_description") ?? "";
  if (errParam === "access_denied") {
    return redirectWithClearedCookie("/settings/connections?meta=denied");
  }
  if (errParam) {
    return redirectWithClearedCookie(
      `/settings/connections?meta=denied_desc&d=${encodeURIComponent(`${errParam}: ${errDesc}`.slice(0, 300))}`
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieJar = await cookies();
  const expected = cookieJar.get(META_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expected || state !== expected) {
    return redirectWithClearedCookie("/settings/connections?meta=state");
  }

  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithClearedCookie("/settings/connections?meta=config");
  }

  try {
    const short = await exchangeCodeForShortLivedUserToken({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });

    const longTok = await exchangeForLongLivedUserToken({
      clientId,
      clientSecret,
      shortLivedUserToken: short.accessToken,
    });

    const pages = await fetchMeAccounts(longTok.accessToken);
    let picked = pickPageAccountForMeta(pages);

    // Fallback for Business Suite admins: /me/accounts returns empty but the user token
    // still has page access from the OAuth dialog selection. Fetch page directly by ID.
    if (!picked?.id || !picked.access_token) {
      const fallbackPageId = process.env.META_PAGE_ID?.trim();
      if (fallbackPageId) {
        const direct = await fetchPageByIdWithUserToken({
          pageId: fallbackPageId,
          userAccessToken: longTok.accessToken,
        });
        if (direct?.id && direct.access_token) picked = direct;
      }
    }

    if (!picked?.id || !picked.access_token) {
      return redirectWithClearedCookie("/settings/connections?meta=no_pages");
    }

    let igUserId =
      picked.instagram_business_account?.id?.trim() &&
      picked.instagram_business_account.id.trim() !== ""
        ? picked.instagram_business_account.id.trim()
        : "";

    if (!igUserId) {
      igUserId =
        (await fetchInstagramBusinessAccountId({
          pageId: picked.id,
          pageAccessToken: picked.access_token,
        })) ?? "";
    }

    if (!igUserId) {
      igUserId = process.env.META_IG_USER_ID?.trim() ?? "";
    }

    const expiresInSec = longTok.expiresInSec;
    const approxExpiryIso =
      typeof expiresInSec === "number" && expiresInSec > 0
        ? new Date(Date.now() + expiresInSec * 1000).toISOString()
        : undefined;

    const payload: MetaTokens = {
      pageAccessToken: picked.access_token,
      pageId: picked.id,
      igUserId,
      userAccessToken: longTok.accessToken,
      userAccessTokenExpiresAt: approxExpiryIso,
    };

    const encryptedPayload = encryptPayload(payload);

    const credentialExpiresAt =
      approxExpiryIso != null ? new Date(approxExpiryIso) : undefined;

    await prisma.platformCredential.upsert({
      where: { type: CredentialType.META },
      create: {
        type: CredentialType.META,
        encryptedPayload,
        expiresAt: credentialExpiresAt ?? null,
      },
      update: {
        encryptedPayload,
        expiresAt: credentialExpiresAt ?? null,
      },
    });

    // ok_no_ig = connected FB page but Instagram not linked yet (show warning in UI)
    const successParam = igUserId ? "meta=ok" : "meta=ok_no_ig";
    const res = NextResponse.redirect(new URL(`/settings/connections?${successParam}`, base));
    res.cookies.delete(META_OAUTH_STATE_COOKIE);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    const res = NextResponse.redirect(
      new URL(
        `/settings/connections?meta=graph&e=${encodeURIComponent(msg.slice(0, 400))}`,
        base
      )
    );
    res.cookies.delete(META_OAUTH_STATE_COOKIE);
    return res;
  }
}
