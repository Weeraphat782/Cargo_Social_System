import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PostStatus } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [postStatsGroup, topics] = await Promise.all([
    prisma.post.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.topic.count(),
  ]);

  const statsMap = Object.fromEntries(postStatsGroup.map((g) => [g.status, g._count._all]));
  const pending = statsMap[PostStatus.PENDING_APPROVAL] || 0;
  const approved = statsMap[PostStatus.APPROVED] || 0;
  const scheduled = statsMap[PostStatus.SCHEDULED] || 0;
  const published = statsMap[PostStatus.PUBLISHED] || 0;

  return NextResponse.json({ pending, approved, scheduled, published, topics });
}
