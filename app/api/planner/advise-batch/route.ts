import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "@/lib/env";

function getAI() {
  return new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
}

type SlotInput = {
  campaignId: string;
  scheduledFor: string;
  indexInRun: number;
  pillar?: string | null;
  keywordHint?: string | null;
};

/**
 * POST /api/planner/advise-batch
 * Generate briefs for multiple slots and upsert PostPlans.
 * Returns { saved: number, failed: number }.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { slots: SlotInput[] };
  if (!Array.isArray(body.slots) || body.slots.length === 0) {
    return NextResponse.json({ error: "slots array required" }, { status: 400 });
  }

  // Cap at 60 slots per call to avoid timeout
  const slots = body.slots.slice(0, 60);

  // Pre-load unique campaigns
  const uniqueCampaignIds = [...new Set(slots.map((s) => s.campaignId))];
  const campaignRows = await prisma.campaign.findMany({
    where: { id: { in: uniqueCampaignIds } },
    select: {
      id: true,
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
  const campaignMap = new Map(campaignRows.map((c) => [c.id, c]));

  // Pre-load unique templates
  const uniqueTemplateIds = [...new Set(campaignRows.map((c) => c.brandTemplateId))];
  const templates = await Promise.all(uniqueTemplateIds.map((tid) => getBrandTemplateOrDefault(tid)));
  const templateMap = new Map(uniqueTemplateIds.map((tid, i) => [tid, templates[i]]));

  const ai = getAI();
  let saved = 0;
  let failed = 0;

  for (const slot of slots) {
    const campaign = campaignMap.get(slot.campaignId);
    if (!campaign) { failed++; continue; }
    const template = templateMap.get(campaign.brandTemplateId);
    if (!template) { failed++; continue; }

    const pillar = slot.pillar ?? null;
    const keywordHint = slot.keywordHint?.trim() || campaign.keywords;
    const scheduledDate = new Date(slot.scheduledFor).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

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
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      const brief = result.text?.trim() ?? "";
      if (!brief) { failed++; continue; }

      const scheduledFor = new Date(slot.scheduledFor);
      await prisma.postPlan.upsert({
        where: {
          campaignId_scheduledFor_indexInRun: {
            campaignId: slot.campaignId,
            scheduledFor,
            indexInRun: slot.indexInRun,
          },
        },
        create: {
          campaignId: slot.campaignId,
          scheduledFor,
          indexInRun: slot.indexInRun,
          pillar: pillar,
          brief,
          keywordHint: slot.keywordHint ?? null,
        },
        update: {
          pillar: pillar,
          brief,
          keywordHint: slot.keywordHint ?? null,
        },
      });
      saved++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ saved, failed });
}
