import { NextResponse } from "next/server";
import { PostStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { publishPostVariant } from "@/lib/publishers";

/**
 * Approve & publish a single post variant (one platform at a time).
 * - Publishes only the requested variant
 * - Updates the parent Post status based on aggregate variant states:
 *   - PUBLISHED when every variant has published
 *   - FAILED when any variant has failed
 *   - otherwise the post stays in its current approval state
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; variantId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId, variantId } = await ctx.params;

  const variant = await prisma.postVariant.findFirst({
    where: { id: variantId, postId },
    include: { media: true },
  });
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }
  if (variant.publishedAt) {
    return NextResponse.json(
      { error: "Variant already published" },
      { status: 400 }
    );
  }

  const caption =
    variant.platform === "INSTAGRAM" && variant.hashtags
      ? `${variant.caption}\n\n${variant.hashtags}`.trim()
      : variant.caption;
  const imageUrls = variant.media.map((m) => m.imageUrl).filter(Boolean);

  try {
    const { remoteId } = await publishPostVariant(variant.platform, {
      caption,
      imageUrls,
      title: variant.title ?? undefined,
      bodyMd: variant.bodyMd ?? undefined,
      slug: variant.slug ?? undefined,
    });

    await prisma.postVariant.update({
      where: { id: variant.id },
      data: { remoteId, publishedAt: new Date() },
    });
    await prisma.publishLog.create({
      data: { postId, platform: variant.platform, success: true, remoteId },
    });

    await reconcilePostStatus(postId);

    return NextResponse.json({ ok: true, remoteId, platform: variant.platform });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.publishLog.create({
      data: {
        postId,
        platform: variant.platform,
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function reconcilePostStatus(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { variants: true, publishLogs: { orderBy: { attemptAt: "desc" } } },
  });
  if (!post) return;

  const total = post.variants.length;
  const publishedCount = post.variants.filter((v) => v.publishedAt).length;

  const recentFailures = new Set<string>();
  for (const log of post.publishLogs) {
    const key = `${log.platform}`;
    if (recentFailures.has(key)) continue;
    // Take the most recent log per platform
    if (!log.success) recentFailures.add(key);
    else recentFailures.delete(key);
  }

  // Determine latest per-platform outcome (true=published, false=failed)
  const latestByPlatform = new Map<string, boolean>();
  for (const log of post.publishLogs) {
    if (!latestByPlatform.has(log.platform)) {
      latestByPlatform.set(log.platform, log.success);
    }
  }
  const anyFailed = Array.from(latestByPlatform.values()).some((v) => v === false);

  let nextStatus = post.status;
  if (publishedCount === total) {
    nextStatus = PostStatus.PUBLISHED;
  } else if (publishedCount > 0) {
    nextStatus = PostStatus.APPROVED; // partial — remain actionable
  }

  const data: {
    status: PostStatus;
    publishedAt?: Date | null;
    lastError?: string | null;
  } = { status: nextStatus };

  if (nextStatus === PostStatus.PUBLISHED) {
    data.publishedAt = new Date();
    data.lastError = null;
  } else if (anyFailed) {
    data.lastError = "One or more platforms failed — see publish logs";
  }

  await prisma.post.update({ where: { id: postId }, data });
}
