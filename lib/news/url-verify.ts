/**
 * Verifies a public URL is reachable and returns a canonical URL after redirects,
 * with common tracking query params stripped.
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_EXACT = new Set(
  "fbclid gclid mc_eid igshid _ga _gl".split(" ")
);

/** Strip UTM, fbclid, etc. and hash for a cleaner canonical URL. */
export function stripTrackingQueryParams(inputUrl: string): string {
  try {
    const u = new URL(inputUrl);
    const keys = [...u.searchParams.keys()];
    for (const k of keys) {
      const low = k.toLowerCase();
      if (
        TRACKING_PARAM_EXACT.has(low) ||
        TRACKING_PARAM_PREFIXES.some((p) => low.startsWith(p))
      ) {
        u.searchParams.delete(k);
      }
    }
    u.hash = "";
    return u.toString();
  } catch {
    return inputUrl;
  }
}

/**
 * @returns Final URL if HEAD/GET returns success (2xx), else null. Uses redirect: follow.
 * Strict: 4xx/5xx, errors, and timeouts yield null.
 */
export async function verifyUrl(
  url: string,
  timeoutMs = 5000
): Promise<string | null> {
  const toFetch = url.trim();
  if (!/^https?:\/\//i.test(toFetch)) return null;

  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  const doFetch = (
    method: "HEAD" | "GET",
    extra?: Record<string, string>
  ): Promise<Response> => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(toFetch, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { ...headers, ...extra },
    })
      .finally(() => clearTimeout(t));
  };

  let res: Response;
  try {
    res = await doFetch("HEAD");
  } catch {
    return null;
  }

  if (res.status === 405 || res.status === 501) {
    try {
      res = await doFetch("GET", { Range: "bytes=0-0" });
    } catch {
      return null;
    }
  }

  if (!res.ok || res.status >= 400) {
    return null;
  }

  return stripTrackingQueryParams(res.url);
}

/** Dedup key: origin + pathname (ignores tracking-heavy query). */
export function urlDedupKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url;
  }
}
