import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deletePublicFileByUrl } from "@/lib/storage/r2";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const strategy = await prisma.marketingStrategy.findUnique({
    where: { id },
    include: {
      drafts: { orderBy: { orderIndex: "asc" } },
      campaigns: {
        select: { id: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!strategy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const master = await prisma.brandTemplateMaster.findUnique({
    where: { slug: strategy.brandTemplateId },
    select: { displayName: true },
  });

  return NextResponse.json({
    strategy: {
      id: strategy.id,
      name: strategy.name,
      brandTemplateId: strategy.brandTemplateId,
      brandDisplayName: master?.displayName ?? strategy.brandTemplateId,
      status: strategy.status,
      summary: strategy.summary,
      sourceFileUrl: strategy.sourceFileUrl,
      sourceFileName: strategy.sourceFileName,
      analyzeError: strategy.analyzeError,
      createdAt: strategy.createdAt.toISOString(),
      updatedAt: strategy.updatedAt.toISOString(),
    },
    drafts: strategy.drafts.map((d) => ({
      id: d.id,
      orderIndex: d.orderIndex,
      status: d.status,
      rationale: d.rationale,
      sourceQuote: d.sourceQuote,
      payload: d.payload,
      createdCampaignId: d.createdCampaignId,
    })),
    campaigns: strategy.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const strategy = await prisma.marketingStrategy.findUnique({
    where: { id },
    select: {
      id: true,
      sourceFileUrl: true,
      drafts: {
        where: { createdCampaignId: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!strategy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (strategy.drafts.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete: campaigns were already created from this strategy" },
      { status: 409 }
    );
  }

  const url = strategy.sourceFileUrl;
  await prisma.marketingStrategy.delete({ where: { id } });

  try {
    await deletePublicFileByUrl(url);
  } catch (e) {
    console.warn("[strategies] R2 delete failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true });
}
