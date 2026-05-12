/**
 * Gemini-powered social draft runner: structured JSON copy + Gemini image generation.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import {
  CampaignContentMode,
  CampaignStatus,
  Platform,
  PostStatus,
} from "@prisma/client";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { nextDailySlot, nextWallClockHmAfter } from "@/lib/campaigns/schedule-math";
import { parsePublishTimesJson } from "@/lib/campaigns/publish-times";
import { requireEnv } from "@/lib/env";
import { searchNews, searchNewsWithGemini, type GoogleNewsResult } from "@/lib/news";
import { generateAndUploadImage, type AspectKey } from "@/lib/imagegen/gemini";
import { withGeminiRetry } from "@/lib/gemini-retry";
import {
  buildCampaignNewsDraftPrompt,
  buildCampaignSelfPromoDraftPrompt,
  buildTopicNewsDraftPrompt,
} from "@/lib/brands/build-prompts";
import { getBrandTemplateOrDefault, getThemeBundleForBrand } from "@/lib/brands/registry";
import type { BrandPromptTemplate } from "@/lib/brands/types";
import type { ThemeBundle } from "@/lib/agent/themes";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];

const PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export type DraftJson = {
  facebook: { caption: string };
  instagram: { caption: string; hashtags: string };
  linkedin: { caption: string };
  omg: {
    title: string;
    slug: string;
    summary: string;
    bodyMd: string;
    sourceTitle: string;
    sourceUrl: string;
  };
  /** Content-first visual plan for the single shared image reused on all platforms. */
  imagePrompt: ImagePromptBlock;
};

/** Structured hero-image plan: subject and elements must follow the source article (or campaign focus for self-promo). */
export type ImagePromptBlock = {
  subject: string;
  keyElements: string[];
  mood?: string;
};

const IMAGE_PROMPT_JSON_RULES = `The imagePrompt field MUST be a JSON object with:
- subject: one sentence for the main scene, using CONCRETE NOUNS from the article title/snippet (or from the campaign / focus for self-promo). Do NOT default to pharmaceutical cold boxes, high-tech control rooms, dashboards, or generic warehouse interiors unless the source explicitly describes them.
- keyElements: 3-5 short strings (places, objects, people/roles, actions) taken from the same source. No brand names as readable text in the final image.
- mood: optional 1-4 words. Theme palette and lighting are added later; do not pack environment clichés into subject. No text, watermarks, or logos in the final image.`;

const draftResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    facebook: {
      type: Type.OBJECT,
      properties: {
        caption: {
          type: Type.STRING,
          description: "Facebook Page post body, ~100-180 words, one soft CTA",
        },
      },
      required: ["caption"],
    },
    instagram: {
      type: Type.OBJECT,
      properties: {
        caption: {
          type: Type.STRING,
          description: "Instagram caption, up to 2200 chars, strong hook",
        },
        hashtags: {
          type: Type.STRING,
          description: "Space-separated hashtags starting with #",
        },
      },
      required: ["caption", "hashtags"],
    },
    linkedin: {
      type: Type.OBJECT,
      properties: {
        caption: {
          type: Type.STRING,
          description: "LinkedIn thought-leadership post, short paragraphs",
        },
      },
      required: ["caption"],
    },
    omg: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        slug: { type: Type.STRING, description: "kebab-case unique slug" },
        summary: { type: Type.STRING, description: "1-2 sentence summary" },
        bodyMd: {
          type: Type.STRING,
          description:
            "Full markdown article 500-900 words with H2 headings; end with blockquote Source line",
        },
        sourceTitle: {
          type: Type.STRING,
          description: "Original news article title (verbatim from source)",
        },
        sourceUrl: {
          type: Type.STRING,
          description: "Original news article URL (verbatim from source)",
        },
      },
      required: ["title", "slug", "summary", "bodyMd", "sourceTitle", "sourceUrl"],
    },
    imagePrompt: {
      type: Type.OBJECT,
      description: IMAGE_PROMPT_JSON_RULES,
      properties: {
        subject: {
          type: Type.STRING,
          description: "Main visual scene, grounded in the source article (or self-promo focus), not a generic stock cliché.",
        },
        keyElements: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3-5 source-grounded details",
        },
        mood: {
          type: Type.STRING,
          description: "Optional short mood phrase",
        },
      },
      required: ["subject", "keyElements"],
    },
  },
  required: ["facebook", "instagram", "linkedin", "omg", "imagePrompt"],
};

