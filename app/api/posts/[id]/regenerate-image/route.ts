import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logAiCall } from "@/lib/ai-logger";
import { generateAndUploadImage, ASPECT_PRESETS } from "@/lib/imagegen/gemini";
import { resolveCampaignImageRefs } from "@/lib/brands/campaign-image-refs";
import { hasUsableMoodboard } from "@/lib/campaigns/require-moodboard";
import {
  buildCreatorDirectionBlock,
  rewriteImageUserPrompt,
} from "@/lib/imagegen/rewrite-user-prompt";

const aspectFor: Record<Platform, keyof typeof ASPECT_PRESETS> = {
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  LINKEDIN: "LINKEDIN",
  OMG: "OMG",
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: postId } = await ctx.params;

  const body = (await req.json()) as {
    variantId: string;
    prompt?: string;
    /** Negative-to-positive creator direction (optional), appended after rewrite */
    userPrompt?: string;
    referenceCategory?: string | null;
  };
  if (!body.variantId) {
    return NextResponse.json({ error: "variantId required" }, { status: 400 });
  }

  const [variant, post] = await Promise.all([
    prisma.postVariant.findFirst({
      where: { id: body.variantId, postId },
      include: { media: true },
    }),
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        sourceNews: { select: { title: true, snippet: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            description: true,
            keywords: true,
            moodboardImages: true,
            brandTemplateId: true,
            theme: true,
          },
        },
      },
    }),
  ]);
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  if (
    post?.campaign &&
    !hasUsableMoodboard(post.campaign.moodboardImages)
  ) {
    return NextResponse.json(
      { error: "Campaign has no moodboard. Generate one first." },
      { status: 409 }
    );
  }

  let prompt =
    body.prompt ?? variant.media[0]?.prompt ?? "Editorial photo hero image, no text; match the post story.";

  const newsContext = post?.sourceNews
    ? { title: post.sourceNews.title, snippet: post.sourceNews.snippet ?? undefined }
    : {
        title: post?.campaign?.name ?? "Brand or campaign content",
        snippet:
          [post?.campaign?.description, post?.campaign?.keywords].filter(Boolean).join(" | ") ||
          undefined,
      };

  const userPrompt =
    typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";
  let rewriteApplied = false;
  if (userPrompt && post?.campaign) {
    const rewrite = await rewriteImageUserPrompt({
      userPrompt,
      kind: "postImage",
      postImage: {
        postId,
        campaignName: post.campaign.name,
        newsTitle: newsContext.title,
        newsSnippet: newsContext.snippet,
        theme: post.campaign.theme,
      },
    });
    if (rewrite) {
      prompt = `${prompt}\n\n${buildCreatorDirectionBlock(rewrite)}`;
      rewriteApplied = true;
    }
  }

  let moodboardReferenceUrl: string | null = null;
  let brandReferenceUrls: string[] | null = null;
  if (post?.campaign) {
    const refs = await resolveCampaignImageRefs({
      moodboardImages: post.campaign.moodboardImages,
      brandTemplateId: post.campaign.brandTemplateId,
    });
    moodboardReferenceUrl = refs.moodboardReferenceUrl;
    brandReferenceUrls = refs.brandReferenceUrls;
  }

  try {
    logAiCall("post.regenerateImage", {
      phase: "start",
      postId,
      campaignId: post?.campaign?.id ?? null,
      aspect: aspectFor[variant.platform],
      brandRefs: brandReferenceUrls?.length ?? 0,
      moodboard: Boolean(moodboardReferenceUrl),
      hasImageUserPrompt: rewriteApplied,
    });
    const gen = await generateAndUploadImage({
      prompt,
      aspect: aspectFor[variant.platform],
      storageKeyPrefix: `posts/${postId}/${variant.platform.toLowerCase()}`,
      referenceCategory: body.referenceCategory ?? undefined,
      newsContext,
      moodboardReferenceUrl,
      brandReferenceUrls,
      subjectAnchor: moodboardReferenceUrl ? "moodboard" : "auto",
      hasUserOverride: rewriteApplied,
    });

    const media = variant.media[0];
    if (media) {
      await prisma.media.update({
        where: { id: media.id },
        data: { imageUrl: gen.imageUrl, prompt: gen.prompt },
      });
    } else {
      await prisma.media.create({
        data: {
          variantId: variant.id,
          imageUrl: gen.imageUrl,
          prompt: gen.prompt,
        },
      });
    }

    return NextResponse.json({ ok: true, imageUrl: gen.imageUrl });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let msg = raw;
    if (/limit:\s*0/i.test(raw) || /RESOURCE_EXHAUSTED/i.test(raw)) {
      msg =
        "Gemini image generation quota is 0 on your free tier. Enable billing at https://aistudio.google.com/app/apikey to generate images.";
    }
    console.error("[regenerate-image] failed:", raw);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
