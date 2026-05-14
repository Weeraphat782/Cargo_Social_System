import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from "@google/genai";
import type { CampaignContentMode, CampaignTheme, Platform, Prisma } from "@prisma/client";
import type { BrandPromptTemplate } from "@/lib/brands/types";
import { resolveCampaignImageRefs } from "@/lib/brands/campaign-image-refs";

const MAX_BRIEF_REFERENCE_IMAGES = 4;

export type PlannerCampaignContext = {
  name: string;
  keywords: string;
  contentMode: CampaignContentMode;
  contentLanguage: string;
  campaignGoal: string | null;
  targetPersona: string | null;
  contentPillars: string | null;
  theme: CampaignTheme;
  brandTemplateId: string;
  brandVoice: string | null;
  description: string | null;
  platforms: Platform[];
  platformStrategies: Prisma.JsonValue | null;
  moodboardImages: Prisma.JsonValue | null;
};

export type PlannerSlotContext = {
  scheduledFor: string;
  pillar: string | null;
  keywordHint: string | null;
};

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function buildPlatformStrategyBlock(
  raw: Prisma.JsonValue | null,
  platforms: Platform[]
): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const obj = raw as Record<string, unknown>;
  const lines: string[] = [];
  for (const p of platforms) {
    const v = safeString(obj[p]);
    if (v) lines.push(`- ${p}: ${v}`);
  }
  if (!lines.length) return "";
  return `Per-platform tone guidance (the post will run on these channels):\n${lines.join("\n")}`;
}

function buildPillarsBlock(
  campaignPillars: string | null,
  slotPillar: string | null
): string {
  const list = (campaignPillars ?? "")
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (slotPillar?.trim()) {
    if (list.length) {
      return `Content pillar (THIS post): ${slotPillar.trim()}\nFull pillar rotation for this campaign: ${list.join(", ")}`;
    }
    return `Content pillar (THIS post): ${slotPillar.trim()}`;
  }
  if (list.length) {
    return `Pillar rotation for this campaign (pick one that fits the date/keywords naturally): ${list.join(", ")}`;
  }
  return "";
}

function buildThemeBundleBlock(
  template: BrandPromptTemplate,
  theme: CampaignTheme
): string {
  const bundle = template.themeBundles[theme];
  if (!bundle) return `Theme lane: ${theme.replace(/_/g, " ").toLowerCase()}`;
  const lines = [
    `Theme lane (${theme}) — brand interpretation:`,
    `- Label: ${bundle.label}`,
    `- Tone: ${bundle.tone}`,
    `- Angle: ${bundle.angle}`,
    `- Lead service to anchor: ${bundle.leadServiceName}`,
  ];
  if (bundle.visualStyleNotes?.trim()) {
    lines.push(`- Visual style notes (for matching imagery later): ${bundle.visualStyleNotes.trim()}`);
  }
  return lines.join("\n");
}

function buildBrandBlock(template: BrandPromptTemplate): string {
  const lines: string[] = [];
  if (template.strategistTagline?.trim()) {
    lines.push(template.strategistTagline.trim());
  }
  if (template.suggestCampaign?.plannerRoleLine?.trim()) {
    lines.push(template.suggestCampaign.plannerRoleLine.trim());
  }
  if (template.suggestCampaign?.plannerBrief?.trim()) {
    lines.push(`Brand context: ${template.suggestCampaign.plannerBrief.trim()}`);
  }
  if (template.promoGuidance?.trim()) {
    lines.push(`Brand promo & editorial rules:\n${template.promoGuidance.trim()}`);
  }
  return lines.join("\n\n");
}

function buildCampaignBlock(
  campaign: PlannerCampaignContext,
  keywordHint: string
): string {
  const lines: string[] = [];
  lines.push(`Campaign: "${campaign.name}"`);
  lines.push(
    `Content mode: ${
      campaign.contentMode === "NEWS_DRIVEN"
        ? "News-driven (a real news article matching the keywords will be picked at publish time)"
        : "Self-promo (brand storytelling, no external news required)"
    }`
  );
  lines.push(`Keywords / focus: ${keywordHint}`);
  if (campaign.campaignGoal?.trim()) lines.push(`Campaign goal: ${campaign.campaignGoal.trim()}`);
  if (campaign.targetPersona?.trim()) lines.push(`Target audience: ${campaign.targetPersona.trim()}`);
  if (campaign.brandVoice?.trim()) lines.push(`Campaign-specific brand voice: ${campaign.brandVoice.trim()}`);
  if (campaign.description?.trim()) lines.push(`Internal description: ${campaign.description.trim()}`);
  return lines.join("\n");
}

async function fetchRemoteImage(
  url: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    const ab = await res.arrayBuffer();
    return { data: Buffer.from(ab), mimeType };
  } catch {
    return null;
  }
}

