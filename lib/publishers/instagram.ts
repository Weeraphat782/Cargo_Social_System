import type { PublishInput, PublishResult } from "./types";

/**
 * Instagram Graph API: create media container then publish.
 * @see https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */
export async function publishInstagram(
  igUserId: string,
  pageAccessToken: string,
  input: PublishInput
): Promise<PublishResult> {
  const base = `https://graph.facebook.com/v21.0/${igUserId}`;
  const create = new URL(`${base}/media`);
  create.searchParams.set("access_token", pageAccessToken);
  create.searchParams.set("image_url", input.imageUrl);
  create.searchParams.set("caption", input.caption);

  const r1 = await fetch(create.toString(), { method: "POST" });
  const j1 = (await r1.json()) as { id?: string; error?: { message: string } };
  if (!r1.ok || !j1.id) {
    throw new Error(j1.error?.message ?? `Instagram create media ${r1.status}`);
  }

  const publish = new URL(`${base}/media_publish`);
  publish.searchParams.set("access_token", pageAccessToken);
  publish.searchParams.set("creation_id", j1.id);

  const r2 = await fetch(publish.toString(), { method: "POST" });
  const j2 = (await r2.json()) as { id?: string; error?: { message: string } };
  if (!r2.ok || !j2.id) {
    throw new Error(j2.error?.message ?? `Instagram publish ${r2.status}`);
  }
  return { remoteId: j2.id, raw: j2 };
}
