import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "@/lib/env";

function getAI() {
  return new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
}

/** POST /api/planner/brief — generate a 2-3 sentence editorial brief for a slot */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    campaignId: string;
    scheduledFor: string;
    indexInRun?: number;
    pillar?: string | null;
    keywordHint?: string | null;
  };

  if (!body.campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: body.campaignId },
    select: {
      name: true,
      keywords: true,
      contentMode: true,
      contentLanguage: true,
      campaignGoal: true,
      targetPersona: true,
      contentPillars: true,
      theme: true,
      brandTemplateId: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const template = await getBrandTemplateOrDefault(campaign.brandTemplateId);
  const pillar = body.pillar ?? null;
  const keywordHint = body.keywordHint?.trim() || campaign.keywords;
  const scheduledDate = body.scheduledFor ? new Date(body.scheduledFor).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "the scheduled date";

  const prompt = `You are a content strategist for ${template.orgDisplayName}, a ${template.industryContext} brand.

Generate a SHORT 2-3 sentence editorial brief for ONE social media post scheduled for ${scheduledDate}.

Campaign: "${campaign.name}"
Content mode: ${campaign.contentMode === "NEWS_DRIVEN" ? "News-driven (will find a real news article matching the keywords at publish time)" : "Self-promo (brand storytelling, no external news required)"}
Keywords / focus: ${keywordHint}
${pillar ? `Content pillar for this post: ${pillar}` : ""}
${campaign.campaignGoal ? `Campaign goal: ${campaign.campaignGoal}` : ""}
${campaign.targetPersona ? `Target audience: ${campaign.targetPersona}` : ""}
Theme: ${campaign.theme.replace(/_/g, " ").toLowerCase()}

Write a brief that describes:
1. What angle or topic this post will take
2. How it serves the content pillar${pillar ? ` (${pillar})` : ""}
3. What the audience should feel or do after reading

Keep it to 2-3 sentences. Be specific — avoid generic marketing language.
${campaign.contentLanguage === "th" ? "Write the brief in Thai (ภาษาไทย)." : "Write the brief in English."}

Output ONLY the brief text. No labels, no markdown.`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const brief = result.text?.trim() ?? "";
    if (!brief) return NextResponse.json({ error: "No brief generated" }, { status: 500 });
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[planner/brief] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 });
  }
}