/** Default palette for topic-based drafts (no campaign theme). */
const DEFAULT_NEUTRAL_PALETTE =
  "Cool professional neutrals; natural balanced lighting; editorial clarity.";

export function normalizeImagePrompt(raw: unknown): ImagePromptBlock {
  if (raw && typeof raw === "object" && "subject" in (raw as object)) {
    const o = raw as Record<string, unknown>;
    const k = o.keyElements;
    return {
      subject:
        String(o.subject ?? "").trim() ||
        "A scene grounded in the source article; avoid generic warehouse stock photos.",
      keyElements: Array.isArray(k) ? k.map((x) => String(x)) : [],
      mood: o.mood != null ? String(o.mood) : undefined,
    };
  }
  if (typeof raw === "string" && raw.trim()) {
    return { subject: raw.trim(), keyElements: [] };
  }
  return {
    subject:
      "A specific scene that reflects the source story; not a generic high-tech control room or cold box.",
    keyElements: [],
  };
}

/**
 * Turn structured image plan + theme palette into a single text brief for Gemini image generation.
 */
export function composeImageBrief(
  block: ImagePromptBlock,
  options: { paletteHint?: string; defaultMood?: string }
): string {
  const subject = block.subject.trim() || "Scene grounded in the source context.";
  const elements = (block.keyElements ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const mood =
    (block.mood && block.mood.trim()) ||
    (options.defaultMood && options.defaultMood.trim()) ||
    "";

  const lines: string[] = [`Scene: ${subject}.`];
  if (elements.length) {
    lines.push(`Key elements: ${elements.join(", ")}.`);
  }
  if (mood) {
    lines.push(`Mood: ${mood}.`);
  }
  if (options.paletteHint?.trim()) {
    lines.push(`Palette / lighting: ${options.paletteHint.trim()}.`);
  }
  return lines.join("\n");
}

function getGenAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
}

/** Force verbatim source fields and ensure bodyMd ends with a source citation blockquote. */
function applyOmgSourceFields(
  draft: DraftJson,
  input: { newsTitle: string; newsUrl: string }
): void {
  draft.omg.sourceTitle = input.newsTitle;
  draft.omg.sourceUrl = input.newsUrl;
  const citation = `> Source: [${draft.omg.sourceTitle}](${draft.omg.sourceUrl})`;
  if (!draft.omg.bodyMd.includes(draft.omg.sourceUrl)) {
    draft.omg.bodyMd = `${draft.omg.bodyMd.trimEnd()}\n\n${citation}\n`;
  }
}

/** SELF_PROMO: brand editorial, not a syndicated news article. */
function applySelfPromoSourceFields(draft: DraftJson, template: BrandPromptTemplate): void {
  const url =
    template.id === "omg"
      ? process.env.NEXT_PUBLIC_OMG_SITE_URL ||
        process.env.OMG_PUBLIC_URL ||
        template.selfPromo.fallbackPublicUrl
      : template.selfPromo.fallbackPublicUrl;
  draft.omg.sourceTitle = template.selfPromo.defaultSourceTitle;
  draft.omg.sourceUrl = url;
  if (!draft.omg.bodyMd.includes(template.selfPromo.contentMarker)) {
    draft.omg.bodyMd = `${draft.omg.bodyMd.trimEnd()}\n\n${template.selfPromo.citationLine}\n`;
  }
}

export async function draftWithGemini(
  input: {
    topicName: string;
    brandVoice?: string | null;
    newsTitle: string;
    newsUrl: string;
    newsSnippet: string;
  },
  template: BrandPromptTemplate
): Promise<DraftJson> {
  const prompt = buildTopicNewsDraftPrompt(
    template,
    input,
    IMAGE_PROMPT_JSON_RULES
  );

  const ai = getGenAI();
  const response = await withGeminiRetry("draftWithGemini", () =>
    ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: draftResponseSchema,
      },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Empty Gemini text response for draft");

  const parsed = JSON.parse(text) as DraftJson;
  parsed.imagePrompt = normalizeImagePrompt(parsed.imagePrompt);
  applyOmgSourceFields(parsed, {
    newsTitle: input.newsTitle,
    newsUrl: input.newsUrl,
  });
  return parsed;
}

