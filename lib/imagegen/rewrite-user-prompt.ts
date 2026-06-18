import { GoogleGenAI } from "@google/genai";
import type { CampaignTheme } from "@prisma/client";
import type { BrandPromptTemplate } from "@/lib/brands/types";
import { requireEnv } from "@/lib/env";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { withAiLog } from "@/lib/ai-logger";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

/** Unified rewrite output for moodboard and post-image creator directions */
export type ImageRewriteResult = {
  creativeDirection: string;
  exclusions: string[];
  rawPrompt: string;
};

/** @deprecated Use ImageRewriteResult */
export type MoodboardRewriteResult = ImageRewriteResult;

export type MoodboardRewriteCampaignContext = {
  id: string;
  name: string;
  description: string | null;
  keywords: string | null;
  theme: CampaignTheme;
  brandTemplateId: string;
};

export type PostImageRewriteContext = {
  postId: string;
  campaignName: string;
  newsTitle?: string;
  newsSnippet?: string;
  theme?: CampaignTheme | string;
};

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

function parseRewriteJson(text: string): {
  creativeDirection?: unknown;
  exclusions?: unknown;
} | null {
  const raw = stripJsonFence(text);
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      creativeDirection: o.creativeDirection,
      exclusions: o.exclusions,
    };
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
        return {
          creativeDirection: o.creativeDirection,
          exclusions: o.exclusions,
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackRewrite(userPrompt: string): ImageRewriteResult {
  return {
    creativeDirection: userPrompt,
    exclusions: [],
    rawPrompt: userPrompt,
  };
}

export type RewriteImageUserPromptParams =
  | {
      userPrompt: string;
      kind: "moodboard";
      moodboard: {
        campaign: MoodboardRewriteCampaignContext;
        template: BrandPromptTemplate;
      };
    }
  | {
      userPrompt: string;
      kind: "postImage";
      postImage: PostImageRewriteContext;
    };

/**
 * Turn creator directions (often negative: "no human") into positive scene specs
 * plus explicit exclusions. Returns null when userPrompt is empty.
 */
export async function rewriteImageUserPrompt(
  params: RewriteImageUserPromptParams
): Promise<ImageRewriteResult | null> {
  const trimmed = params.userPrompt.trim();
  if (!trimmed) return null;

  let systemPrompt: string;
  let logMeta: Record<string, string | number | undefined>;

  if (params.kind === "moodboard") {
    const { campaign, template } = params.moodboard;
    const themeBundle = template.themeBundles[campaign.theme];
    systemPrompt = `You rewrite creator directions for AI IMAGE GENERATION.

Rules:
1. Image models do NOT understand negatives well. Convert every "no X", "avoid X", "remove X", "don't show X", "ไม่เอา X" into a POSITIVE description of what SHOULD appear instead.
2. Return ONLY valid JSON with exactly these keys: "creativeDirection" (string, one paragraph), "exclusions" (array of short noun phrases to avoid — still list them; they will be wrapped in an EXCLUSIONS block).
3. creativeDirection must stay aligned with the campaign/category context below — no unrelated genres.
4. Keep exclusions concise (max ~12 items).

Examples:
- Input: "no human"
  Output: {"creativeDirection":"Architecture-forward compositions: empty operational interiors, machinery and cargo handling environments, product and texture close-ups, strong geometry and negative space. No figures or silhouettes.","exclusions":["people","human figures","faces","hands","silhouettes","crowds"]}
- Input: "no monks"
  Output: {"creativeDirection":"Contemporary logistics and business environments with neutral professional atmosphere; focus on operations, vehicles, infrastructure, and abstract brand mood.","exclusions":["monks","religious figures","robes","temple imagery"]}

Campaign context:
- Name: ${campaign.name}
- Category: ${template.industryContext}
- Keywords / hook: ${campaign.keywords ?? "(none)"}
- Theme lane: ${themeBundle?.label ?? campaign.theme} (${themeBundle?.tone ?? ""})

Creator direction to rewrite (verbatim):
"""${trimmed.replace(/"""/g, '"')}"""`;
    logMeta = {
      campaignId: campaign.id,
      brandTemplateId: campaign.brandTemplateId,
      promptChars: systemPrompt.length,
      rewriteKind: "moodboard",
    };
  } else {
    const px = params.postImage;
    systemPrompt = `You rewrite creator directions for AI IMAGE GENERATION for a SOCIAL POST hero image.

Rules:
1. Image models do NOT understand negatives well. Convert every "no X", "avoid X", "remove X", "don't show X", "ไม่เอา X" into a POSITIVE description of what SHOULD appear instead.
2. Return ONLY valid JSON: "creativeDirection" (string, one paragraph), "exclusions" (array of short noun phrases).
3. Stay aligned with the post story and campaign below — no unrelated genres.
4. Keep exclusions concise (max ~12 items).

Post / campaign context:
- Campaign: ${px.campaignName}
- Article / hook title: ${px.newsTitle ?? "(none)"}
- Article details: ${px.newsSnippet ?? "(none)"}
- Theme lane hint: ${px.theme ?? "(none)"}

Creator direction to rewrite (verbatim):
"""${trimmed.replace(/"""/g, '"')}"""`;
    logMeta = {
      postId: px.postId,
      promptChars: systemPrompt.length,
      rewriteKind: "postImage",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

    const textOut = await withAiLog(
      "image.rewritePrompt",
      logMeta,
      () =>
        withGeminiRetry(`rewriteImagePrompt:${params.kind}`, () =>
          ai.models.generateContent({
            model: TEXT_MODEL,
            contents: systemPrompt,
            config: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          })
        ),
      (r) => ({
        responseText: r.text ?? "",
        ok: Boolean(r.text?.trim()),
      })
    );

    const rawText = textOut.text?.trim() ?? "";
    if (!rawText) {
      return { ...fallbackRewrite(trimmed), rawPrompt: trimmed };
    }

    const parsed = parseRewriteJson(rawText);
    const cd =
      typeof parsed?.creativeDirection === "string"
        ? parsed.creativeDirection.trim()
        : "";
    let exclusions: string[] = [];
    if (Array.isArray(parsed?.exclusions)) {
      exclusions = parsed.exclusions
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 16);
    }

    if (!cd) {
      return { ...fallbackRewrite(trimmed), rawPrompt: trimmed };
    }

    return {
      creativeDirection: cd,
      exclusions,
      rawPrompt: trimmed,
    };
  } catch (e) {
    console.warn("[image.rewritePrompt] failed, using fallback:", e);
    return { ...fallbackRewrite(trimmed), rawPrompt: trimmed };
  }
}

/** Alias for moodboard API — same as rewriteImageUserPrompt({ kind: "moodboard", ... }) */
export async function rewriteMoodboardUserPrompt(params: {
  userPrompt: string;
  campaign: MoodboardRewriteCampaignContext;
  template: BrandPromptTemplate;
}): Promise<ImageRewriteResult | null> {
  return rewriteImageUserPrompt({
    userPrompt: params.userPrompt,
    kind: "moodboard",
    moodboard: { campaign: params.campaign, template: params.template },
  });
}

export function buildCreatorDirectionBlock(rewrite: ImageRewriteResult): string {
  const exclusionsLine =
    rewrite.exclusions.length > 0
      ? rewrite.exclusions.join(", ")
      : "(none specified)";

  return `[CREATOR DIRECTION — HIGHEST PRIORITY — OVERRIDES EVERYTHING ABOVE]
${rewrite.creativeDirection}

[EXCLUSIONS — DO NOT INCLUDE ANY OF THESE]
${exclusionsLine}
If any earlier instruction implies any of the above (including suggested "human presence", "people", or similar), ignore that instruction when it conflicts with CREATOR DIRECTION above.`;
}

/** @deprecated Use buildCreatorDirectionBlock */
export const buildMoodboardCreatorBlock = buildCreatorDirectionBlock;
