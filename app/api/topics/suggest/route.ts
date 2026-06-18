import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { auth } from "@/auth";
import { requireEnv } from "@/lib/env";
import { withAiLog } from "@/lib/ai-logger";
import { omgTemplate } from "@/lib/brands/templates/omg";

export type SuggestedTopic = {
  name: string;
  keywords: string;
  brandVoice: string;
  rationale: string;
};

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const FOCUS_KEYWORDS = omgTemplate.focusKeywords ?? [];

const OMG_CONTEXT = `
OMG Experience (cargo.omgexp.com) is a specialized air freight and logistics company focused on:
- EU GMP / GACP cannabis logistics and medical cannabis import compliance
- Pharmaceutical & temperature-controlled (GDP cold chain) cargo
- EU GMP Annex 7 herbal medicinal products cannabis
- Time-sensitive / time-critical shipments
- Regulatory compliance (GDP, GMP, GACP, IATA, CEIV Pharma)
- AI-powered logistics optimization
- Supply chain visibility & tracking technology
- Global freight forwarding with a focus on Asia-Pacific and EU routes

Target audience: logistics managers, supply chain directors, pharmaceutical procurement teams, cannabis compliance officers, QP/GMP auditors, freight buyers.
Brand tone: Professional, expert, trustworthy, compliance-focused, innovative (AI-forward).

PRIMARY SEO KEYWORD CLUSTER (all suggested topics must map to one of these or a close long-tail variant):
${FOCUS_KEYWORDS.map((k) => `- ${k}`).join("\n")}
`;

const suggestResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Short topic name, 4-7 words" },
          keywords: {
            type: Type.STRING,
            description:
              "English Google search query aligned to the PRIMARY SEO KEYWORD CLUSTER — specific, news-friendly, and NOT branded (avoid 'omg' in keywords)",
          },
          brandVoice: {
            type: Type.STRING,
            description: "2-3 sentences: angle and tone for this topic",
          },
          rationale: {
            type: Type.STRING,
            description: "One sentence why this matters for OMG audience now",
          },
        },
        required: ["name", "keywords", "brandVoice", "rationale"],
      },
      description: "Exactly 8 diverse topics",
    },
  },
  required: ["topics"],
};

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const prompt = `You are a social media strategist for OMG Experience — a specialized air freight and EU GMP/GACP cannabis logistics company.

Company context:
${OMG_CONTEXT}

Generate exactly 8 highly relevant content topics for their social media channels (Facebook, Instagram, LinkedIn) and news blog (OMG Cargo website).

Funnel mix (cover all three layers across the 8 topics):
1. Money / commercial (2 topics): transactional intent — e.g. "EU GMP cannabis logistics", "GMP cannabis cold chain", "medical cannabis import EU"
2. Comparison / mid-funnel (2 topics): e.g. "GACP vs GMP cannabis", "EU GMP Annex 7 explained", "best cannabis logistics provider EU"
3. Informational / top-funnel (4 topics): educational guides on compliance, certification, market trends — prioritise keywords already showing search demand: EU GMP Annex 7, Germany medical cannabis market, EU QP certification, GMP cannabis logistics

Rules:
- Every topic's "keywords" field MUST be an English search query from the PRIMARY SEO KEYWORD CLUSTER above (or a close long-tail variant). Do NOT use branded queries containing "omg".
- Topics must build topical authority around cannabis/GMP/EU compliance logistics — NOT generic air freight unless tied to regulated cargo.
- Make topics diverse but cohesive as one keyword cluster.

For each topic, think about:
- What trending industry news or regulatory developments would their audience care about?
- What thought leadership angles would position OMG as an expert in cannabis logistics compliance?
- What educational content would help QP teams, compliance officers, and logistics buyers?`;

  const res = await withAiLog(
    "topic.suggest",
    {
      brandTemplateId: "omg",
      hint: "",
      prompt,
    },
    () =>
      ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: suggestResponseSchema,
        },
      }),
    (r) => ({
      responseText: r.text ?? "",
      ok: Boolean(r.text),
    })
  );

  const text = res.text;
  if (!text) {
    return NextResponse.json({ error: "No response from Gemini" }, { status: 500 });
  }

  const parsed = JSON.parse(text) as { topics: SuggestedTopic[] };
  return NextResponse.json(parsed);
}
