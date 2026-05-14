import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type {
  CampaignCadence,
  CampaignContentMode,
  CampaignTheme,
} from "@prisma/client";
import { auth } from "@/auth";
import { requireEnv } from "@/lib/env";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { buildSuggestCampaignPrompt } from "@/lib/brands/build-prompts";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import { prisma } from "@/lib/db";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const BRAINSTORM_SEEDS = `Possible angles to mix (do not copy these verbatim): thought-leadership, customer testimonial, mini case study, behind-the-ops, data/insight drop, regional spotlight, ESG, FAQ series, "day in the life", founder/POV, partner co-marketing, service deep-dive, myth-busting, compliance myth vs reality, seasonal surge planning.`;

export type SuggestedCampaign = {
  name: string;
  description: string;
  keywords: string;
  brandVoice: string;
  /** Visual + prompt lane (post-hoc tag, not a preset slot to fill) */
  theme: CampaignTheme;
  themePitch: string;
  cadence: CampaignCadence;
  dayOfWeek: number;
  hourOfDay: number;
  postsPerRun: number;
  autoApprove: boolean;
  rationale: string;
  contentMode: CampaignContentMode;
  campaignGoal: string;
  contentPillars: string;
};

const VALID_THEMES: CampaignTheme[] = [
  "RELIABILITY_PRO",
  "INNOVATION_TECH",
  "SPEED_URGENCY",
];

const VALID_CADENCE: CampaignCadence[] = [
  "DAILY",
  "WEEKLY",
  "WEEKLY_MULTI",
  "BIWEEKLY",
  "MONTHLY",
  "SPECIFIC_DATES",
  "CUSTOM",
];

const VALID_CONTENT_MODES: CampaignContentMode[] = ["NEWS_DRIVEN", "SELF_PROMO"];

const suggestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    campaigns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description:
              "Creative 3-8 word campaign name. MUST NOT be a product/service name from the 3 leadServiceName strings or a lane label.",
          },
          description: {
            type: Type.STRING,
            description: "2-4 sentences: what the campaign is and success looks like",
          },
          keywords: {
            type: Type.STRING,
            description:
              "If contentMode=NEWS_DRIVEN: English search query for news grounding, specific, aligned to user hint. If SELF_PROMO: comma-separated themes/services to feature (not a search query), can be empty if name+description carry enough.",
          },
          brandVoice: {
            type: Type.STRING,
            description: "2-3 sentences: tone and angle for this campaign",
          },
          theme: {
            type: Type.STRING,
            description:
              "After designing the idea, pick ONE: RELIABILITY_PRO | INNOVATION_TECH | SPEED_URGENCY (image style + reference folder only; multiple ideas may share the same value)",
          },
          themePitch: { type: Type.STRING, description: "One short line for the creative angle (not the enum)" },
          contentMode: {
            type: Type.STRING,
            description:
              "NEWS_DRIVEN = use industry news as hook. SELF_PROMO = 100% brand/promo, no required news. Mix: at least 2 of 3 should differ in contentMode when possible.",
          },
          cadence: {
            type: Type.STRING,
            description:
              "One of: DAILY | WEEKLY | WEEKLY_MULTI (multi-day weekly) | BIWEEKLY | MONTHLY | SPECIFIC_DATES | CUSTOM. Prefer variety across the 3 ideas.",
          },
          dayOfWeek: { type: Type.NUMBER, description: "0=Sunday … 6=Saturday, Asia/Bangkok" },
          hourOfDay: { type: Type.NUMBER, description: "0-23 local hour" },
          postsPerRun: { type: Type.NUMBER, description: "1-3" },
          autoApprove: { type: Type.BOOLEAN, description: "default false" },
          rationale: { type: Type.STRING, description: "One sentence, must mention user hint if provided" },
          campaignGoal: {
            type: Type.STRING,
            description: "One sentence: what this campaign is trying to achieve, e.g. 'Build brand awareness among pharma shippers in Southeast Asia' or 'Generate qualified leads for air-freight express services'",
          },
          contentPillars: {
            type: Type.STRING,
            description: "Comma-separated content angles for this campaign, e.g. 'Industry news commentary, Service deep-dives, Customer success stories, Regulatory updates'",
          },
        },
        required: [
          "name",
          "description",
          "keywords",
          "brandVoice",
          "theme",
          "themePitch",
          "contentMode",
          "cadence",
          "dayOfWeek",
          "hourOfDay",
          "postsPerRun",
          "autoApprove",
          "rationale",
          "campaignGoal",
          "contentPillars",
        ],
      },
    },
  },
  required: ["campaigns"],
};

