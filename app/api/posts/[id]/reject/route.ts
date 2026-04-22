import { NextResponse } from "next/server";
import { PostStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  await prisma.post.update({
    where: { id },
    data: { status: PostStatus.REJECTED },
  });

  return NextResponse.json({ ok: true });
}
