/** Meta Graph API helpers for OAuth (Facebook Login → Page + IG tokens). */

export const META_GRAPH_API_VERSION = "v21.0";

export const META_LOGIN_DIALOG_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_content_publish",
  "read_insights",
  "instagram_manage_insights",
].join(",");

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export type GraphErrorBody = {
  error?: { message?: string; code?: number; type?: string };
};

export async function exchangeCodeForShortLivedUserToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string; expiresInSec?: number }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("client_secret", params.clientSecret);
  url.searchParams.set("code", params.code);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as GraphErrorBody & {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !json.access_token) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`oauth/access_token (code): ${msg}`);
  }
  return {
    accessToken: json.access_token,
    expiresInSec: typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

export async function exchangeForLongLivedUserToken(params: {
  clientId: string;
  clientSecret: string;
  shortLivedUserToken: string;
}): Promise<{ accessToken: string; expiresInSec?: number }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("client_secret", params.clientSecret);
  url.searchParams.set("fb_exchange_token", params.shortLivedUserToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as GraphErrorBody & {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !json.access_token) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`oauth/access_token (fb_exchange_token): ${msg}`);
  }
  return {
    accessToken: json.access_token,
    expiresInSec: typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

export type PageAccountRow = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string } | null;
};

export async function fetchMeAccounts(accessToken: string): Promise<PageAccountRow[]> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as GraphErrorBody & { data?: PageAccountRow[] };
  if (!res.ok) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`me/accounts: ${msg}`);
  }
  return json.data ?? [];
}

/** Fallback when `instagram_business_account` is not nested under `/me/accounts`. */
export async function fetchInstagramBusinessAccountId(params: {
  pageId: string;
  pageAccessToken: string;
}): Promise<string | null> {
  const url = new URL(`${GRAPH_BASE}/${params.pageId}`);
  url.searchParams.set("fields", "instagram_business_account{id}");
  url.searchParams.set("access_token", params.pageAccessToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as GraphErrorBody & {
    instagram_business_account?: { id?: string } | null;
  };
  if (!res.ok) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`GET page instagram_business_account: ${msg}`);
  }
  const id = json.instagram_business_account?.id?.trim();
  return id ? id : null;
}

/**
 * Prefer a Page row that already exposes IG linkage; otherwise the first Page with access_token.
 */
export function pickPageAccountForMeta(rows: PageAccountRow[]): PageAccountRow | null {
  if (!rows.length) return null;
  const withIg = rows.find(
    (r) =>
      r.access_token &&
      r.instagram_business_account?.id &&
      String(r.instagram_business_account.id).trim() !== ""
  );
  if (withIg) return withIg;
  const withTok = rows.find((r) => r.access_token && r.id);
  return withTok ?? null;
}
