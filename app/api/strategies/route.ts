import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { uploadPublicFile } from "@/lib/storage/r2";
import { isBrandTemplateId } from "@/lib/brands/registry";

const MAX_BYTES = 20 * 1024 * 1024;

function sanitizeBasename(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 120);
  return base.length ? base : "strategy";
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.marketingStrategy.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { drafts: true, campaigns: true } },
    },
  });

  const slugs = [...new Set(rows.map((r) => r.brandTemplateId))];
  const masters = await prisma.brandTemplateMaster.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, displayName: true },
  });
  const brandLabel = Object.fromEntries(masters.map((m) => [m.slug, m.displayName]));

  return NextResponse.json({
    strategies: rows.map((r) => ({
      id: r.id,
      name: r.name,
      brandTemplateId: r.brandTemplateId,
      brandDisplayName: brandLabel[r.brandTemplateId] ?? r.brandTemplateId,
      status: r.status,
      draftCount: r._count.drafts,
      campaignCount: r._count.campaigns,
      updatedAt: r.updatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const brandRaw =
    typeof formData.get("brandTemplateId") === "string"
      ? (formData.get("brandTemplateId") as string).trim()
      : "";
  const nameRaw =
    typeof formData.get("name") === "string"
      ? (formData.get("name") as string).trim()
      : "";

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (mime !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be at most 20 MB" }, { status: 400 });
  }

  let brandTemplateId = "omg";
  if (brandRaw) {
    if (!(await isBrandTemplateId(brandRaw))) {
      return NextResponse.json({ error: "invalid brandTemplateId" }, { status: 400 });
    }
    brandTemplateId = brandRaw;
  }

  const originalName =
    file instanceof File && file.name ? file.name : "strategy.pdf";
  const safeStem = sanitizeBasename(originalName.replace(/\.pdf$/i, ""));
  const folder = randomUUID();
  const key = `strategies/${folder}/${safeStem}.pdf`;

  let sourceFileUrl: string;
  try {
    sourceFileUrl = await uploadPublicFile(key, buf, "application/pdf");
  } catch (e) {
    console.error("[strategies] R2 upload failed:", e);
    return NextResponse.json(
      { error: "Failed to store PDF (check R2 configuration)" },
      { status: 500 }
    );
  }

  const strategyName =
    nameRaw || safeStem.replace(/_/g, " ").trim() || "Marketing strategy";

  const row = await prisma.marketingStrategy.create({
    data: {
      name: strategyName,
      brandTemplateId,
      status: "UPLOADED",
      sourceFileUrl,
      sourceFileName: originalName,
      sourceMimeType: "application/pdf",
      sourceBytes: buf.length,
    },
  });

  return NextResponse.json({ id: row.id });
}
