import type { BrandPromptTemplate } from "./types";
import type { ThemeBundle } from "./types";

function servicesCatalogLines(t: BrandPromptTemplate): string {
  return t.services.map((s) => `- ${s.name} [${s.tags.join(", ")}]: ${s.pitch}`).join("\n");
}

export function buildTopicNewsDraftPrompt(
  t: BrandPromptTemplate,
  input: {
    topicName: string;
    brandVoice?: string | null;
    newsTitle: string;
    newsUrl: string;
    newsSnippet: string;
  },
  imagePromptJsonRules: string
): string {
  const catalog = servicesCatalogLines(t);
  return `${t.strategistTagline}

Topic: ${input.topicName}
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}

Source article (${t.sourceArticleSiteLabel} — do NOT paraphrase on social):
Title: ${input.newsTitle}
URL: ${input.newsUrl}
Snippet: ${input.newsSnippet}

${t.servicesCatalogHeading}
${catalog}

Promo guidance:
${t.promoGuidance}

${t.newsroomRequirementsHeading}
- Write an original news-style article (500-900 words, ## headings, markdown).
- Lead with what happened and why it matters for ${t.industryContext}.
- Attribute facts clearly; do not fabricate figures.
- Set JSON fields sourceTitle and sourceUrl to the source article title and URL above verbatim.
- End bodyMd with a final line exactly: > Source: [sourceTitle](sourceUrl) using the same title and URL as above.
- slug must be unique kebab-case.

Social requirements (promo, NOT news rewrite):
- Facebook: ~100-180 words, soft CTA, follow Promo guidance.
- Instagram: caption up to 2200 characters; strong hook; hashtags: 15-25 relevant tags, space-separated, each starting with #
- LinkedIn: short paragraphs, under 2600 characters, thought-leadership framed around ${t.orgShort} capability.
- Mandatory CTA: At the very end of EVERY social media caption (Facebook, Instagram, LinkedIn), you MUST append this exact URL: ${t.mandatoryCtaUrl}

${imagePromptJsonRules}
Ground the image in the article's title and snippet, not a generic "tech logistics" look.`;
}

export function buildCampaignNewsDraftPrompt(
  t: BrandPromptTemplate,
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
  imagePromptJsonRules: string
): string {
  const catalog = servicesCatalogLines(t);
  const captionLines =
    input.recentCaptions && input.recentCaptions.length > 0
      ? `Recent captions (avoid repeating these hooks/angles):\n${input.recentCaptions.map((c, i) => `${i + 1}. ${c.slice(0, 250)}`).join("\n")}`
      : "";
  const imageLines =
    input.recentImagePrompts && input.recentImagePrompts.length > 0
      ? `Recent image subjects (already used — pick a COMPLETELY DIFFERENT scene, subject, and environment):\n${input.recentImagePrompts.map((p, i) => `${i + 1}. ${p.slice(0, 200)}`).join("\n")}`
      : "";
  const diversityBlock =
    captionLines || imageLines
      ? `\nCONTENT DIVERSITY REQUIREMENT — do NOT repeat any of the following:\n${captionLines}${captionLines && imageLines ? "\n" : ""}${imageLines}\n`
      : "";
  return `${t.strategistTagline}

CAMPAIGN (theme-driven automation): ${input.campaignName}
Theme: ${input.theme.label}
Theme angle: ${input.theme.angle}
Theme tone: ${input.theme.tone}
Lead the promo narrative around this service (when matching news context): **${input.theme.leadServiceName}** — still use ${t.orgShort} services catalog to stay factual.
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}
${diversityBlock}
Source article (${t.sourceArticleSiteLabel} — do NOT paraphrase on social):
Title: ${input.newsTitle}
URL: ${input.newsUrl}
Snippet: ${input.newsSnippet}

${t.servicesCatalogHeading}
${catalog}

Promo guidance:
${t.promoGuidance}

Theme palette (for final image only — will be added at render time, NOT inside imagePrompt): ${input.theme.visualStyleNotes}

${t.newsroomRequirementsHeading}
- Write an original news-style article (500-900 words, ## headings, markdown).
- Lead with what happened and why it matters for ${t.industryContext}.
- Attribute facts clearly; do not fabricate figures.
- Set JSON fields sourceTitle and sourceUrl to the source article title and URL above verbatim.
- End bodyMd with a final line exactly: > Source: [sourceTitle](sourceUrl) using the same title and URL as above.
- slug must be unique kebab-case.

Social requirements (promo, NOT news rewrite):
- Facebook: ~100-180 words, soft CTA, follow Promo guidance; align with theme tone.
- Instagram: caption up to 2200 characters, strong hook; hashtags: 15-25 relevant tags, space-separated, each starting with #
- LinkedIn: short paragraphs, under 2600 characters, thought-leadership framed around ${t.orgShort} capability and the campaign theme.
- Mandatory CTA: At the very end of EVERY social media caption (Facebook, Instagram, LinkedIn), you MUST append this exact URL: ${t.mandatoryCtaUrl}

${imagePromptJsonRules}
The scene must come from the news article, not the theme name. Theme only influences copy tone; palette is applied at image render time.`;
}

