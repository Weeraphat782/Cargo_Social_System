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
import { OMG_SERVICES } from "@/lib/agent/promo-config";
import { THEME_BUNDLES } from "@/lib/agent/themes";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const OMG_BRIEF = `OMG Experience — specialized air freight, cold chain, time-critical / DG, AI visibility, Asia-Pacific. Audience: supply chain, pharma, ops.`;

const BRAINSTORM_SEEDS = `Possible angles to mix (do not copy these verbatim): thought-leadership, customer testimonial, mini case study, behind-the-ops, data/insight drop, regional spotlight, ESG, FAQ series, "day in the life", founder/POV, partner co-marketing, service deep-dive, myth-busting, compliance myth vs reality, seasonal surge planning.`;

const FORBIDDEN_NAME_SUBSTR = [
  "pharmaceutical cold chain",
  "ai-powered logistics visibility",
  "time-critical",
  "reliability & compliance",
  "innovation & visibility",
  "speed & time-critical",
];

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

function buildSuggestPrompt(hint: string, lanes: string, serviceDisallowList: string) {
  const hasHint = Boolean(hint);

  return `You are a senior B2B social + newsroom campaign planner for OMG Experience.
${OMG_BRIEF}

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
- Do not copy OMG's fixed service line names: ${serviceDisallowList}
- Do not use these generic phrases as the whole name: ${FORBIDDEN_NAME_SUBSTR.join(", ")}
- Names should sound like a campaign or series title, not a product SKU.

## contentMode
- NEWS_DRIVEN: each run finds real industry news then promotes OMG. "keywords" = tight English search query for that angle.
- SELF_PROMO: no required news; pure brand storytelling, case-style, or capability promo. "keywords" can list services/themes in English, or a short free-text guide.

## Variety (apply all that fit)
- Across the 3 ideas, vary: cadence, dayOfWeek+hour, contentMode, and creative format (per brainstorm list below at least 2 different formats).
- At least 2 of the 3 ideas must differ in **two or more of**: contentMode, cadence, and theme.
${BRAINSTORM_SEEDS}

## Scheduling
- dayOfWeek/hourOfDay: Asia/Bangkok business sense. Prefer Tue–Thu 08:00–10:00 or 15:00–17:00 unless the user hint says otherwise.
- postsPerRun: 1-2 usually; 3 only for very fast news cycles.
- autoApprove: almost always false unless the user hint explicitly wants full auto-queue.

Output exactly 3 items in "campaigns". JSON only, schema-enforced.`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let hint = "";
  try {
    const body = (await req.json()) as { hint?: string };
    hint = typeof body.hint === "string" ? body.hint.trim() : "";
  } catch {
    // no body
  }

  const lanes = THEME_BUNDLES.map(
    (b) =>
      `• ${b.id} (${b.label}): leadServiceName="${b.leadServiceName}" — angle: ${b.angle} — ref images: ${b.referenceCategory ?? "none (optional)"}`
  ).join("\n");

  const serviceDisallowList = OMG_SERVICES.map((s) => `"${s.name}"`).join(", ");

  const prompt = buildSuggestPrompt(hint, lanes, serviceDisallowList);

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
      kmode = "logistics air freight industry news";
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
    };
  });

  return NextResponse.json({ campaigns });
}
