import { CredentialType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptPayload, encryptPayload } from "@/lib/crypto";
import type { MetaTokens } from "@/lib/publishers/types";
import {
  exchangeForLongLivedUserToken,
  fetchMeAccounts,
} from "@/lib/meta/oauth-graph";

const DAY_MS = 86400 * 1000;

/** Only rotate credentials when OAuth expiry within this window (days). */
export const META_REFRESH_THRESHOLD_DAYS = 14;

/**
 * Exchanges stored long-lived user token for a fresh long-lived token and updates Page token from `/me/accounts`.
 * Intended for cron (`Authorization: Bearer CRON_SECRET`) before Meta user tokens (~60d) expire.
 */
export async function refreshMetaOAuthIfConfigured(opts?: {
  /** Refresh even if expiry not soon — force reconnect rotation */
  force?: boolean;
}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { ok: false, skipped: "meta_app_not_configured" };
  }

  const row = await prisma.platformCredential.findUnique({
    where: { type: CredentialType.META },
  });
  if (!row) {
    return { ok: false, skipped: "meta_not_connected" };
  }

  let tokens: MetaTokens;
  try {
    tokens = decryptPayload<MetaTokens>(row.encryptedPayload);
  } catch {
    return { ok: false, error: "decrypt_failed" };
  }

  if (!tokens.userAccessToken?.trim()) {
    return { ok: false, skipped: "no_user_access_token_use_manual_or_oauth" };
  }

  const expiry =
    tokens.userAccessTokenExpiresAt != null
      ? new Date(tokens.userAccessTokenExpiresAt)
      : row.expiresAt ?? null;

  if (!opts?.force && expiry != null && !Number.isNaN(expiry.getTime())) {
    const daysLeft = (expiry.getTime() - Date.now()) / DAY_MS;
    if (daysLeft > META_REFRESH_THRESHOLD_DAYS) {
      return { ok: true, skipped: `not_due_${Math.round(daysLeft)}d_left` };
    }
  }

  try {
    const longTok = await exchangeForLongLivedUserToken({
      clientId,
      clientSecret,
      shortLivedUserToken: tokens.userAccessToken,
    });

    const pages = await fetchMeAccounts(longTok.accessToken);
    const match = pages.find((p) => p.id === tokens.pageId && p.access_token);
    if (!match?.access_token) {
      return {
        ok: false,
        error:
          "me_accounts_missing_page — reconnect OAuth so Pages grant stays linked",
      };
    }

    const expiresInSec = longTok.expiresInSec;
    const approxExpiryIso =
      typeof expiresInSec === "number" && expiresInSec > 0
        ? new Date(Date.now() + expiresInSec * 1000).toISOString()
        : tokens.userAccessTokenExpiresAt;

    const next: MetaTokens = {
      ...tokens,
      pageAccessToken: match.access_token,
      userAccessToken: longTok.accessToken,
      userAccessTokenExpiresAt: approxExpiryIso,
    };

    const credentialExpiresAt =
      approxExpiryIso != null ? new Date(approxExpiryIso) : null;

    await prisma.platformCredential.update({
      where: { type: CredentialType.META },
      data: {
        encryptedPayload: encryptPayload(next),
        expiresAt: credentialExpiresAt,
      },
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
