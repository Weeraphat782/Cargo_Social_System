import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: postId } = await ctx.params;

  const body = (await req.json()) as {
    variantId: string;
    imageUrl: string;
    prompt: string;
  };

  if (!body.variantId || !body.imageUrl || typeof body.prompt !== "string") {
    return NextResponse.json(
      { error: "variantId, imageUrl, and prompt required" },
      { status: 400 }
    );
  }

  const variant = await prisma.postVariant.findFirst({
    where: { id: body.variantId, postId },
    include: { media: true },
  });
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  const media = variant.media[0];
  if (media) {
    await prisma.media.update({
      where: { id: media.id },
      data: { imageUrl: body.imageUrl, prompt: body.prompt },
    });
  } else {
    await prisma.media.create({
      data: {
        variantId: variant.id,
        imageUrl: body.imageUrl,
        prompt: body.prompt,
      },
    });
  }

  return NextResponse.json({ ok: true, imageUrl: body.imageUrl });
}