export type BriefPromptResult = {
  prompt: string;
  /** Resolved image refs (brand first, moodboard last) — capped at MAX_BRIEF_REFERENCE_IMAGES */
  images: { data: Buffer; mimeType: string; role: "brand" | "moodboard" }[];
};

/**
 * Build a planner-brief prompt and (optionally) fetch moodboard + brand reference images
 * so Gemini can ground the editorial brief in the brand's actual visual world.
 */
export async function buildBriefPrompt(opts: {
  template: BrandPromptTemplate;
  campaign: PlannerCampaignContext;
  slot: PlannerSlotContext;
  includeImages: boolean;
}): Promise<BriefPromptResult> {
  const { template, campaign, slot } = opts;

  const scheduledDate = slot.scheduledFor
    ? new Date(slot.scheduledFor).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "the scheduled date";

  const keywordHint = slot.keywordHint?.trim() || campaign.keywords;

  const brandBlock = buildBrandBlock(template);
  const themeBlock = buildThemeBundleBlock(template, campaign.theme);
  const campaignBlock = buildCampaignBlock(campaign, keywordHint);
  const pillarsBlock = buildPillarsBlock(campaign.contentPillars, slot.pillar);
  const platformBlock = buildPlatformStrategyBlock(
    campaign.platformStrategies,
    campaign.platforms
  );

  // Fetch reference images (best effort — never throw)
  let images: BriefPromptResult["images"] = [];
  if (opts.includeImages) {
    const refs = await resolveCampaignImageRefs({
      moodboardImages: campaign.moodboardImages,
      brandTemplateId: campaign.brandTemplateId,
    });
    const brandUrls = (refs.brandReferenceUrls ?? []).slice(0, 3);
    const brandFetched = (
      await Promise.all(brandUrls.map((u) => fetchRemoteImage(u)))
    )
      .filter((r): r is { data: Buffer; mimeType: string } => r !== null)
      .map((r) => ({ ...r, role: "brand" as const }));

    const moodboardFetched = refs.moodboardReferenceUrl
      ? await fetchRemoteImage(refs.moodboardReferenceUrl)
      : null;

    images = [
      ...brandFetched,
      ...(moodboardFetched
        ? [{ ...moodboardFetched, role: "moodboard" as const }]
        : []),
    ].slice(0, MAX_BRIEF_REFERENCE_IMAGES);
  }

  const hasBrand = images.some((i) => i.role === "brand");
  const hasMoodboard = images.some((i) => i.role === "moodboard");

  const visualBlock: string[] = [];
  if (hasBrand) {
    visualBlock.push(
      "ATTACHED IMAGES — brand reference photographs (first parts): they show the brand's actual look-and-feel. Anchor your brief to a scene/topic that visually fits this world. Do NOT invent visual settings that contradict these photos."
    );
  }
  if (hasMoodboard) {
    visualBlock.push(
      `ATTACHED IMAGES — campaign moodboard (${hasBrand ? "after the brand block" : "first part"}): treat this as the campaign's color/mood direction. The brief's topic angle and any visual hints should fit this mood.`
    );
  }

  const briefRules = [
    "Generate a SHORT 2-3 sentence editorial brief for ONE social media post.",
    "The brief MUST describe:",
    "  1. The specific angle / topic for THIS post (concrete, not generic).",
    `  2. How it serves the content pillar${slot.pillar ? ` (${slot.pillar})` : ""} and brand theme above.`,
    "  3. What the reader should feel or do after reading.",
    "Hard rules:",
    "  - Stay inside the brand promo & editorial rules above.",
    "  - Reflect the theme lane's tone and angle.",
    "  - If reference images are attached, the brief's scene/topic must visually fit them.",
    "  - Avoid generic marketing language and avoid forbidden phrases the brand rules call out.",
    "  - Do NOT include hashtags, links, or platform-specific copy — this is an EDITORIAL BRIEF, not the post body.",
    campaign.contentLanguage === "th"
      ? "  - Write the brief in Thai (ภาษาไทย)."
      : "  - Write the brief in English.",
    "Output ONLY the brief text. No labels, no markdown, no quotes.",
  ];

  const sections: string[] = [];
  if (brandBlock) sections.push(brandBlock);
  sections.push(`Slot date: ${scheduledDate}`);
  sections.push(themeBlock);
  sections.push(campaignBlock);
  if (pillarsBlock) sections.push(pillarsBlock);
  if (platformBlock) sections.push(platformBlock);
  if (visualBlock.length) sections.push(visualBlock.join("\n"));
  sections.push(briefRules.join("\n"));

  return { prompt: sections.join("\n\n"), images };
}

/**
 * Build Gemini `contents` argument — multimodal when images exist, plain string otherwise.
 */
export function buildBriefContents(result: BriefPromptResult) {
  if (result.images.length === 0) return result.prompt;
  return createUserContent([
    createPartFromText(result.prompt),
    ...result.images.map((img) =>
      createPartFromBase64(img.data.toString("base64"), img.mimeType)
    ),
  ]);
}
