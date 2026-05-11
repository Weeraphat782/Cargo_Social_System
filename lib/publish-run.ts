import { PostStatus, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { publishPostVariant } from "@/lib/publishers";

function buildCaption(
  platform: Platform,
  caption: string,
  hashtags: string | null
): string {
  if (platform === "INSTAGRAM" && hashtags) {
    return `${caption}\n\n${hashtags}`.trim();
  }
  return caption;
}

export async function executePublishPost(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      variants: {
        include: { media: true },
      },
    },
  });

  if (!post) throw new Error("Post not found");
  if (post.status !== PostStatus.APPROVED && post.status !== PostStatus.SCHEDULED) {
    throw new Error("Post not ready to publish");
  }

  const platforms: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"];
  let anyFail = false;

  for (const platform of platforms) {
    const v = post.variants.find((x) => x.platform === platform);
    if (!v) continue;
    const imageUrls = v.media.map((m) => m.imageUrl).filter(Boolean);
    const caption = buildCaption(platform, v.caption, v.hashtags);

    try {
      const { remoteId } = await publishPostVariant(platform, {
        caption,
        imageUrls,
        title: v.title ?? undefined,
        bodyMd: v.bodyMd ?? undefined,
        slug: v.slug ?? undefined,
      });

      await prisma.postVariant.update({
        where: { id: v.id },
        data: { remoteId, publishedAt: new Date() },
      });

      await prisma.publishLog.create({
        data: {
          postId,
          platform,
          success: true,
          remoteId,
        },
      });
    } catch (err) {
      anyFail = true;
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.publishLog.create({
        data: {
          postId,
          platform,
          success: false,
          errorMessage: msg,
        },
      });
    }
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: anyFail ? PostStatus.FAILED : PostStatus.PUBLISHED,
      publishedAt: anyFail ? undefined : new Date(),
      lastError: anyFail ? "One or more platforms failed — see publish logs" : null,
    },
  });
}
