import type { PublishInput, PublishResult } from "./types";

/**
 * Publish photo to Facebook Page via Graph API.
 * @see https://developers.facebook.com/docs/graph-api/reference/page/photos
 */
export async function publishFacebookPage(
  pageId: string,
  pageAccessToken: string,
  input: PublishInput
): Promise<PublishResult> {
  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/photos`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("caption", input.caption);
  url.searchParams.set("url", input.imageUrl);

  const res = await fetch(url.toString(), { method: "POST" });
  const json = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message ?? `Facebook error ${res.status}`);
  }
  return { remoteId: json.id, raw: json };
}
