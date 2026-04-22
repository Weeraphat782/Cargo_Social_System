import type { PublishInput, PublishResult } from "./types";

/**
 * LinkedIn UGC Posts with shareMediaCategory IMAGE.
 * Flow: registerUpload -> PUT image -> ugcPosts
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */
export async function publishLinkedInUgc(
  accessToken: string,
  authorUrn: string,
  input: PublishInput
): Promise<PublishResult> {
  const regRes = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    }
  );

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

  const imgRes = await fetch(input.imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image for LinkedIn: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  let contentType = imgRes.headers.get("content-type")?.split(";")[0]?.trim();
  if (!contentType || contentType === "application/octet-stream") {
    const m = input.imageUrl.match(/^data:([^;,]+)/);
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

  const shareText = input.caption.slice(0, 3000);
  const ugcBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: shareText },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            media: assetUrn,
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
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
