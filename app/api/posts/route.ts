import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PostStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const statuses = statusParam
    ? (statusParam.split(",").filter(Boolean) as PostStatus[])
    : null;

  const posts = await prisma.post.findMany({
    where: statuses?.length
      ? { status: { in: statuses } }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      publishedAt: true,
      failureCount: true,
      lastError: true,
      topic: { select: { name: true } },
      sourceNews: { select: { title: true, url: true } },
      variants: {
        orderBy: { platform: "asc" },
        select: {
          id: true,
          platform: true,
          caption: true,
          hashtags: true,
          bodyMd: true,
          title: true,
          slug: true,
          publishedAt: true,
          remoteId: true,
          media: {
            select: { id: true, imageUrl: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  /** Strip huge base64 data URLs from list payload (keeps JSON small and fast to parse). */
  const trimmed = posts.map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      media: v.media.map((m) =>
        m.imageUrl.startsWith("data:")
          ? { ...m, imageUrl: "" }
          : m
      ),
    })),
  }));

  return NextResponse.json(trimmed);
}
