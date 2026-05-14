/**
 * Structured stdout logging for Gemini / multimodal calls (terminal + Vercel).
 *
 * Env:
 * - AI_LOG_OFF=true — disable all [ai] logs
 * - AI_LOG_FULL=true — log full prompt / response text (no head truncation)
 * - AI_LOG_HEAD_CHARS=<n> — max chars for promptHead / responseHead (default: 1200 dev, 600 prod)
 */

export type AiLogMeta = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AiLogPhase = "start" | "done" | "error" | "event";

function aiLogDisabled(): boolean {
  return process.env.AI_LOG_OFF === "true";
}

export function aiLogFull(): boolean {
  return process.env.AI_LOG_FULL === "true";
}

/** Head limit for truncated prompt/response fields (ignored when AI_LOG_FULL=true). */
export function effectiveHeadChars(): number {
  const raw = process.env.AI_LOG_HEAD_CHARS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return process.env.NODE_ENV === "development" ? 1200 : 600;
}

export function truncateForLog(text: string): string {
  if (!text) return "";
  if (aiLogFull()) return text;
  const max = effectiveHeadChars();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function scrubMeta(meta: AiLogMeta): AiLogMeta {
  const out: AiLogMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Single-line JSON log prefixed with `[ai]` for grep/filter.
 * Prefer `phase` in meta: start | done | error | event (default event).
 */
export function logAiCall(
  label: string,
  meta: AiLogMeta & { phase?: AiLogPhase } = {}
): void {
  if (aiLogDisabled()) return;
  const phase: AiLogPhase = meta.phase ?? "event";
  const { phase: _p, ...rest } = meta;
  const payload = scrubMeta({
    phase,
    label,
    t: new Date().toISOString(),
    ...rest,
  });
  console.info("[ai]", JSON.stringify(payload));
}

export async function withAiLog<T>(
  label: string,
  meta: AiLogMeta & { prompt?: string; promptImages?: number },
  fn: () => Promise<T>,
  toResponseSummary?: (out: T) => {
    responseText?: string;
    ok?: boolean;
    extra?: AiLogMeta;
  }
): Promise<T> {
  if (aiLogDisabled()) {
    return fn();
  }

  const headLimit = effectiveHeadChars();
  const { prompt, promptImages, ...restMeta } = meta as AiLogMeta & {
    prompt?: string;
    promptImages?: number;
  };

  const startPayload: AiLogMeta & { phase: AiLogPhase } = {
    phase: "start",
    ...scrubMeta(restMeta as AiLogMeta),
  };
  if (prompt !== undefined) {
    startPayload.promptLen = prompt.length;
    if (aiLogFull()) {
      startPayload.promptFull = prompt;
    } else {
      startPayload.promptHead =
        prompt.length <= headLimit ? prompt : `${prompt.slice(0, headLimit)}…`;
    }
  }
  if (promptImages !== undefined) {
    startPayload.promptImages = promptImages;
  }

  logAiCall(label, startPayload);

  const t0 = Date.now();
  try {
    const out = await fn();
    const latencyMs = Date.now() - t0;
    const summary = toResponseSummary?.(out);
    const donePayload: AiLogMeta & { phase: AiLogPhase } = {
      phase: "done",
      latencyMs,
      ok: summary?.ok ?? true,
      ...scrubMeta(summary?.extra ?? {}),
    };
    const rt = summary?.responseText;
    if (rt !== undefined) {
      donePayload.responseLen = rt.length;
      if (aiLogFull()) {
        donePayload.responseFull = rt;
      } else {
        donePayload.responseHead =
          rt.length <= headLimit ? rt : `${rt.slice(0, headLimit)}…`;
      }
    }
    logAiCall(label, donePayload);
    return out;
  } catch (e) {
    const latencyMs = Date.now() - t0;
    logAiCall(label, {
      phase: "error",
      latencyMs,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
