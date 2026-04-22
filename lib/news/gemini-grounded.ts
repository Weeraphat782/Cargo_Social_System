import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { withGeminiRetry } from "@/lib/gemini-retry";
import type { GoogleNewsResult } from "./google";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function extractJsonArray(raw: string): string {
  const cleaned = stripCodeFences(raw).trim();
  const start = cleaned.indexOf("[");
  if (start < 0) return "[]";
  const body = cleaned.slice(start);
  const end = body.lastIndexOf("]");
  if (end > 0) return body.slice(0, end + 1);
  return body;
}

/**
 * Attempt to parse a JSON array. If parsing fails (e.g. the model output was
 * truncated mid-object), walk the string and salvage every complete top-level
 * `{...}` object so we don't lose the whole response.
 */
function parseJsonArrayTolerant(
  text: string
): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fall through to salvage mode.
  }

  const objects: Array<Record<string, unknown>> = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let startIdx = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && startIdx >= 0) {
        const slice = text.slice(startIdx, i + 1);
        try {
          const obj = JSON.parse(slice);
          if (obj && typeof obj === "object") {
            objects.push(obj as Record<string, unknown>);
          }
        } catch {
          // Skip malformed object.
        }
        startIdx = -1;
      }
    }
  }

  return objects;
}

/**
 * News search powered by Gemini's Google Search grounding tool.
 * Signature mirrors `searchNews` in `lib/news/google.ts` so callers can swap freely.
 * Upserts `NewsItem` rows (dedup by urlHash) and returns compatible results.
 *
 * @see https://ai.google.dev/gemini-api/docs/grounding
 */
export async function searchNewsWithGemini(
  query: string,
  options?: { num?: number }
): Promise<GoogleNewsResult[]> {
  const num = Math.min(options?.num ?? 5, 10);
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });

  const prompt = `Search Google for the most recent, newsworthy articles about: "${query}".

Return ONLY a JSON array (no markdown, no commentary), up to ${num} items, newest first.
Each item MUST have exactly these keys:
- "title": the article headline
- "url": the canonical article URL (must start with http or https)
- "snippet": a one-sentence factual summary from the article

If you cannot find enough articles, return as many as you can (minimum 1). If none, return [].
Example: [{"title":"...","url":"https://...","snippet":"..."}]`;

  let response;
  try {
    response = await withGeminiRetry("searchNewsWithGemini", () =>
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

  const text = response.text ?? "[]";
  const jsonText = extractJsonArray(text);

  const raw = parseJsonArrayTolerant(jsonText) as Array<{
    title?: string;
    url?: string;
    snippet?: string;
  }>;

  if (raw.length === 0) {
    console.error(
      "[gemini-grounded] JSON parse failed or empty. Raw text:",
      text.slice(0, 1200)
    );
    throw new Error(
      `Gemini grounded search returned no parseable items. Raw: ${text.slice(0, 300)}`
    );
  }

  const items: GoogleNewsResult[] = [];
  const seen = new Set<string>();

  for (const it of raw) {
    const title = typeof it.title === "string" ? it.title.trim() : "";
    const url = typeof it.url === "string" ? it.url.trim() : "";
    const snippet = typeof it.snippet === "string" ? it.snippet.trim() : "";
    if (!title || !url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const urlHash = hashUrl(url);
    await prisma.newsItem.upsert({
      where: { urlHash },
      create: { url, urlHash, title, snippet: snippet || null },
      update: { title, snippet: snippet || undefined },
    });

    items.push({ title, link: url, snippet });
  }

  return items;
}
