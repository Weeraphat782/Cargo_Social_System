import { requireEnv } from "@/lib/env";
import type { PublishInput, PublishResult } from "./types";

export type OmgNewsroomPayload = {
  title: string;
  slug: string;
  summary: string;
  bodyMd: string;
  heroImageUrl: string;
  category?: string;
  publishedAt?: string;
};

/**
 * POST to OMG site — expects Bearer OMG_AGENT_TOKEN on the OMG side.
 */
export async function publishOmgNewsroom(input: PublishInput): Promise<PublishResult> {
  const base = requireEnv("OMG_API_BASE").replace(/\/$/, "");
  const token = requireEnv("OMG_AGENT_TOKEN");

  const title = input.title ?? input.caption.slice(0, 120);
  const slug =
    input.slug ??
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) + `-${Date.now()}`;

  const body: OmgNewsroomPayload = {
    title,
    slug,
    summary: input.caption.slice(0, 500),
    bodyMd: input.bodyMd ?? `## ${title}\n\n${input.caption}`,
    heroImageUrl: input.imageUrl,
    category: "News",
    publishedAt: new Date().toISOString(),
  };

  const res = await fetch(`${base}/api/newsroom/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as { id?: string; slug?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `OMG API ${res.status}`);
  }

  return { remoteId: json.id ?? json.slug ?? slug, raw: json };
}
