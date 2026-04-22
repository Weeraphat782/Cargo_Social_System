import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = (await req.json()) as {
    name?: string;
    keywords?: string;
    brandVoice?: string | null;
    active?: boolean;
  };

  const t = await prisma.topic.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(t);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
