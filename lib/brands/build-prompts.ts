import type { BrandPromptTemplate } from "./types";
import type { ThemeBundle } from "./types";

/** Extra LLM instructions when brandAssets.referenceImages are configured (passed to image gen). */
function brandReferenceImagesInstruction(enabled?: boolean): string {
  if (!enabled) return "";
  return `\nFINAL IMAGE — BRAND REFERENCE PHOTOS (this brand has uploaded reference images):\nThe renderer passes those photographs into the image model as the PRIMARY visual anchor. Your JSON imagePrompt MUST describe a scene consistent with that same world — palette tendency, lighting quality, photographic style, and subject treatment.\nDo NOT invent readable text, logos, watermarks, signage, or branded objects not implied by those references.\nCopy may reference news or places; the IMAGE must still obey the brand reference photos.\n`;
}

function servicesCatalogLines(t: BrandPromptTemplate): string {
  return t.services.map((s) => `- ${s.name} [${s.tags.join(", ")}]: ${s.pitch}`).join("\n");
}

/** Injects the campaign/topic keyword cluster into news-driven draft prompts. */
function buildPrimarySeoKeywordBlock(targetKeywords?: string | null): string {
  const kw = targetKeywords?.trim();
  if (!kw) return "";
  return `
PRIMARY SEO KEYWORD (MANDATORY — frame the entire article around this phrase cluster):
"${kw}"

SEO framing rules (use the source article as the news angle, but optimise on-page SEO for this keyword):
- title: front-load this keyword or its core terms within the first ~40 characters
- slug: semantic kebab-case containing the primary terms from this keyword (3-6 words, no random suffix)
- metaDescription: the first sentence MUST include this keyword
- bodyMd: at least one ## H2 heading MUST include this keyword or its core terms
- Do NOT invent facts beyond the source article; reframe the story's relevance through this keyword lens
`;
}

/** Topical-authority internal linking rules for newsroom articles. */
function buildInternalLinkingBlock(t: BrandPromptTemplate): string {
  const moneyPage = t.mandatoryCtaUrl;
  const clusterHint =
    t.focusKeywords && t.focusKeywords.length > 0
      ? `When relevant, naturally reference one sibling topic from this cluster (use descriptive anchor text): ${t.focusKeywords.slice(0, 6).join("; ")}`
      : "Where relevant, cross-reference related service capabilities on the same site.";
  return `
TOPICAL AUTHORITY / INTERNAL LINKING (newsroom article):
- Include at least one markdown link to the money page: [${t.orgDisplayName}](${moneyPage})
- ${clusterHint}
- Place internal links in bodyMd (not only in social captions) to strengthen topical authority around the keyword cluster.
`;
}

export function buildTopicNewsDraftPrompt(
  t: BrandPromptTemplate,
  input: {
    topicName: string;
    brandVoice?: string | null;
    /** English search query / keyword cluster — injected as PRIMARY SEO KEYWORD */
    targetKeywords?: string | null;
    newsTitle: string;
    newsUrl: string;
    newsSnippet: string;
    /** True when brand master has referenceImages — image gen anchors on those photos */
    brandHasReferenceImages?: boolean;
  },
  imagePromptJsonRules: string
): string {
  const catalog = servicesCatalogLines(t);
  const seoBlock = buildPrimarySeoKeywordBlock(input.targetKeywords);
  const linkingBlock = buildInternalLinkingBlock(t);
  return `${t.strategistTagline}

Topic: ${input.topicName}
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}
${seoBlock}
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
- Open the article with a 1-2 sentence direct answer to the core question before any heading (optimised for AI/LLM extraction and featured snippets).
- Heading hierarchy: the page title is the H1; inside bodyMd use ## (H2) for main sections and ### (H3) for subsections only — never a single # H1, never skip levels.
- Use bullet/numbered lists for steps or criteria, and include at least one markdown comparison table when comparing options, tools, or approaches.
- Write a meta description (150-160 chars, PRIMARY SEO KEYWORD first) in the metaDescription field.
- Lead with what happened and why it matters for ${t.industryContext}.
- Attribute facts clearly; do not fabricate figures.
- Set JSON fields sourceTitle and sourceUrl to the source article title and URL above verbatim.
- End bodyMd with a final line exactly: > Source: [sourceTitle](sourceUrl) using the same title and URL as above.
${linkingBlock}
Social requirements (promo, NOT news rewrite):
- Facebook: ~100-180 words, soft CTA, follow Promo guidance.
- Instagram: caption up to 2200 characters; strong hook; hashtags: 15-25 relevant tags, space-separated, each starting with #
- LinkedIn: short paragraphs, under 2600 characters, thought-leadership framed around ${t.orgShort} capability.
- Mandatory CTA: At the very end of EVERY social media caption (Facebook, Instagram, LinkedIn), you MUST append this exact URL: ${t.mandatoryCtaUrl}

${brandReferenceImagesInstruction(input.brandHasReferenceImages)}${imagePromptJsonRules}
Ground the image in the article's title and snippet, not a generic "tech logistics" look.`;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  th: "Thai (ภาษาไทย)",
};

