import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      topicId: true,
      campaignId: true,
      sourceNewsId: true,
      scheduledAt: true,
      publishedAt: true,
      failureCount: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      topic: true,
      sourceNews: true,
      variants: {
        orderBy: { platform: "asc" },
        include: { media: { orderBy: { createdAt: "asc" } } },
      },
      publishLogs: { orderBy: { attemptAt: "desc" }, take: 20 },
    },
  });

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = (await req.json()) as {
    variants?: Array<{
      id: string;
      caption?: string;
      hashtags?: string;
      title?: string;
      slug?: string;
      bodyMd?: string;
    }>;
  };

  if (body.variants) {
    for (const v of body.variants) {
      await prisma.postVariant.update({
        where: { id: v.id },
        data: {
          caption: v.caption,
          hashtags: v.hashtags,
          title: v.title,
          slug: v.slug,
          bodyMd: v.bodyMd,
        },
      });
    }
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      topicId: true,
      campaignId: true,
      sourceNewsId: true,
      scheduledAt: true,
      publishedAt: true,
      failureCount: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      topic: true,
      sourceNews: true,
      variants: {
        orderBy: { platform: "asc" },
        include: { media: { orderBy: { createdAt: "asc" } } },
      },
      publishLogs: { orderBy: { attemptAt: "desc" }, take: 20 },
    },
  });

  return NextResponse.json(post);
}
