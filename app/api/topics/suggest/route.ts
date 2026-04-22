import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { auth } from "@/auth";
import { requireEnv } from "@/lib/env";

export type SuggestedTopic = {
  name: string;
  keywords: string;
  brandVoice: string;
  rationale: string;
};

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const OMG_CONTEXT = `
OMG Experience (cargo.omgexp.com) is a specialized air freight and logistics company focused on:
- Pharmaceutical & temperature-controlled (cold chain) cargo
- Time-sensitive / time-critical shipments
- Dangerous goods (DG) transport
- AOG (Aircraft on Ground) parts logistics
- Project cargo and oversized freight
- AI-powered logistics optimization
- Regulatory compliance (GDP, IATA, CEIV Pharma)
- Last-mile delivery solutions
- Supply chain visibility & tracking technology
- Global freight forwarding with a focus on Asia-Pacific and international routes

Target audience: logistics managers, supply chain directors, pharmaceutical procurement teams, airline MRO teams, freight buyers.
Brand tone: Professional, expert, trustworthy, compliance-focused, innovative (AI-forward).
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
            description: "Google search query to find latest news, specific and news-friendly",
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

  const prompt = `You are a social media strategist for OMG Experience — a specialized air freight and logistics company.

Company context:
${OMG_CONTEXT}

Generate exactly 8 highly relevant content topics for their social media channels (Facebook, Instagram, LinkedIn) and news blog (OMG Cargo website).

For each topic, think about:
- What trending industry news or developments would their audience care about?
- What thought leadership angles would position OMG as an expert?
- What educational content would help their clients?

Make topics diverse across: cold chain/pharma, AI/tech in logistics, industry regulations, sustainability in freight, time-critical cargo, supply chain resilience, aviation cargo trends. All must be relevant to air freight / specialized logistics.`;

  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: suggestResponseSchema,
    },
  });

  const text = res.text;
  if (!text) {
    return NextResponse.json({ error: "No response from Gemini" }, { status: 500 });
  }

  const parsed = JSON.parse(text) as { topics: SuggestedTopic[] };
  return NextResponse.json(parsed);
}