export function buildCampaignSelfPromoDraftPrompt(
  t: BrandPromptTemplate,
  input: {
    campaignName: string;
    description?: string | null;
    brandVoice?: string | null;
    highlightKeywords: string;
    theme: ThemeBundle;
    recentCaptions?: string[];
    recentImagePrompts?: string[];
  },
  imagePromptJsonRules: string
): string {
  const catalog = servicesCatalogLines(t);
  const focus =
    input.highlightKeywords.trim() || t.selfPromoGeneralValueProposition;
  const captionLines =
    input.recentCaptions && input.recentCaptions.length > 0
      ? `Recent captions (avoid repeating these hooks/angles):\n${input.recentCaptions.map((c, i) => `${i + 1}. ${c.slice(0, 250)}`).join("\n")}`
      : "";
  const imageLines =
    input.recentImagePrompts && input.recentImagePrompts.length > 0
      ? `Recent image subjects (already used — pick a COMPLETELY DIFFERENT scene, subject, and environment):\n${input.recentImagePrompts.map((p, i) => `${i + 1}. ${p.slice(0, 200)}`).join("\n")}`
      : "";
  const diversityBlock =
    captionLines || imageLines
      ? `\nCONTENT DIVERSITY REQUIREMENT — do NOT repeat any of the following:\n${captionLines}${captionLines && imageLines ? "\n" : ""}${imageLines}\n`
      : "";

  return `${t.strategistTagline}

CAMPAIGN (SELF-PROMO — no external news required): ${input.campaignName}
${input.description ? `Description: ${input.description}` : ""}
Themes / services to lean into: ${focus}

Theme (visual + voice package): ${input.theme.label}
Theme angle: ${input.theme.angle}
Theme tone: ${input.theme.tone}
Lead the narrative around: **${input.theme.leadServiceName}** when it fits, but you may also tie in other ${t.orgShort} services from the catalog.
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}
${diversityBlock}

This run is PURE **brand and capability promotion** — not based on a specific external article. Do not invent false statistics or fake customer names.

${t.orgDisplayName} services catalog:
${catalog}

Promo guidance (social):
${t.promoGuidance}

Theme palette (for final image only — not duplicated inside the imagePrompt object): ${input.theme.visualStyleNotes}

Social copy:
- Facebook: ~100-180 words, clear value + soft CTA, aligned to theme.
- Instagram: strong hook, hashtags: 15-25, space-separated, each with #
- LinkedIn: short paragraphs, thought leadership, under 2600 characters.
- Mandatory CTA: At the very end of EVERY social media caption (Facebook, Instagram, LinkedIn), you MUST append this exact URL: ${t.mandatoryCtaUrl}

${t.selfPromoEditorialNoExternalSource}

${imagePromptJsonRules}
For SELF-PROMO (no news article), base imagePrompt.subject and keyElements on the campaign name, description, and highlight keywords, plus the most relevant ${t.orgShort} service concepts — still avoid empty clichés like "dashboard" or "cold box" unless the copy truly demands it.`;
}

export function buildSuggestCampaignPrompt(
  t: BrandPromptTemplate,
  hint: string,
  lanes: string,
  serviceDisallowList: string,
  brainstormSeeds: string
): string {
  const hasHint = Boolean(hint);
  const forbidden = t.suggestCampaign.forbiddenNameSubstrings.join(", ");

  return `${t.suggestCampaign.plannerRoleLine}
${t.suggestCampaign.plannerBrief}

## User request (HIGHEST PRIORITY)
${
  hasHint
    ? `The user asked for: "${hint}"
You MUST make ALL 3 campaign ideas directly serve this request. Do not substitute unrelated examples (e.g. if they asked for air-freight news, do not pivot the first idea to generic pharma/cold chain unless the user hint explicitly says pharma/cold chain).
Every "rationale" must explicitly reference the user's request in plain language.`
    : `The user did not add a custom hint — suggest 3 industry-relevant campaigns with diverse angles.`
}

## How to use the 3 creative lanes
These lanes are NOT preset slots. They only tag **image style + reference art direction** for our generator. Pick the best lane *after* you invent a fresh concept:
${lanes}
- You MAY assign the same lane to 2-3 ideas if the user hint is narrow and all ideas would share one visual feel.
- Do NOT name campaigns after a lane's lead service, label, or enum string.

## Forbidden in campaign "name" (and avoid in themePitch)
- Do not copy ${t.suggestCampaign.orgShort}'s fixed service line names: ${serviceDisallowList}
- Do not use these generic phrases as the whole name: ${forbidden}
- Names should sound like a campaign or series title, not a product SKU.

## contentMode
- NEWS_DRIVEN: each run finds real industry news then promotes ${t.suggestCampaign.orgShort}. "keywords" = tight English search query for that angle.
- SELF_PROMO: no required news; pure brand storytelling, case-style, or capability promo. "keywords" can list services/themes in English, or a short free-text guide.

## Variety (apply all that fit)
- Across the 3 ideas, vary: cadence, dayOfWeek+hour, contentMode, and creative format (per brainstorm list below at least 2 different formats).
- At least 2 of the 3 ideas must differ in **two or more of**: contentMode, cadence, and theme.
${brainstormSeeds}

## Scheduling
- dayOfWeek/hourOfDay: Asia/Bangkok business sense. Prefer Tue–Thu 08:00–10:00 or 15:00–17:00 unless the user hint says otherwise.
- postsPerRun: 1-2 usually; 3 only for very fast news cycles.
- autoApprove: almost always false unless the user hint explicitly wants full auto-queue.

Output exactly 3 items in "campaigns". JSON only, schema-enforced.`;
}
