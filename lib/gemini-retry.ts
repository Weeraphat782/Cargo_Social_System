/**
 * Retry wrapper for Gemini API calls that gracefully handles transient errors
 * (503 UNAVAILABLE, 429 rate limit, network blips) with exponential backoff.
 */

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getErrorStatus(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const err = e as { status?: number; message?: string };
  if (typeof err.status === "number") return err.status;
  const msg = err.message ?? "";
  const m = msg.match(/"code":\s*(\d{3})/);
  return m ? Number(m[1]) : undefined;
}

export function isRetryableGeminiError(e: unknown): boolean {
  const status = getErrorStatus(e);
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("rate limit")
  );
}

export async function withGeminiRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelay = options?.baseDelayMs ?? 1500;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts || !isRetryableGeminiError(e)) {
        throw e;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
      const status = getErrorStatus(e);
      console.warn(
        `[gemini-retry] ${label} attempt ${attempt}/${maxAttempts} failed${
          status ? ` (HTTP ${status})` : ""
        }. Retrying in ${Math.round(delay)}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
