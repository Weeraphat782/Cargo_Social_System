import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { CampaignCadence, CampaignTheme } from "@prisma/client";
import { auth } from "@/auth";
import { requireEnv } from "@/lib/env";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { THEME_BUNDLES } from "@/lib/agent/themes";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const OMG_BRIEF = `OMG Experience — specialized air freight, cold chain, time-critical / DG, AI visibility, Asia-Pacific. Audience: supply chain, pharma, ops.`;

export type SuggestedCampaign = {
  name: string;
  description: string;
  keywords: string;
  brandVoice: string;
  /** Must map to a visual+prompt lane; AI picks the closest fit. */
  theme: CampaignTheme;
  /** Short label for the user (e.g. "Pharma trust arc") */
  themePitch: string;
  cadence: CampaignCadence;
  dayOfWeek: number;
  hourOfDay: number;
  postsPerRun: number;
  autoApprove: boolean;
  rationale: string;
};

const VALID_THEMES: CampaignTheme[] = [
  "RELIABILITY_PRO",
  "INNOVATION_TECH",
  "SPEED_URGENCY",
];

const VALID_CADENCE: CampaignCadence[] = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
];

const suggestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    campaigns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Clear campaign name, 3–8 words" },
          description: {
            type: Type.STRING,
            description: "2–4 sentences: what the campaign is and success looks like",
          },
          keywords: {
            type: Type.STRING,
            description: "News search query, English, specific for Google / grounding",
          },
          brandVoice: {
            type: Type.STRING,
            description: "2–3 sentences: tone and angle for this campaign",
          },
          theme: {
            type: Type.STRING,
            description:
              "One of: RELIABILITY_PRO | INNOVATION_TECH | SPEED_URGENCY (pick the best lane for creative + image reference)",
          },
          themePitch: {
            type: Type.STRING,
            description: "One short line: creative name for the angle (not the enum)",
          },
          cadence: {
            type: Type.STRING,
            description: "One of: WEEKLY | BIWEEKLY | MONTHLY",
          },
          dayOfWeek: { type: Type.NUMBER, description: "0=Sunday … 6=Saturday, Bangkok-local intent" },
          hourOfDay: { type: Type.NUMBER, description: "0–23 local hour to run" },
          postsPerRun: { type: Type.NUMBER, description: "1–3" },
          autoApprove: {
            type: Type.BOOLEAN,
            description: "false unless user will review queue; default false",
          },
          rationale: {
            type: Type.STRING,
            description: "One sentence why this campaign fits OMG now",
          },
        },
        required: [
          "name",
          "description",
          "keywords",
          "brandVoice",
          "theme",
          "themePitch",
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
      `${b.id}: ${b.label} — ${b.angle} (reference images: ${b.referenceCategory})`
  ).join("\n");

  const prompt = `You are a senior B2B social + newsroom campaign planner for OMG Experience.
${OMG_BRIEF}

The product uses three fixed *creative lanes* (for image style + Gemini prompts). You must invent 3 **distinct, creative** campaign ideas (not copy template titles). For each idea, pick exactly ONE lane enum that best matches:

${lanes}

User optional hint (may be empty): ${hint || "(none — suggest diverse industry-relevant campaigns)"}

Output exactly 3 campaigns. Vary: cadence, day/hour, and themes across ideas. 
- dayOfWeek/hourOfDay are in local business sense for Asia/Bangkok; prefer Tue–Thu 08:00–10:00 or 15:00–17:00 unless hint says otherwise.
- postsPerRun: 1 or 2 usually; 3 only for fast-moving news angles.
- autoApprove: almost always false (human approves in queue) unless the hint explicitly wants full automation.`;

  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const res = await withGeminiRetry("campaignSuggest", () =>
    ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestSchema,
      },
    })
  );

  const text = res.text;
  if (!text) {
    return NextResponse.json({ error: "No response from Gemini" }, { status: 500 });
  }

  const raw = JSON.parse(text) as { campaigns: SuggestedCampaign[] };
  const campaigns = (raw.campaigns ?? []).slice(0, 3).map((c) => ({
    name: c.name,
    description: c.description,
    keywords: c.keywords,
    brandVoice: c.brandVoice,
    theme: clampTheme(c.theme),
    themePitch: c.themePitch,
    cadence: clampCadence(c.cadence),
    dayOfWeek: Math.max(0, Math.min(6, Math.floor(Number(c.dayOfWeek) || 1))),
    hourOfDay: Math.max(0, Math.min(23, Math.floor(Number(c.hourOfDay) || 9))),
    postsPerRun: Math.max(1, Math.min(3, Math.floor(Number(c.postsPerRun) || 1))),
    autoApprove: Boolean(c.autoApprove),
    rationale: c.rationale,
  }));

  return NextResponse.json({ campaigns });
}