export async function draftWithGeminiForCampaign(
  input: {
    campaignName: string;
    brandVoice?: string | null;
    newsTitle: string;
    newsUrl: string;
    newsSnippet: string;
    theme: ThemeBundle;
    recentCaptions?: string[];
    recentImagePrompts?: string[];
  },
  template: BrandPromptTemplate
): Promise<DraftJson> {
  const prompt = buildCampaignNewsDraftPrompt(
    template,
    input,
    IMAGE_PROMPT_JSON_RULES
  );

  const ai = getGenAI();
  const response = await withGeminiRetry("draftWithGeminiForCampaign", () =>
    ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: draftResponseSchema,
      },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Empty Gemini text response for campaign draft");

  const parsed = JSON.parse(text) as DraftJson;
  parsed.imagePrompt = normalizeImagePrompt(parsed.imagePrompt);
  applyOmgSourceFields(parsed, {
    newsTitle: input.newsTitle,
    newsUrl: input.newsUrl,
  });
  return parsed;
}

export async function draftWithGeminiForPromoCampaign(
  input: {
    campaignName: string;
    description?: string | null;
    brandVoice?: string | null;
    /** Themes / services to highlight; may be empty (we still use campaign name) */
    highlightKeywords: string;
    theme: ThemeBundle;
    recentCaptions?: string[];
    recentImagePrompts?: string[];
  },
  template: BrandPromptTemplate
): Promise<DraftJson> {
  const prompt = buildCampaignSelfPromoDraftPrompt(
    template,
    input,
    IMAGE_PROMPT_JSON_RULES
  );

  const ai = getGenAI();
  const response = await withGeminiRetry("draftWithGeminiForPromoCampaign", () =>
    ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: draftResponseSchema,
      },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Empty Gemini text response for promo campaign draft");

  const parsed = JSON.parse(text) as DraftJson;
  parsed.imagePrompt = normalizeImagePrompt(parsed.imagePrompt);
  applySelfPromoSourceFields(parsed, template);
  return parsed;
}

/**
 * Retry news search with progressively broader keywords.
 * 1. Original keywords
 * 2. Simplified keywords (first 3 meaningful words)
 * 3. Explicit Gemini grounded search with original keywords
 * 4. Explicit Gemini grounded search with simplified keywords
 */
