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
import { requireEnv } from "@/lib/env";
import { searchNews, type GoogleNewsResult } from "@/lib/news";
import { generateAndUploadImage, type AspectKey } from "@/lib/imagegen/gemini";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { OMG_SERVICES, PROMO_GUIDANCE } from "@/lib/agent/promo-config";
import { getThemeBundle, type ThemeBundle } from "@/lib/agent/themes";

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

/** SELF_PROMO: OMG page is brand editorial, not a syndicated news article. */
function applyOmgSelfPromoSourceFields(draft: DraftJson): void {
  const title = "Original brand content (OMG Experience)";
  const url =
    process.env.NEXT_PUBLIC_OMG_SITE_URL ||
    process.env.OMG_PUBLIC_URL ||
    "https://www.omg.experience";
  draft.omg.sourceTitle = title;
  draft.omg.sourceUrl = url;
  if (!draft.omg.bodyMd.includes("Original brand content — OMG Experience")) {
    const line = `> *Original brand content — OMG Experience.*`;
    draft.omg.bodyMd = `${draft.omg.bodyMd.trimEnd()}\n\n${line}\n`;
  }
}

export async function draftWithGemini(input: {
  topicName: string;
  brandVoice?: string | null;
  newsTitle: string;
  newsUrl: string;
  newsSnippet: string;
}): Promise<DraftJson> {
  const servicesCatalog = OMG_SERVICES.map(
    (s) => `- ${s.name} [${s.tags.join(", ")}]: ${s.pitch}`
  ).join("\n");

  const prompt = `You are a social media strategist for OMG Experience — specialized air freight, pharmaceutical cold chain, time-critical cargo, and AI-powered logistics.

Topic: ${input.topicName}
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}

Source article (for OMG newsroom only — do NOT paraphrase on social):
Title: ${input.newsTitle}
URL: ${input.newsUrl}
Snippet: ${input.newsSnippet}

OMG services catalog (for Facebook / Instagram / LinkedIn promo):
${servicesCatalog}

Promo guidance:
${PROMO_GUIDANCE}

OMG newsroom requirements:
- Write an original news-style article (500-900 words, ## headings, markdown).
- Lead with what happened and why it matters for logistics / supply chain.
- Attribute facts clearly; do not fabricate figures.
- Set JSON fields sourceTitle and sourceUrl to the source article title and URL above verbatim.
- End bodyMd with a final line exactly: > Source: [sourceTitle](sourceUrl) using the same title and URL as above.
- slug must be unique kebab-case.

Social requirements (promo, NOT news rewrite):
- Facebook: ~100-180 words, soft CTA, follow Promo guidance.
- Instagram: caption up to 2200 characters; strong hook; hashtags: 15-25 relevant tags, space-separated, each starting with #
- LinkedIn: short paragraphs, under 2600 characters, thought-leadership framed around OMG capability.

${IMAGE_PROMPT_JSON_RULES}
Ground the image in the article's title and snippet, not a generic "tech logistics" look.`;

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

export async function draftWithGeminiForCampaign(input: {
  campaignName: string;
  brandVoice?: string | null;
  newsTitle: string;
  newsUrl: string;
  newsSnippet: string;
  theme: ThemeBundle;
}): Promise<DraftJson> {
  const servicesCatalog = OMG_SERVICES.map(
    (s) => `- ${s.name} [${s.tags.join(", ")}]: ${s.pitch}`
  ).join("\n");

  const prompt = `You are a social media strategist for OMG Experience — specialized air freight, pharmaceutical cold chain, time-critical cargo, and AI-powered logistics.

CAMPAIGN (theme-driven automation): ${input.campaignName}
Theme: ${input.theme.label}
Theme angle: ${input.theme.angle}
Theme tone: ${input.theme.tone}
Lead the promo narrative around this service (when matching news context): **${input.theme.leadServiceName}** — still use OMG services catalog to stay factual.
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}

Source article (for OMG newsroom only — do NOT paraphrase on social):
Title: ${input.newsTitle}
URL: ${input.newsUrl}
Snippet: ${input.newsSnippet}

OMG services catalog (for Facebook / Instagram / LinkedIn promo):
${servicesCatalog}

Promo guidance:
${PROMO_GUIDANCE}

Theme palette (for final image only — will be added at render time, NOT inside imagePrompt): ${input.theme.visualStyleNotes}

OMG newsroom requirements:
- Write an original news-style article (500-900 words, ## headings, markdown).
- Lead with what happened and why it matters for logistics / supply chain.
- Attribute facts clearly; do not fabricate figures.
- Set JSON fields sourceTitle and sourceUrl to the source article title and URL above verbatim.
- End bodyMd with a final line exactly: > Source: [sourceTitle](sourceUrl) using the same title and URL as above.
- slug must be unique kebab-case.

Social requirements (promo, NOT news rewrite):
- Facebook: ~100-180 words, soft CTA, follow Promo guidance; align with theme tone.
- Instagram: caption up to 2200 characters; strong hook; hashtags: 15-25 relevant tags, space-separated, each starting with #
- LinkedIn: short paragraphs, under 2600 characters, thought-leadership framed around OMG capability and the campaign theme.

${IMAGE_PROMPT_JSON_RULES}
The scene must come from the news article, not the theme name. Theme only influences copy tone; palette is applied at image render time.`;

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

export async function draftWithGeminiForPromoCampaign(input: {
  campaignName: string;
  description?: string | null;
  brandVoice?: string | null;
  /** Themes / services to highlight; may be empty (we still use campaign name) */
  highlightKeywords: string;
  theme: ThemeBundle;
}): Promise<DraftJson> {
  const servicesCatalog = OMG_SERVICES.map(
    (s) => `- ${s.name} [${s.tags.join(", ")}]: ${s.pitch}`
  ).join("\n");

  const focus =
    input.highlightKeywords.trim() ||
    "General OMG value proposition; pick the most relevant OMG services below.";

  const prompt = `You are a social media strategist for OMG Experience — specialized air freight, pharmaceutical cold chain, time-critical cargo, and AI-powered logistics.

CAMPAIGN (SELF-PROMO — no external news required): ${input.campaignName}
${input.description ? `Description: ${input.description}` : ""}
Themes / services to lean into: ${focus}

Theme (visual + voice package): ${input.theme.label}
Theme angle: ${input.theme.angle}
Theme tone: ${input.theme.tone}
Lead the narrative around: **${input.theme.leadServiceName}** when it fits, but you may also tie in other OMG services from the catalog.
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}

This run is PURE **brand and capability promotion** — not based on a specific external article. Do not invent false statistics or fake customer names.

OMG services catalog:
${servicesCatalog}

Promo guidance (social):
${PROMO_GUIDANCE}

Theme palette (for final image only — not duplicated inside the imagePrompt object): ${input.theme.visualStyleNotes}

Social copy:
- Facebook: ~100-180 words, clear value + soft CTA, aligned to theme.
- Instagram: strong hook, hashtags: 15-25, space-separated, each with #
- LinkedIn: short paragraphs, thought leadership, under 2600 characters.

OMG newsroom / site article (self-promo editorial, NOT a syndicated news piece):
- Write an **original editorial** (400-800 words, ## markdown headings) explaining why this capability matters, how OMG approaches it, and a soft CTA. No need to reference a real breaking-news URL.
- Do NOT add a "Source: [external URL]" line for a news site — the article is OMG-originated.
- slug: kebab-case, unique for this piece.

${IMAGE_PROMPT_JSON_RULES}
For SELF-PROMO (no news article), base imagePrompt.subject and keyElements on the campaign name, description, and highlight keywords, plus the most relevant OMG service concepts — still avoid empty clichés like "dashboard" or "cold box" unless the copy truly demands it.`;

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
  applyOmgSelfPromoSourceFields(parsed);
  return parsed;
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

  const theme = getThemeBundle(campaign.theme);
  const platformList: Platform[] =
    campaign.platforms.length > 0
      ? (campaign.platforms as Platform[])
      : (["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as Platform[]);

  const selfPromo = campaign.contentMode === CampaignContentMode.SELF_PROMO;
  const BATCH_SPREAD_MINUTES = 5;

  let results: GoogleNewsResult[] = [];
  if (!selfPromo) {
    const kw = campaign.keywords.trim();
    if (!kw) {
      throw new Error("News-driven campaigns require non-empty keywords for search");
    }
    const num = Math.max(5, campaign.postsPerRun);
    results = await searchNews(kw, { num });
    if (!results.length) {
      throw new Error("No news results returned from search provider");
    }
  }

  const postIds: string[] = [];

  for (let i = 0; i < campaign.postsPerRun; i++) {
    if (campaign.totalPostsCap != null) {
      const count = await prisma.post.count({ where: { campaignId: campaign.id } });
      if (count >= campaign.totalPostsCap) break;
    }

    let draft: DraftJson;
    let sourceNewsId: string | null = null;

    if (selfPromo) {
      draft = await draftWithGeminiForPromoCampaign({
        campaignName: campaign.name,
        description: campaign.description,
        brandVoice: campaign.brandVoice,
        highlightKeywords: campaign.keywords,
        theme,
      });
    } else {
      const top = results[i] ?? results[0];
      if (!top) break;
      const newsRow = await prisma.newsItem.findFirst({ where: { url: top.link } });
      if (!newsRow) {
        throw new Error("NewsItem missing after search");
      }
      sourceNewsId = newsRow.id;
      draft = await draftWithGeminiForCampaign({
        campaignName: campaign.name,
        brandVoice: campaign.brandVoice,
        newsTitle: top.title,
        newsUrl: top.link,
        newsSnippet: top.snippet,
        theme,
      });
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
    let sharedImagePrompt = imageBrief;
    let sharedImageUrl = PLACEHOLDER_PNG;
    try {
      const gen = await generateAndUploadImage({
        prompt: imageBrief,
        aspect,
        storageKeyPrefix: `campaign/${campaignId}/shared/${Date.now()}-${i}`,
        referenceCategory: theme.referenceCategory,
        newsContext: newsForImage,
      });
      sharedImageUrl = gen.imageUrl;
      sharedImagePrompt = gen.prompt;
    } catch (err) {
      console.error(
        "[agent] campaign image generation failed:",
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

    const finalStatus = campaign.autoApprove
      ? PostStatus.SCHEDULED
      : PostStatus.PENDING_APPROVAL;
    const scheduleAt = campaign.autoApprove
      ? addMinutes(new Date(), 2 + i * BATCH_SPREAD_MINUTES)
      : null;

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

  const draft = await draftWithGemini({
    topicName: topic.name,
    brandVoice: topic.brandVoice,
    newsTitle: top.title,
    newsUrl: top.link,
    newsSnippet: top.snippet,
  });

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
