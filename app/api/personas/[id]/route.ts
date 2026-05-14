import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const persona = await prisma.persona.findUnique({ where: { id } });
  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(persona);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    role?: string | null;
    demographics?: string | null;
    painPoints?: string | null;
    goals?: string | null;
    description?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.role !== undefined) data.role = body.role?.trim() || null;
  if (body.demographics !== undefined) data.demographics = body.demographics?.trim() || null;
  if (body.painPoints !== undefined) data.painPoints = body.painPoints?.trim() || null;
  if (body.goals !== undefined) data.goals = body.goals?.trim() || null;
  if (body.description !== undefined) data.description = body.description.trim();

  const persona = await prisma.persona.update({ where: { id }, data });
  return NextResponse.json(persona);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.persona.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