async function searchNewsWithRetry(
  keywords: string,
  opts?: { num?: number }
): Promise<GoogleNewsResult[]> {
  const RETRY_DELAY_MS = [0, 3_000, 5_000];
  const kw = keywords.trim();
  // Simplify: take first 3 words, strip quotes
  const simplified = kw
    .replace(/["']/g, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  const strategies: { label: string; fn: () => Promise<GoogleNewsResult[]> }[] = [
    { label: "original keywords", fn: () => searchNews(kw, opts) },
  ];
  if (simplified && simplified !== kw) {
    strategies.push({
      label: `simplified ("${simplified}")`,
      fn: () => searchNews(simplified, opts),
    });
  }
  strategies.push({
    label: "Gemini grounded (original)",
    fn: () => searchNewsWithGemini(kw, opts),
  });
  if (simplified && simplified !== kw) {
    strategies.push({
      label: `Gemini grounded ("${simplified}")`,
      fn: () => searchNewsWithGemini(simplified, opts),
    });
  }

  for (let i = 0; i < strategies.length; i++) {
    const { label, fn } = strategies[i];
    const delay = RETRY_DELAY_MS[i] ?? 5_000;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const results = await fn();
      if (results.length > 0) {
        if (i > 0) {
          console.info(
            `[searchNewsWithRetry] Succeeded on attempt ${i + 1}/${strategies.length} (${label}): ${results.length} result(s)`
          );
        }
        return results;
      }
      console.warn(
        `[searchNewsWithRetry] Attempt ${i + 1}/${strategies.length} (${label}): 0 results`
      );
    } catch (err) {
      console.warn(
        `[searchNewsWithRetry] Attempt ${i + 1}/${strategies.length} (${label}) failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  throw new Error(
    `No news results after ${strategies.length} attempts (keywords: "${kw}"). All search strategies exhausted.`
  );
}

export type RunAgentForCampaignOptions = {
  /** When true, only ACTIVE campaigns run. Manual UI uses false. */
  forCron?: boolean;
};

export async function runAgentForCampaign(
  campaignId: string,
  options: RunAgentForCampaignOptions = {}
): Promise<{ postIds: string[] }> {
  const { forCron = false } = options;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (forCron) {
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new Error("Campaign is not active");
    }
  } else {
    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new Error("Campaign is completed");
    }
  }

  const template = await getBrandTemplateOrDefault(campaign.brandTemplateId);
  const theme = await getThemeBundleForBrand(campaign.brandTemplateId, campaign.theme);
  const platformList: Platform[] =
    campaign.platforms.length > 0
      ? (campaign.platforms as Platform[])
      : (["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as Platform[]);

  const selfPromo = campaign.contentMode === CampaignContentMode.SELF_PROMO;
  const BATCH_SPREAD_MINUTES = 5;
  const tz = campaign.timezone || "Asia/Bangkok";
  const publishTimesList = parsePublishTimesJson(campaign.publishTimes);
  let spacingBaseSlot: Date | null = null;
  if (
    campaign.autoApprove &&
    publishTimesList.length === 0 &&
    campaign.publishHourOfDay != null
  ) {
    spacingBaseSlot = nextDailySlot(
      new Date(),
      tz,
      campaign.publishHourOfDay,
      campaign.publishMinuteOfHour ?? 0
    );
  }
  let explicitSearchAnchor = new Date();

  let results: GoogleNewsResult[] = [];
  if (!selfPromo) {
    const kw = campaign.keywords.trim();
    if (!kw) {
      throw new Error("News-driven campaigns require non-empty keywords for search");
    }
    const num = Math.max(5, campaign.postsPerRun);
    results = await searchNewsWithRetry(kw, { num });
  }

  // Fetch last 5 Facebook captions + image prompts to avoid repeating angles/visuals
  const recentVariants = await prisma.postVariant.findMany({
    where: { post: { campaignId: campaign.id }, platform: "FACEBOOK" },
    orderBy: { post: { createdAt: "desc" } },
    take: 5,
    select: { caption: true, media: { select: { prompt: true }, take: 1 } },
  });
  const recentCaptions = recentVariants.map((v) => v.caption).filter(Boolean);
  const recentImagePrompts = recentVariants
    .map((v) => v.media[0]?.prompt)
    .filter((p): p is string => !!p);

  const postIds: string[] = [];

  for (let i = 0; i < campaign.postsPerRun; i++) {
    if (campaign.totalPostsCap != null) {
      const count = await prisma.post.count({ where: { campaignId: campaign.id } });
      if (count >= campaign.totalPostsCap) break;
    }

    let draft: DraftJson;
    let sourceNewsId: string | null = null;

    if (selfPromo) {
      draft = await draftWithGeminiForPromoCampaign(
        {
          campaignName: campaign.name,
          description: campaign.description,
          brandVoice: campaign.brandVoice,
          highlightKeywords: campaign.keywords,
          theme,
          recentCaptions,
          recentImagePrompts,
        },
        template
      );
    } else {
      const top = results[i] ?? results[0];
      if (!top) break;
      const newsRow = await prisma.newsItem.findFirst({ where: { url: top.link } });
      if (!newsRow) {
        throw new Error("NewsItem missing after search");
      }
      sourceNewsId = newsRow.id;
      draft = await draftWithGeminiForCampaign(
        {
          campaignName: campaign.name,
          brandVoice: campaign.brandVoice,
          newsTitle: top.title,
          newsUrl: top.link,
          newsSnippet: top.snippet,
          theme,
          recentCaptions,
          recentImagePrompts,
        },
        template
      );
    }

    const newsForImage: { title: string; snippet?: string } = selfPromo
      ? {
          title: campaign.name,
          snippet:
            [campaign.description, campaign.keywords].filter(Boolean).join(" | ") ||
            undefined,
        }
      : (() => {
          const t = results[i] ?? results[0];
          return { title: t?.title ?? campaign.name, snippet: t?.snippet };
        })();

    const p0 = platformList[0] ?? "FACEBOOK";
    const aspect: AspectKey = platformList.includes("OMG")
      ? "OMG"
      : p0 === "INSTAGRAM"
        ? "INSTAGRAM"
        : p0 === "LINKEDIN"
          ? "LINKEDIN"
          : "FACEBOOK";

    const imageBrief = composeImageBrief(draft.imagePrompt, {
      paletteHint: theme.visualStyleNotes,
    });
    const imageCount = Math.max(1, Math.min(4, campaign.imagesPerPost ?? 1));
    const COMPOSITION_ANGLES = [
      "Wide establishing shot — show the full scene and environment.",
      "Mid-shot — focus on the main subject or key element.",
      "Close-up or detail shot — emphasise texture, emotion, or a specific element.",
      "Alternative angle or fresh perspective on the same subject.",
    ];
    const generatedImages: { url: string; prompt: string }[] = [];
    for (let imgIdx = 0; imgIdx < imageCount; imgIdx++) {
      const variantBrief =
        imageCount > 1
          ? `${imageBrief}\n\nComposition (image ${imgIdx + 1} of ${imageCount}): ${COMPOSITION_ANGLES[imgIdx] ?? COMPOSITION_ANGLES[0]}`
          : imageBrief;
      try {
        const gen = await generateAndUploadImage({
          prompt: variantBrief,
          aspect,
          storageKeyPrefix: `campaign/${campaignId}/shared/${Date.now()}-${i}-${imgIdx}`,
          referenceCategory: theme.referenceCategory,
          newsContext: newsForImage,
        });
        generatedImages.push({ url: gen.imageUrl, prompt: gen.prompt });
      } catch (err) {
        console.error(
          "[agent] campaign image generation failed:",
          err instanceof Error ? err.message : String(err)
        );
        if (imgIdx === 0) generatedImages.push({ url: PLACEHOLDER_PNG, prompt: imageBrief });
      }
    }
    if (generatedImages.length === 0) generatedImages.push({ url: PLACEHOLDER_PNG, prompt: imageBrief });

    const variantData: Record<
      Platform,
      { caption: string; hashtags?: string; title?: string; slug?: string; bodyMd?: string }
    > = {
      FACEBOOK: { caption: draft.facebook.caption },
      INSTAGRAM: {
        caption: draft.instagram.caption,
        hashtags: draft.instagram.hashtags,
      },
      LINKEDIN: { caption: draft.linkedin.caption },
      OMG: {
        caption: draft.omg.summary,
        title: draft.omg.title,
        slug: draft.omg.slug,
        bodyMd: draft.omg.bodyMd,
      },
    };

    const created = await prisma.$transaction(
      async (tx) => {
        const post = await tx.post.create({
          data: {
            status: PostStatus.DRAFTING,
            campaignId: campaign.id,
            sourceNewsId,
          },
        });

        for (const platform of platformList) {
          const v = variantData[platform];
          const pv = await tx.postVariant.create({
            data: {
              postId: post.id,
              platform,
              caption: v.caption,
              hashtags: v.hashtags ?? null,
              title: v.title ?? null,
              slug: v.slug ?? null,
              bodyMd: v.bodyMd ?? null,
            },
          });
          for (const img of generatedImages) {
            await tx.media.create({
              data: {
                variantId: pv.id,
                imageUrl: img.url,
                prompt: img.prompt,
                generatedBy: "gemini",
              },
            });
          }
        }
        return post;
      },
      { timeout: 30_000, maxWait: 10_000 }
    );

    const finalStatus = campaign.autoApprove
      ? PostStatus.SCHEDULED
      : PostStatus.PENDING_APPROVAL;
    let scheduleAt: Date | null = null;
    if (campaign.autoApprove) {
      if (publishTimesList.length > 0) {
        const hm = publishTimesList[i % publishTimesList.length];
        const slot = nextWallClockHmAfter(explicitSearchAnchor, tz, hm);
        if (slot != null) {
          scheduleAt = slot;
          explicitSearchAnchor = addMinutes(slot, 1);
        } else {
          scheduleAt = addMinutes(new Date(), 2 + i * BATCH_SPREAD_MINUTES);
        }
      } else if (campaign.publishHourOfDay != null && spacingBaseSlot != null) {
        const spacing = campaign.publishSpacingMinutes ?? BATCH_SPREAD_MINUTES;
        scheduleAt = addMinutes(spacingBaseSlot, i * spacing);
      } else {
        scheduleAt = addMinutes(new Date(), 2 + i * BATCH_SPREAD_MINUTES);
      }
    }

    await prisma.post.update({
      where: { id: created.id },
      data: {
        status: finalStatus,
        scheduledAt: scheduleAt,
      },
    });

    postIds.push(created.id);
  }

  return { postIds };
}

export async function runAgentForTopic(topicId: string): Promise<{ postId: string }> {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw new Error("Topic not found");
  if (!topic.active) throw new Error("Topic inactive");

  const results = await searchNews(topic.keywords, { num: 5 });
  if (!results.length) throw new Error("No news results returned from search provider");

  const top = results[0];
  const newsRow = await prisma.newsItem.findFirst({
    where: { url: top.link },
  });
  if (!newsRow) throw new Error("NewsItem missing after search");

  const topicTemplate = await getBrandTemplateOrDefault(topic.brandTemplateId);
  const draft = await draftWithGemini(
    {
      topicName: topic.name,
      brandVoice: topic.brandVoice,
      newsTitle: top.title,
      newsUrl: top.link,
      newsSnippet: top.snippet,
    },
    topicTemplate
  );

  const imageBrief = composeImageBrief(draft.imagePrompt, {
    paletteHint: DEFAULT_NEUTRAL_PALETTE,
  });
  let sharedImagePrompt = imageBrief;
  let sharedImageUrl = PLACEHOLDER_PNG;
  try {
    const gen = await generateAndUploadImage({
      prompt: imageBrief,
      aspect: "OMG",
      storageKeyPrefix: `draft/${topicId}/shared`,
      newsContext: { title: top.title, snippet: top.snippet },
    });
    sharedImageUrl = gen.imageUrl;
    sharedImagePrompt = gen.prompt;
  } catch (err) {
    console.error(
      "[agent] image generation failed:",
      err instanceof Error ? err.message : String(err)
    );
  }

  const variantData: Record<
    Platform,
    { caption: string; hashtags?: string; title?: string; slug?: string; bodyMd?: string }
  > = {
    FACEBOOK: { caption: draft.facebook.caption },
    INSTAGRAM: {
      caption: draft.instagram.caption,
      hashtags: draft.instagram.hashtags,
    },
    LINKEDIN: { caption: draft.linkedin.caption },
    OMG: {
      caption: draft.omg.summary,
      title: draft.omg.title,
      slug: draft.omg.slug,
      bodyMd: draft.omg.bodyMd,
    },
  };

  const created = await prisma.$transaction(
    async (tx) => {
      const post = await tx.post.create({
        data: {
          status: PostStatus.DRAFTING,
          topicId: topic.id,
          sourceNewsId: newsRow.id,
        },
      });

      for (const platform of PLATFORMS) {
        const v = variantData[platform];
        const pv = await tx.postVariant.create({
          data: {
            postId: post.id,
            platform,
            caption: v.caption,
            hashtags: v.hashtags ?? null,
            title: v.title ?? null,
            slug: v.slug ?? null,
            bodyMd: v.bodyMd ?? null,
          },
        });
        await tx.media.create({
          data: {
            variantId: pv.id,
            imageUrl: sharedImageUrl,
            prompt: sharedImagePrompt,
            generatedBy: "gemini",
          },
        });
      }

      return post;
    },
    { timeout: 30_000, maxWait: 10_000 }
  );

  await prisma.post.update({
    where: { id: created.id },
    data: { status: PostStatus.PENDING_APPROVAL },
  });

  return { postId: created.id };
}
