import { NextResponse } from "next/server";
import { PostStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { executePublishPost } from "@/lib/publish-run";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.status !== PostStatus.APPROVED) {
    return NextResponse.json(
      { error: "Post must be approved before publishing" },
      { status: 400 }
    );
  }

  try {
    await executePublishPost(id);
    const updated = await prisma.post.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish failed" },
      { status: 500 }
    );
  }
}
