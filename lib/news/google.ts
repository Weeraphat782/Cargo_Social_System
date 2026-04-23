import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { urlDedupKey, verifyUrl } from "./url-verify";

export type GoogleNewsResult = {
  title: string;
  link: string;
  snippet: string;
};

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/**
 * Google Custom Search JSON API — upserts NewsItem rows and returns results (dedup by DB unique url).
 */
export async function searchNews(
  query: string,
  options?: { num?: number }
): Promise<GoogleNewsResult[]> {
  const key = requireEnv("GOOGLE_CSE_API_KEY");
  const cx = requireEnv("GOOGLE_CSE_ID");
  const num = Math.min(options?.num ?? 10, 10);

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: String(Math.min(10, num * 2)),
    sort: "date",
    dateRestrict: "m6",
  });

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google CSE error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const items: GoogleNewsResult[] = [];
  const usedKeys = new Set<string>();

  for (const it of data.items ?? []) {
    if (!it.link || !it.title) continue;
    if (items.length >= num) break;
    const canonical = await verifyUrl(it.link);
    if (!canonical) continue;
    const key = urlDedupKey(canonical);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);

    const urlHash = hashUrl(canonical);
    await prisma.newsItem.upsert({
      where: { urlHash },
      create: {
        url: canonical,
        urlHash,
        title: it.title,
        snippet: it.snippet ?? null,
      },
      update: {
        title: it.title,
        snippet: it.snippet ?? undefined,
      },
    });

    items.push({
      title: it.title,
      link: canonical,
      snippet: it.snippet ?? "",
    });
  }

  const cseItemCount = data.items?.length ?? 0;
  if (items.length < num && cseItemCount > 0) {
    console.info(
      `[CSE] Requested up to ${num} verified result(s); got ${items.length} after strict URL check (from ${cseItemCount} CSE item(s))`
    );
  }

  return items;
}

export async function getOrCreateNewsItem(url: string, title: string, snippet?: string) {
  const canonical = await verifyUrl(url);
  if (!canonical) {
    throw new Error(`URL could not be verified: ${url}`);
  }
  const urlHash = hashUrl(canonical);
  return prisma.newsItem.upsert({
    where: { urlHash },
    create: { url: canonical, urlHash, title, snippet: snippet ?? null },
    update: { title, snippet: snippet ?? undefined },
  });
}
