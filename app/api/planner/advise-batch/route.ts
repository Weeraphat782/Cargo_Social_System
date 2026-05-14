import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "@/lib/env";
import { withAiLog } from "@/lib/ai-logger";
import {
  buildBriefPrompt,
  buildBriefContents,
  type BriefPromptResult,
} from "@/lib/planner/build-brief-prompt";

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

const GEMINI_CONCURRENCY = 3;

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

  const slots = body.slots.slice(0, 60);

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
      brandVoice: true,
      description: true,
      platforms: true,
      platformStrategies: true,
      moodboardImages: true,
    },
  });
  const campaignMap = new Map(campaignRows.map((c) => [c.id, c]));

  const uniqueTemplateIds = [...new Set(campaignRows.map((c) => c.brandTemplateId))];
  const templates = await Promise.all(
    uniqueTemplateIds.map((tid) => getBrandTemplateOrDefault(tid))
  );
  const templateMap = new Map(uniqueTemplateIds.map((tid, i) => [tid, templates[i]]));

  const builtCache = new Map<string, BriefPromptResult>();
  const ai = getAI();

  let saved = 0;
  let failed = 0;
  let nextSlotIdx = 0;

  async function processSlot(slot: SlotInput): Promise<void> {
    const campaign = campaignMap.get(slot.campaignId);
    if (!campaign) {
      failed++;
      return;
    }
    const template = templateMap.get(campaign.brandTemplateId);
    if (!template) {
      failed++;
      return;
    }

    try {
      const cached = builtCache.get(campaign.id);
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
          scheduledFor: slot.scheduledFor,
          pillar: slot.pillar ?? null,
          keywordHint: slot.keywordHint ?? null,
        },
        includeImages: !cached,
      });
      const finalResult: BriefPromptResult = {
        prompt: built.prompt,
        images: cached?.images ?? built.images,
      };
      if (!cached) builtCache.set(campaign.id, finalResult);

      const imagesAttached = finalResult.images.length;
      const result = await withAiLog(
        "planner.adviseBatch.slot",
        {
          campaignId: slot.campaignId,
          brandTemplateId: campaign.brandTemplateId,
          theme: campaign.theme,
          scheduledFor: slot.scheduledFor,
          indexInRun: slot.indexInRun,
          prompt: finalResult.prompt,
          promptImages: imagesAttached,
        },
        () =>
          ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: buildBriefContents(finalResult),
          }),
        (res) => ({
          responseText: res.text?.trim() ?? "",
          ok: Boolean(res.text?.trim()),
        })
      );
      const brief = result.text?.trim() ?? "";
      if (!brief) {
        failed++;
        return;
      }

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
          pillar: slot.pillar ?? null,
          brief,
          keywordHint: slot.keywordHint ?? null,
        },
        update: {
          pillar: slot.pillar ?? null,
          brief,
          keywordHint: slot.keywordHint ?? null,
        },
      });
      saved++;
    } catch (err) {
      console.error("[planner/advise-batch] slot failed:", err);
      failed++;
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      const idx = nextSlotIdx++;
      if (idx >= slots.length) return;
      await processSlot(slots[idx]!);
    }
  }

  const poolSize = Math.min(GEMINI_CONCURRENCY, Math.max(1, slots.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  return NextResponse.json({ saved, failed });
}
