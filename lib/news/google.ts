import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";

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
    num: String(num),
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
  for (const it of data.items ?? []) {
    if (!it.link || !it.title) continue;
    const urlHash = hashUrl(it.link);
    await prisma.newsItem.upsert({
      where: { urlHash },
      create: {
        url: it.link,
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
      link: it.link,
      snippet: it.snippet ?? "",
    });
  }

  return items;
}

export async function getOrCreateNewsItem(url: string, title: string, snippet?: string) {
  const urlHash = hashUrl(url);
  return prisma.newsItem.upsert({
    where: { urlHash },
    create: { url, urlHash, title, snippet: snippet ?? null },
    update: { title, snippet: snippet ?? undefined },
  });
}
