import { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Same `select` as `GET /api/posts` (list). */
export const POST_LIST_SELECT = {
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
} as const;

export type PostListRowJson = {
  id: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  failureCount: number;
  lastError: string | null;
  topic: { name: string } | null;
  sourceNews: { title: string; url: string } | null;
  variants: Array<{
    id: string;
    platform: string;
    caption: string;
    hashtags: string | null;
    bodyMd: string | null;
    title: string | null;
    slug: string | null;
    publishedAt: string | null;
    remoteId: string | null;
    media: Array<{ id: string; imageUrl: string }>;
  }>;
};

function trimMediaDataUrls(
  posts: Array<{
    id: string;
    status: string;
    createdAt: Date;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    failureCount: number;
    lastError: string | null;
    topic: { name: string } | null;
    sourceNews: { title: string; url: string } | null;
    variants: Array<{
      id: string;
      platform: string;
      caption: string;
      hashtags: string | null;
      bodyMd: string | null;
      title: string | null;
      slug: string | null;
      publishedAt: Date | null;
      remoteId: string | null;
      media: Array<{ id: string; imageUrl: string }>;
    }>;
  }>
): PostListRowJson[] {
  return posts.map((p) => ({
    id: p.id,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    failureCount: p.failureCount,
    lastError: p.lastError,
    topic: p.topic,
    sourceNews: p.sourceNews,
    variants: p.variants.map((v) => ({
      ...v,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      media: v.media.map((m) =>
        m.imageUrl.startsWith("data:") ? { ...m, imageUrl: "" } : m
      ),
    })),
  }));
}

/**
 * Fetches posts for queue / API; strips huge base64 data URLs from the JSON payload.
 */
export async function fetchPostsByStatuses(
  statuses: PostStatus[] | null,
  take: number
): Promise<PostListRowJson[]> {
  const posts = await prisma.post.findMany({
    where: statuses?.length ? { status: { in: statuses } } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: POST_LIST_SELECT,
  });
  return trimMediaDataUrls(posts);
}
