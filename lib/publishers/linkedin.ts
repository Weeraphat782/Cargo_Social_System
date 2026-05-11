import type { PublishInput, PublishResult } from "./types";

const LI_API = "https://api.linkedin.com/v2";
const HEADERS_BASE = {
  "Content-Type": "application/json",
  "X-Restli-Protocol-Version": "2.0.0",
};

async function registerAndUploadImage(
  accessToken: string,
  authorUrn: string,
  imageUrl: string
): Promise<string> {
  const regRes = await fetch(`${LI_API}/assets?action=registerUpload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, ...HEADERS_BASE },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  });

  const reg = (await regRes.json()) as {
    value?: {
      uploadMechanism?: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: {
          uploadUrl?: string;
          headers?: Record<string, string>;
        };
      };
      asset?: string;
    };
  };

  if (!regRes.ok) {
    throw new Error(`LinkedIn registerUpload: ${regRes.status} ${JSON.stringify(reg)}`);
  }

  const uploadUrl =
    reg.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
  const assetUrn = reg.value?.asset;
  if (!uploadUrl || !assetUrn) {
    throw new Error("LinkedIn registerUpload: missing upload URL or asset");
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image for LinkedIn: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  let contentType = imgRes.headers.get("content-type")?.split(";")[0]?.trim();
  if (!contentType || contentType === "application/octet-stream") {
    const m = imageUrl.match(/^data:([^;,]+)/);
    contentType = m?.[1]?.trim() || "image/png";
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buf,
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`LinkedIn image upload failed: ${putRes.status} ${t}`);
  }

  return assetUrn;
}

/**
 * LinkedIn UGC Posts with shareMediaCategory IMAGE.
 * Supports single and multi-image posts.
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */
export async function publishLinkedInUgc(
  accessToken: string,
  authorUrn: string,
  input: PublishInput
): Promise<PublishResult> {
  const assetUrns = await Promise.all(
    input.imageUrls.map((url) => registerAndUploadImage(accessToken, authorUrn, url))
  );

  const ugcBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: input.caption.slice(0, 3000) },
        shareMediaCategory: "IMAGE",
        media: assetUrns.map((assetUrn) => ({ status: "READY", media: assetUrn })),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const postRes = await fetch(`${LI_API}/ugcPosts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, ...HEADERS_BASE },
    body: JSON.stringify(ugcBody),
  });

  const postJson = (await postRes.json()) as { id?: string; message?: string };
  if (!postRes.ok || !postJson.id) {
    throw new Error(
      postJson.message ?? `LinkedIn ugcPosts: ${postRes.status} ${JSON.stringify(postJson)}`
    );
  }

  return { remoteId: postJson.id, raw: postJson };
}
