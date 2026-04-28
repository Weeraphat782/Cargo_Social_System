import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isBrandTemplateId } from "@/lib/brands/registry";

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
    brandTemplateId?: string;
  };

  if (body.brandTemplateId != null) {
    if (!(await isBrandTemplateId(body.brandTemplateId.trim()))) {
      return NextResponse.json({ error: "invalid brandTemplateId" }, { status: 400 });
    }
  }

  const data = { ...body };
  if (body.brandTemplateId != null) {
    data.brandTemplateId = body.brandTemplateId.trim();
  }

  const t = await prisma.topic.update({
    where: { id },
    data,
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
