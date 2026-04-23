import { searchNews as searchNewsCSE } from "./google";
import { searchNewsWithGemini } from "./gemini-grounded";
import type { GoogleNewsResult } from "./google";

let cseNotConfiguredInfoLogged = false;

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
 * Dispatcher — prefers Google Custom Search when configured (real URLs, fewer hallucinations),
 * otherwise uses Gemini Google Search grounding + `groundingMetadata` URLs.
 * On CSE failure (quota, network), falls back to Gemini.
 */
export async function searchNews(
  query: string,
  options?: { num?: number }
): Promise<GoogleNewsResult[]> {
  if (!cseConfigured()) {
    if (!cseNotConfiguredInfoLogged) {
      cseNotConfiguredInfoLogged = true;
      console.info(
        "[searchNews] GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID are not both set; using Gemini grounded search. For production, enable Custom Search API — see .env.example."
      );
    }
    return searchNewsWithGemini(query, options);
  }

  try {
    return await searchNewsCSE(query, options);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      "[searchNews] Google CSE failed, falling back to Gemini grounded search:",
      msg
    );
    return searchNewsWithGemini(query, options);
  }
}

export type { GoogleNewsResult };
export { searchNewsWithGemini };
