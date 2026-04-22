import { NextResponse } from "next/server";
import { PostStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    scheduledAt?: string | null;
  };

  if (body.scheduledAt) {
    const scheduledAt = new Date(body.scheduledAt);
    await prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.SCHEDULED,
        scheduledAt,
      },
    });
  } else {
    await prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.APPROVED,
        scheduledAt: null,
      },
    });
  }

  const post = await prisma.post.findUnique({ where: { id } });
  return NextResponse.json(post);
}