function buildPlatformStrategyBlock(ps: Record<string, string> | null | undefined): string {
  if (!ps) return "";
  const lines = [
    ps.FACEBOOK?.trim() ? `• Facebook: ${ps.FACEBOOK.trim()}` : "",
    ps.INSTAGRAM?.trim() ? `• Instagram: ${ps.INSTAGRAM.trim()}` : "",
    ps.LINKEDIN?.trim() ? `• LinkedIn: ${ps.LINKEDIN.trim()}` : "",
    ps.OMG?.trim() ? `• OMG article: ${ps.OMG.trim()}` : "",
  ].filter(Boolean);
  if (!lines.length) return "";
  return `\nPLATFORM STRATEGY (apply per platform — override defaults where specified):\n${lines.join("\n")}\n`;
}

function languageInstruction(contentLanguage: string): string {
  if (contentLanguage === "en" || !contentLanguage) return "";
  const label = LANGUAGE_LABELS[contentLanguage] ?? contentLanguage;
  return `\nOUTPUT LANGUAGE: Write ALL captions, article body (bodyMd), and headlines in ${label}. Keep brand names, URLs, and hashtags in Latin/English script.\n`;
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
    contentLanguage?: string;
    campaignGoal?: string | null;
    targetPersona?: string | null;
    contentPillars?: string | null;
    /** The single pillar assigned to this specific post (pre-rotated by the agent). */
    activePillar?: string | null;
    platformStrategies?: Record<string, string> | null;
    /** Human-written or AI-generated editorial brief for this specific post slot. */
    editorialBrief?: string | null;
    /** English search query / keyword cluster — injected as PRIMARY SEO KEYWORD */
    targetKeywords?: string | null;
    /** True when brand master has referenceImages — multimodal image gen anchors on those photos */
    brandHasReferenceImages?: boolean;
  },
  imagePromptJsonRules: string
): string {
  const catalog = servicesCatalogLines(t);
  const seoBlock = buildPrimarySeoKeywordBlock(input.targetKeywords);
  const linkingBlock = buildInternalLinkingBlock(t);
  const pillarLine = input.activePillar
    ? `Content pillar for THIS post: ${input.activePillar} — write all captions through this lens. Other pillars exist in the campaign but are not for this post.`
    : input.contentPillars
      ? `Content pillars (choose one that fits best): ${input.contentPillars}`
      : "";
  const strategyBlock = [
    input.campaignGoal ? `Campaign goal: ${input.campaignGoal}` : "",
    input.targetPersona ? `Target persona: ${input.targetPersona}` : "",
    pillarLine,
  ].filter(Boolean).join("\n");
  const briefBlock = input.editorialBrief?.trim()
    ? `\nEDITORIAL BRIEF FOR THIS POST (follow this direction closely):\n${input.editorialBrief.trim()}\n`
    : "";
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
  const langBlock = languageInstruction(input.contentLanguage ?? "en");
  const platformBlock = buildPlatformStrategyBlock(input.platformStrategies);
  return `${t.strategistTagline}

CAMPAIGN (theme-driven automation): ${input.campaignName}
Theme: ${input.theme.label}
Theme angle: ${input.theme.angle}
Theme tone: ${input.theme.tone}
Lead the promo narrative around this service (when matching news context): **${input.theme.leadServiceName}** — still use ${t.orgShort} services catalog to stay factual.
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}
${strategyBlock ? `\n${strategyBlock}\n` : ""}${briefBlock}${platformBlock}${langBlock}${diversityBlock}${seoBlock}
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
- Open the article with a 1-2 sentence direct answer to the core question before any heading (optimised for AI/LLM extraction and featured snippets).
- Heading hierarchy: the page title is the H1; inside bodyMd use ## (H2) for main sections and ### (H3) for subsections only — never a single # H1, never skip levels.
- Use bullet/numbered lists for steps or criteria, and include at least one markdown comparison table when comparing options, tools, or approaches.
- Write a meta description (150-160 chars, PRIMARY SEO KEYWORD first) in the metaDescription field.
- Lead with what happened and why it matters for ${t.industryContext}.
- Attribute facts clearly; do not fabricate figures.
- Set JSON fields sourceTitle and sourceUrl to the source article title and URL above verbatim.
- End bodyMd with a final line exactly: > Source: [sourceTitle](sourceUrl) using the same title and URL as above.
${linkingBlock}
Social requirements (promo, NOT news rewrite):
- Facebook: ~100-180 words, soft CTA, follow Promo guidance; align with theme tone.
- Instagram: caption up to 2200 characters, strong hook; hashtags: 15-25 relevant tags, space-separated, each starting with #
- LinkedIn: short paragraphs, under 2600 characters, thought-leadership framed around ${t.orgShort} capability and the campaign theme.
- Mandatory CTA: At the very end of EVERY social media caption (Facebook, Instagram, LinkedIn), you MUST append this exact URL: ${t.mandatoryCtaUrl}

${brandReferenceImagesInstruction(input.brandHasReferenceImages)}${imagePromptJsonRules}
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
    contentLanguage?: string;
    campaignGoal?: string | null;
    targetPersona?: string | null;
    contentPillars?: string | null;
    /** The single pillar assigned to this specific post (pre-rotated by the agent). */
    activePillar?: string | null;
    platformStrategies?: Record<string, string> | null;
    /** Human-written or AI-generated editorial brief for this specific post slot. */
    editorialBrief?: string | null;
    /** True when brand master has referenceImages */
    brandHasReferenceImages?: boolean;
  },
  imagePromptJsonRules: string
): string {
  const catalog = servicesCatalogLines(t);
  const focus =
    input.highlightKeywords.trim() || t.selfPromoGeneralValueProposition;
  const pillarLine = input.activePillar
    ? `Content pillar for THIS post: ${input.activePillar} — write all captions through this lens. Other pillars exist in the campaign but are not for this post.`
    : input.contentPillars
      ? `Content pillars (choose one that fits best): ${input.contentPillars}`
      : "";
  const strategyBlock = [
    input.campaignGoal ? `Campaign goal: ${input.campaignGoal}` : "",
    input.targetPersona ? `Target persona: ${input.targetPersona}` : "",
    pillarLine,
  ].filter(Boolean).join("\n");
  const briefBlock = input.editorialBrief?.trim()
    ? `\nEDITORIAL BRIEF FOR THIS POST (follow this direction closely):\n${input.editorialBrief.trim()}\n`
    : "";
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
  const langBlock = languageInstruction(input.contentLanguage ?? "en");
  const platformBlock = buildPlatformStrategyBlock(input.platformStrategies);

  return `${t.strategistTagline}

CAMPAIGN (SELF-PROMO — no external news required): ${input.campaignName}
${input.description ? `Description: ${input.description}` : ""}
Themes / services to lean into: ${focus}

Theme (visual + voice package): ${input.theme.label}
Theme angle: ${input.theme.angle}
Theme tone: ${input.theme.tone}
Lead the narrative around: **${input.theme.leadServiceName}** when it fits, but you may also tie in other ${t.orgShort} services from the catalog.
Brand voice: ${input.brandVoice ?? "Professional, compliance-aware, trustworthy, concise."}
${strategyBlock ? `\n${strategyBlock}\n` : ""}${briefBlock}${platformBlock}${langBlock}${diversityBlock}

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

${brandReferenceImagesInstruction(input.brandHasReferenceImages)}${imagePromptJsonRules}
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
