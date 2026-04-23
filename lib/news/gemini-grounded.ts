import { createHash } from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { withGeminiRetry } from "@/lib/gemini-retry";
import { urlDedupKey, verifyUrl } from "./url-verify";
import type { GoogleNewsResult } from "./google";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

const snippetsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    snippets: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "One factual sentence per article, same order as titles",
    },
  },
  required: ["snippets"],
};

function extractWebRefsFromResponse(response: {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
}): { uri: string; title: string }[] {
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const out: { uri: string; title: string }[] = [];
  for (const c of chunks) {
    const w = c.web;
    const uri = w?.uri?.trim();
    if (!uri || !/^https?:\/\//i.test(uri)) continue;
    const title = (w?.title ?? "News article").trim() || "News article";
    const key = urlDedupKey(uri);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ uri, title });
  }
  return out;
}

async function generateSnippetsForTitles(
  ai: GoogleGenAI,
  query: string,
  titles: string[]
): Promise<string[]> {
  if (titles.length === 0) return [];
  const list = titles.map((t, i) => `${i}. ${t}`).join("\n");
  const prompt = `You are helping build a news digest. For each numbered title below, write exactly ONE short, factual sentence (no hype, no marketing) summarizing what the article is likely about, in the context of this search: "${query}".

Titles (in order):
${list}

Return JSON only: { "snippets": [ "...", ... ] } with the same number of strings as titles, in the same order.`;

  const response = await withGeminiRetry("geminiNewsSnippets", () =>
    ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: snippetsSchema,
      },
    })
  );
  const text = response.text;
  if (!text) {
    return titles.map(() => "");
  }
  try {
    const parsed = JSON.parse(text) as { snippets?: string[] };
    const s = Array.isArray(parsed.snippets) ? parsed.snippets : [];
    return titles.map((_, i) => (typeof s[i] === "string" ? s[i]! : "").trim());
  } catch {
    return titles.map(() => "");
  }
}

/**
 * News search via Gemini Google Search grounding — URLs come from
 * `groundingMetadata.groundingChunks[].web` (not model-hallucinated JSON).
 * Upserts `NewsItem` after strict `verifyUrl`.
 *
 * @see https://ai.google.dev/gemini-api/docs/grounding
 */
export async function searchNewsWithGemini(
  query: string,
  options?: { num?: number }
): Promise<GoogleNewsResult[]> {
  const num = Math.min(options?.num ?? 5, 10);
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const prompt = `Summarize the latest newsworthy developments about: "${query}".

Write 2-3 short paragraphs. Focus on specific, recent events from roughly the last 6 months when possible. Be factual; do not invent statistics or company names.`;

  let response;
  try {
    response = await withGeminiRetry("searchNewsWithGemini:grounding", () =>
      ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 4096,
        },
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[gemini-grounded] generateContent failed:", msg);
    throw new Error(`Gemini grounded search call failed: ${msg}`);
  }

  // GenerateContentResponse may be a class instance with .candidates
  const resObj = response as unknown as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };
  const webRefs = extractWebRefsFromResponse(resObj);

  if (webRefs.length === 0) {
    console.error(
      "[gemini-grounded] No grounding web chunks. Response text (preview):",
      (response as { text?: string }).text?.slice(0, 500) ?? "n/a"
    );
    throw new Error(
      "Gemini search returned no verifiable source URLs. Try setting GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID for more reliable results."
    );
  }

  const toVerify = webRefs.slice(0, Math.min(webRefs.length, num * 2));
  const verified: { title: string; link: string }[] = [];
  for (const ref of toVerify) {
    if (verified.length >= num) break;
    const link = await verifyUrl(ref.uri);
    if (link) {
      const key = urlDedupKey(link);
      if (verified.some((v) => urlDedupKey(v.link) === key)) continue;
      verified.push({ title: ref.title, link });
    }
  }

  if (verified.length === 0) {
    throw new Error(
      "All grounding URLs failed verification (unreachable or blocked). Check network or set Google CSE."
    );
  }

  const titleList = verified.map((v) => v.title);
  const snippetList = await generateSnippetsForTitles(ai, query, titleList);

  const items: GoogleNewsResult[] = [];
  for (let i = 0; i < verified.length; i++) {
    const { title, link } = verified[i]!;
    const rawSnip = snippetList[i] ?? "";
    const snippet = rawSnip || title;
    const urlHash = hashUrl(link);
    await prisma.newsItem.upsert({
      where: { urlHash },
      create: { url: link, urlHash, title, snippet: snippet || null },
      update: { title, snippet: snippet || undefined },
    });
    items.push({ title, link, snippet });
  }

  return items;
}