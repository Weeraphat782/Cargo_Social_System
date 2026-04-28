import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { invalidateBrandTemplateCache } from "@/lib/brands/registry";
import { parseBrandTemplateFromDb } from "@/lib/brands/payload-schema";

const patchZ = z.object({
  displayName: z.string().min(1).optional(),
  payload: z.unknown().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const row = await prisma.brandTemplateMaster.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const row = await prisma.brandTemplateMaster.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchZ.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const displayName = body.displayName ?? row.displayName;
  const payload = body.payload ?? row.payload;
  if (body.payload != null) {
    try {
      parseBrandTemplateFromDb(slug, displayName, payload);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid payload" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.brandTemplateMaster.update({
    where: { slug },
    data: {
      ...(body.displayName != null ? { displayName: body.displayName } : {}),
      ...(body.payload != null ? { payload: body.payload } : {}),
    },
  });
  invalidateBrandTemplateCache();
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const row = await prisma.brandTemplateMaster.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.isSystem) {
    return NextResponse.json({ error: "Cannot delete the system (OMG) brand" }, { status: 400 });
  }
  await prisma.brandTemplateMaster.delete({ where: { slug } });
  invalidateBrandTemplateCache();
  return NextResponse.json({ ok: true });
}
