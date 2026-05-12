import { formatGraphPublishError, type GraphApiErrorJson } from "./graph-api-errors";
import type { PublishInput, PublishResult } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Poll until container status is FINISHED (or throw on ERROR/EXPIRED/timeout). */
async function waitForContainer(
  containerId: string,
  token: string,
  maxWaitMs = 30_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 2_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    const url = new URL(`${GRAPH_BASE}/${containerId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const json = (await res.json()) as { status_code?: string; error?: unknown };
    const status = json.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram media container ${status} (id=${containerId})`);
    }
    delay = Math.min(delay * 1.5, 8_000);
  }
  throw new Error(`Instagram media container not ready after ${maxWaitMs / 1000}s`);
}

async function createCarouselItem(
  igUserId: string,
  token: string,
  imageUrl: string
): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/${igUserId}/media`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("image_url", imageUrl);
  url.searchParams.set("is_carousel_item", "true");

  const res = await fetch(url.toString(), { method: "POST" });
  const json = (await res.json()) as GraphApiErrorJson;
  if (!res.ok || !json.id) {
    throw new Error(formatGraphPublishError("Instagram", res.status, json, "carousel_item"));
  }
  return json.id;
}

/**
 * Instagram Graph API: create media container then publish.
 * Single image → standard image post
 * Multiple images → carousel (CAROUSEL container with children)
 *
 * Uses userAccessToken when available — instagram_content_publish is granted on the
 * user token during OAuth; page tokens don't always inherit it for IG publishing.
 *
 * @see https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */
export async function publishInstagram(
  igUserId: string,
  pageAccessToken: string,
  input: PublishInput,
  userAccessToken?: string
): Promise<PublishResult> {
  const { imageUrls, caption } = input;
  const base = `${GRAPH_BASE}/${igUserId}`;
  // Prefer user token: instagram_content_publish is granted at the user level
  const token = userAccessToken ?? pageAccessToken;

  if (imageUrls.length <= 1) {
    const create = new URL(`${base}/media`);
    create.searchParams.set("access_token", token);
    create.searchParams.set("image_url", imageUrls[0] ?? "");
    create.searchParams.set("caption", caption);

    const r1 = await fetch(create.toString(), { method: "POST" });
    const j1 = (await r1.json()) as GraphApiErrorJson;
    if (!r1.ok || !j1.id) {
      throw new Error(formatGraphPublishError("Instagram", r1.status, j1, "create_media"));
    }

    await waitForContainer(j1.id, token);

    const publish = new URL(`${base}/media_publish`);
    publish.searchParams.set("access_token", token);
    publish.searchParams.set("creation_id", j1.id);

    const r2 = await fetch(publish.toString(), { method: "POST" });
    const j2 = (await r2.json()) as GraphApiErrorJson;
    if (!r2.ok || !j2.id) {
      throw new Error(formatGraphPublishError("Instagram", r2.status, j2, "publish"));
    }
    return { remoteId: j2.id, raw: j2 };
  }

  const itemIds = await Promise.all(
    imageUrls.map((url) => createCarouselItem(igUserId, token, url))
  );

  const carousel = new URL(`${base}/media`);
  carousel.searchParams.set("access_token", token);
  carousel.searchParams.set("media_type", "CAROUSEL");
  carousel.searchParams.set("children", itemIds.join(","));
  carousel.searchParams.set("caption", caption);

  const rc = await fetch(carousel.toString(), { method: "POST" });
  const jc = (await rc.json()) as GraphApiErrorJson;
  if (!rc.ok || !jc.id) {
    throw new Error(formatGraphPublishError("Instagram", rc.status, jc, "create_carousel"));
  }

  await waitForContainer(jc.id, token);

  const publish = new URL(`${base}/media_publish`);
  publish.searchParams.set("access_token", token);
  publish.searchParams.set("creation_id", jc.id);

  const rp = await fetch(publish.toString(), { method: "POST" });
  const jp = (await rp.json()) as GraphApiErrorJson;
  if (!rp.ok || !jp.id) {
    throw new Error(formatGraphPublishError("Instagram", rp.status, jp, "publish_carousel"));
  }
  return { remoteId: jp.id, raw: jp };
}
