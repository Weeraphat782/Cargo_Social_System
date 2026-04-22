/**
 * Copy to your OMG Next.js app as: app/api/newsroom/posts/route.ts
 * Implement persistNewsroomPost() to match your schema (Prisma, MDX files, etc.).
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = {
  title: string;
  slug: string;
  summary: string;
  bodyMd: string;
  heroImageUrl: string;
  category?: string;
  publishedAt?: string;
};

async function persistNewsroomPost(body: Body): Promise<{ id: string }> {
  void body;
  // TODO: insert into your DB or write MDX under /content/newsroom, upload images, etc.
  throw new Error("Implement persistNewsroomPost for OMG site");
}

export async function POST(req: NextRequest) {
  const token = process.env.OMG_AGENT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "OMG_AGENT_TOKEN not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.slug || !body.bodyMd || !body.heroImageUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const saved = await persistNewsroomPost(body);
    return NextResponse.json({ ok: true, id: saved.id, slug: body.slug });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
