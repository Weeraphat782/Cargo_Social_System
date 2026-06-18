import { NextResponse } from "next/server";
import {
  GoogleGenAI,
  Type,
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from "@google/genai";
import type { Schema } from "@google/genai";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { withAiLog } from "@/lib/ai-logger";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import {
  buildStrategyAnalyzePrompt,
  STRATEGY_THEME_ORDER,
} from "@/lib/strategies/analyze-prompt";
import {
  normalizeStrategyAiCampaignToPayload,
  type StrategyAiCampaign,
} from "@/lib/strategies/normalize-ai-campaign";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

const campaignItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    keywords: { type: Type.STRING },
    brandVoice: { type: Type.STRING },
    theme: { type: Type.STRING },
    themePitch: { type: Type.STRING },
    contentMode: { type: Type.STRING },
    cadence: { type: Type.STRING },
    dayOfWeek: { type: Type.NUMBER },
    hourOfDay: { type: Type.NUMBER },
    postsPerRun: { type: Type.NUMBER },
    imagesPerPost: { type: Type.NUMBER },
    autoApprove: { type: Type.BOOLEAN },
    rationale: { type: Type.STRING },
    campaignGoal: { type: Type.STRING },
    contentPillars: { type: Type.STRING },
    sourceQuote: { type: Type.STRING },
    daysOfWeekMulti: { type: Type.STRING },
    specificDates: { type: Type.STRING },
    scheduledDatetimes: { type: Type.STRING },
    targetPersona: { type: Type.STRING },
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
    "sourceQuote",
  ],
};

const strategyAnalyzeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    campaigns: {
      type: Type.ARRAY,
      items: campaignItemSchema,
    },
  },
  required: ["summary", "campaigns"],
};

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const strategy = await prisma.marketingStrategy.findUnique({ where: { id } });
  if (!strategy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (strategy.status === "ANALYZING") {
    return NextResponse.json({ ok: true, message: "Already analyzing" });
  }

  if (strategy.status !== "UPLOADED" && strategy.status !== "FAILED") {
    return NextResponse.json(
      {
        error:
          "Analysis can only run when the strategy is uploaded or after a failed analysis",
      },
      { status: 400 }
    );
  }

  await prisma.marketingStrategy.update({
    where: { id },
    data: { status: "ANALYZING", analyzeError: null },
  });

  let pdfBuf: Buffer;
  try {
    const pdfRes = await fetch(strategy.sourceFileUrl, { cache: "no-store" });
    if (!pdfRes.ok) {
      throw new Error(`Failed to fetch PDF (${pdfRes.status})`);
    }
    pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.marketingStrategy.update({
      where: { id },
      data: { status: "FAILED", analyzeError: msg },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const tpl = await getBrandTemplateOrDefault(strategy.brandTemplateId);
  const lanesText = STRATEGY_THEME_ORDER.map((th) => {
    const b = tpl.themeBundles[th];
    return `• ${b.id} (${b.label}): leadServiceName="${b.leadServiceName}" — angle: ${b.angle}`;
  }).join("\n");
  const serviceDisallowList = tpl.services.map((s) => `"${s.name}"`).join(", ");

  const prompt = buildStrategyAnalyzePrompt({
    template: tpl,
    lanesText,
    serviceDisallowList,
  });

  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const contents = createUserContent([
    createPartFromText(prompt),
    createPartFromBase64(pdfBuf.toString("base64"), "application/pdf"),
  ]);

  let textOut: string;
  try {
    const res = await withAiLog(
      "strategy.analyze",
      {
        strategyId: id,
        brandTemplateId: strategy.brandTemplateId,
        promptChars: prompt.length,
        pdfBytes: pdfBuf.length,
      },
      () =>
        withGeminiRetry("strategyAnalyze", () =>
          ai.models.generateContent({
            model: TEXT_MODEL,
            contents,
            config: {
              responseMimeType: "application/json",
              responseSchema: strategyAnalyzeSchema,
              temperature: 0.4,
            },
          })
        ),
      (r) => ({
        responseText: r.text ?? "",
        ok: Boolean(r.text),
      })
    );
    textOut = res.text ?? "";
    if (!textOut) {
      throw new Error("No response text from Gemini");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.marketingStrategy.update({
      where: { id },
      data: { status: "FAILED", analyzeError: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let parsed: { summary: string; campaigns: StrategyAiCampaign[] };
  try {
    parsed = JSON.parse(textOut) as { summary: string; campaigns: StrategyAiCampaign[] };
  } catch {
    await prisma.marketingStrategy.update({
      where: { id },
      data: {
        status: "FAILED",
        analyzeError: "Invalid JSON from model",
        rawExtraction: {
          fragment: textOut.slice(0, 4000),
        } as object,
      },
    });
    return NextResponse.json({ error: "Invalid JSON from model" }, { status: 500 });
  }

  const industryKw = tpl.industryContext.split("/")[0]?.trim() || "industry news";
  const rawCampaigns = (parsed.campaigns ?? []).slice(0, 8);
  const withQuotes = rawCampaigns.filter(
    (c) => typeof c.sourceQuote === "string" && c.sourceQuote.trim().length >= 10
  );

  if (withQuotes.length === 0) {
    await prisma.marketingStrategy.update({
      where: { id },
      data: {
        status: "FAILED",
        analyzeError:
          "Model returned no campaigns with valid sourceQuote (PDF grounding required)",
        rawExtraction: parsed as unknown as object,
      },
    });
    return NextResponse.json(
      { error: "No grounded campaigns (missing PDF quotes)" },
      { status: 422 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.strategyCampaignDraft.deleteMany({ where: { strategyId: id } });

      let idx = 0;
      for (const c of withQuotes) {
        const payload = normalizeStrategyAiCampaignToPayload(c, industryKw);
        await tx.strategyCampaignDraft.create({
          data: {
            strategyId: id,
            orderIndex: idx,
            status: "PENDING",
            payload: payload as object,
            rationale: c.rationale,
            sourceQuote: c.sourceQuote.trim(),
          },
        });
        idx += 1;
      }

      await tx.marketingStrategy.update({
        where: { id },
        data: {
          status: "READY_REVIEW",
          summary: parsed.summary?.trim() || null,
          rawExtraction: parsed as unknown as object,
          analyzeError: null,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.marketingStrategy.update({
      where: { id },
      data: { status: "FAILED", analyzeError: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draftCount: withQuotes.length });
}
