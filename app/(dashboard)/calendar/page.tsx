import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CampaignStatus, PostStatus } from "@prisma/client";
import CalendarClient from "./calendar-client";

const postSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  publishedAt: true,
  topic: { select: { name: true } },
  variants: { select: { platform: true } },
} as const;

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [scheduledRows, publishedRows, upcomingCampaigns] = await Promise.all([
    prisma.post.findMany({
      where: { status: PostStatus.SCHEDULED },
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: postSelect,
    }),
    prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: postSelect,
    }),
    prisma.campaign.findMany({
      where: { status: CampaignStatus.ACTIVE, nextRunAt: { not: null } },
      orderBy: { nextRunAt: "asc" },
      take: 50,
      select: { id: true, name: true, nextRunAt: true, postsPerRun: true, platforms: true },
    }),
  ]);

  const mapPost = (p: (typeof scheduledRows)[number]) => ({
    ...p,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  });

  const scheduledPosts = scheduledRows.map(mapPost);
  const publishedPosts = publishedRows.map(mapPost);

  const upcoming = upcomingCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    nextRunAt: c.nextRunAt!.toISOString(),
    postsPerRun: c.postsPerRun,
    platforms: c.platforms,
  }));

  return <CalendarClient scheduledPosts={scheduledPosts} publishedPosts={publishedPosts} upcomingCampaigns={upcoming} />;
}
