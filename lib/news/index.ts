import { searchNews as searchNewsCSE } from "./google";
import { searchNewsWithGemini } from "./gemini-grounded";
import type { GoogleNewsResult } from "./google";

function isConfigured(value: string | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  if (t === "" || t === "...") return false;
  return true;
}

function cseConfigured(): boolean {
  return (
    isConfigured(process.env.GOOGLE_CSE_API_KEY) &&
    isConfigured(process.env.GOOGLE_CSE_ID)
  );
}

/**
 * Dispatcher — prefers Google Custom Search when configured,
 * otherwise uses Gemini Google Search grounding (fewer setup steps, uses GEMINI_API_KEY).
 */
export async function searchNews(
  query: string,
  options?: { num?: number }
): Promise<GoogleNewsResult[]> {
  if (cseConfigured()) {
    return searchNewsCSE(query, options);
  }
  return searchNewsWithGemini(query, options);
}

export type { GoogleNewsResult };
export { searchNewsWithGemini };