function clampTheme(s: string): CampaignTheme {
  const t = s.trim().toUpperCase() as CampaignTheme;
  return VALID_THEMES.includes(t) ? t : "INNOVATION_TECH";
}

function clampCadence(s: string): CampaignCadence {
  const t = s.trim().toUpperCase() as CampaignCadence;
  return VALID_CADENCE.includes(t) ? t : "WEEKLY";
}

function clampContentMode(s: string): CampaignContentMode {
  const t = s.trim().toUpperCase() as CampaignContentMode;
  return VALID_CONTENT_MODES.includes(t) ? t : "NEWS_DRIVEN";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let hint = "";
  let brandTemplateId = "omg";
  try {
    const body = (await req.json()) as { hint?: string; brandTemplateId?: string };
    hint = typeof body.hint === "string" ? body.hint.trim() : "";
    const raw = typeof body.brandTemplateId === "string" ? body.brandTemplateId.trim() : "";
    if (raw) {
      // Check DB directly so newly-added brands are found even if cache hasn't parsed them yet
      const exists = await prisma.brandTemplateMaster.findUnique({ where: { slug: raw }, select: { slug: true } });
      if (exists || raw === "omg" || raw === "acme") brandTemplateId = raw;
    }
  } catch {
    // no body
  }

  const tpl = await getBrandTemplateOrDefault(brandTemplateId);
  if (tpl.id !== brandTemplateId) {
    console.warn(
      `[campaigns/suggest] Template id mismatch: requested brandTemplateId="${brandTemplateId}" but resolved template id="${tpl.id}" (possible stale cache or invalid payload — check Brand Master diagnose)`
    );
  }
  const THEME_ORDER = ["RELIABILITY_PRO", "INNOVATION_TECH", "SPEED_URGENCY"] as const;
  const lanes = THEME_ORDER.map((id) => {
    const b = tpl.themeBundles[id];
    return `• ${b.id} (${b.label}): leadServiceName="${b.leadServiceName}" — angle: ${b.angle} — ref images: ${b.referenceCategory ?? "none (optional)"}`;
  }).join("\n");

  const serviceDisallowList = tpl.services.map((s) => `"${s.name}"`).join(", ");

  const prompt = buildSuggestCampaignPrompt(
    tpl,
    hint,
    lanes,
    serviceDisallowList,
    BRAINSTORM_SEEDS
  );

  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const res = await withGeminiRetry("campaignSuggest", () =>
    ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestSchema,
        temperature: 1,
      },
    })
  );

  const text = res.text;
  if (!text) {
    return NextResponse.json({ error: "No response from Gemini" }, { status: 500 });
  }

  const raw = JSON.parse(text) as { campaigns: SuggestedCampaign[] };
  const campaigns = (raw.campaigns ?? []).slice(0, 3).map((c) => {
    const contentMode = clampContentMode(c.contentMode ?? "NEWS_DRIVEN");
    let kmode = c.keywords;
    if (contentMode === "NEWS_DRIVEN" && !String(kmode ?? "").trim()) {
      kmode = tpl.industryContext.split("/")[0].trim();
    }
    if (contentMode === "SELF_PROMO") {
      kmode = typeof kmode === "string" ? kmode.trim() : "";
    } else {
      kmode = String(kmode ?? "").trim();
    }
    return {
      name: c.name,
      description: c.description,
      keywords: kmode,
      brandVoice: c.brandVoice,
      theme: clampTheme(c.theme),
      themePitch: c.themePitch,
      contentMode,
      cadence: clampCadence(c.cadence),
      dayOfWeek: Math.max(0, Math.min(6, Math.floor(Number(c.dayOfWeek) || 1))),
      hourOfDay: Math.max(0, Math.min(23, Math.floor(Number(c.hourOfDay) || 9))),
      postsPerRun: Math.max(1, Math.min(3, Math.floor(Number(c.postsPerRun) || 1))),
      autoApprove: Boolean(c.autoApprove),
      rationale: c.rationale,
      campaignGoal: String(c.campaignGoal ?? "").trim(),
      contentPillars: String(c.contentPillars ?? "").trim(),
    };
  });

  return NextResponse.json({ campaigns });
}
