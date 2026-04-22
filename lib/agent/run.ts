/**
 * Gemini-powered social draft runner: structured JSON copy + Gemini image generation.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { Platform, PostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { searchNews } from "@/lib/news";
import { generateAndUploadImage } from "@/lib/imagegen/gemini";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { OMG_SERVICES, PROMO_GUIDANCE } from "@/lib/agent/promo-config";

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
  /** One visual brief for the single shared image reused on all platforms. */
  imagePrompt: string;
};

const imagePromptDescription =
  "Concrete visual brief (2-4 sentences) for ONE hero image shared across Facebook, Instagram, LinkedIn, and OMG. Must fit BOTH the news topic and OMG's promo service angle. Include setting, subjects, lighting, mood. No text/watermarks/logos.";

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
      type: Type.STRING,
      description: imagePromptDescription,
    },
  },
  required: ["facebook", "instagram", "linkedin", "omg", "imagePrompt"],
};

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

Image prompt: ONE concrete visual brief (2-4 sentences) for a hero image that fits BOTH the news topic and OMG's promo angle. Professional logistics photography. No text/watermarks/logos in the image.`;

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
  applyOmgSourceFields(parsed, {
    newsTitle: input.newsTitle,
    newsUrl: input.newsUrl,
  });
  return parsed;
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

  let sharedImagePrompt: string = draft.imagePrompt;
  let sharedImageUrl = PLACEHOLDER_PNG;
  try {
    const gen = await generateAndUploadImage({
      prompt: draft.imagePrompt,
      aspect: "OMG",
      storageKeyPrefix: `draft/${topicId}/shared`,
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
