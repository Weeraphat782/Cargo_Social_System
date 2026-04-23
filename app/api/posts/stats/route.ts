import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PostStatus } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, approved, scheduled, published, topics] = await Promise.all([
    prisma.post.count({ where: { status: PostStatus.PENDING_APPROVAL } }),
    prisma.post.count({ where: { status: PostStatus.APPROVED } }),
    prisma.post.count({ where: { status: PostStatus.SCHEDULED } }),
    prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
    prisma.topic.count(),
  ]);

  return NextResponse.json({ pending, approved, scheduled, published, topics });
}
