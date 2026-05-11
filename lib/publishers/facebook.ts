import { formatGraphPublishError, type GraphApiErrorJson } from "./graph-api-errors";
import type { PublishInput, PublishResult } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function uploadPhotoUnpublished(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string
): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/photos`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("published", "false");

  const res = await fetch(url.toString(), { method: "POST" });
  const json = (await res.json()) as GraphApiErrorJson;
  if (!res.ok || !json.id) {
    throw new Error(formatGraphPublishError("Facebook", res.status, json, "upload_photo"));
  }
  return json.id;
}

/**
 * Publish photo(s) to Facebook Page via Graph API.
 * Single image → POST /{page-id}/photos
 * Multiple images → upload each unpublished then POST /{page-id}/feed with attached_media
 */
export async function publishFacebookPage(
  pageId: string,
  pageAccessToken: string,
  input: PublishInput
): Promise<PublishResult> {
  const { imageUrls, caption } = input;

  if (imageUrls.length <= 1) {
    const url = new URL(`${GRAPH_BASE}/${pageId}/photos`);
    url.searchParams.set("access_token", pageAccessToken);
    url.searchParams.set("caption", caption);
    url.searchParams.set("url", imageUrls[0] ?? "");

    const res = await fetch(url.toString(), { method: "POST" });
    const json = (await res.json()) as GraphApiErrorJson;
    if (!res.ok || !json.id) {
      throw new Error(formatGraphPublishError("Facebook", res.status, json));
    }
    return { remoteId: json.id, raw: json };
  }

  const photoIds = await Promise.all(
    imageUrls.map((imgUrl) => uploadPhotoUnpublished(pageId, pageAccessToken, imgUrl))
  );

  const feedUrl = new URL(`${GRAPH_BASE}/${pageId}/feed`);
  feedUrl.searchParams.set("access_token", pageAccessToken);
  feedUrl.searchParams.set("message", caption);
  feedUrl.searchParams.set(
    "attached_media",
    JSON.stringify(photoIds.map((id) => ({ media_fbid: id })))
  );

  const res = await fetch(feedUrl.toString(), { method: "POST" });
  const json = (await res.json()) as GraphApiErrorJson;
  if (!res.ok || !json.id) {
    throw new Error(formatGraphPublishError("Facebook", res.status, json, "feed"));
  }
  return { remoteId: json.id, raw: json };
}
