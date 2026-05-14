import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "@/lib/env";
import { withAiLog } from "@/lib/ai-logger";
import { buildBriefPrompt, buildBriefContents } from "@/lib/planner/build-brief-prompt";

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
      brandVoice: true,
      description: true,
      platforms: true,
      platformStrategies: true,
      moodboardImages: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const template = await getBrandTemplateOrDefault(campaign.brandTemplateId);

  const built = await buildBriefPrompt({
    template,
    campaign: {
      name: campaign.name,
      keywords: campaign.keywords,
      contentMode: campaign.contentMode,
      contentLanguage: campaign.contentLanguage ?? "en",
      campaignGoal: campaign.campaignGoal,
      targetPersona: campaign.targetPersona,
      contentPillars: campaign.contentPillars,
      theme: campaign.theme,
      brandTemplateId: campaign.brandTemplateId,
      brandVoice: campaign.brandVoice,
      description: campaign.description,
      platforms: campaign.platforms ?? [],
      platformStrategies: campaign.platformStrategies,
      moodboardImages: campaign.moodboardImages,
    },
    slot: {
      scheduledFor: body.scheduledFor,
      pillar: body.pillar ?? null,
      keywordHint: body.keywordHint ?? null,
    },
    includeImages: true,
  });

  try {
    const ai = getAI();
    const imagesAttached = built.images.length;
    const result = await withAiLog(
      "planner.brief",
      {
        campaignId: body.campaignId,
        brandTemplateId: campaign.brandTemplateId,
        theme: campaign.theme,
        prompt: built.prompt,
        promptImages: imagesAttached,
      },
      () =>
        ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: buildBriefContents(built),
        }),
      (res) => ({
        responseText: res.text?.trim() ?? "",
        ok: Boolean(res.text?.trim()),
      })
    );
    const brief = result.text?.trim() ?? "";
    if (!brief) return NextResponse.json({ error: "No brief generated" }, { status: 500 });
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[planner/brief] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 });
  }
}
