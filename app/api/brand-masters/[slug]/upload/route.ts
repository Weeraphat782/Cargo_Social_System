import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { uploadPublicImage } from "@/lib/storage/r2";
import { parseBrandTemplateFromDb, templateToJsonPayload } from "@/lib/brands/payload-schema";
import { invalidateBrandTemplateCache } from "@/lib/brands/registry";
import type { BrandAssets } from "@/lib/brands/types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_IMAGES = 5;

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const row = await prisma.brandTemplateMaster.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
  }

  // Parse current template to get existing referenceImages
  const template = parseBrandTemplateFromDb(slug, row.displayName, row.payload);
  const existing = template.brandAssets?.referenceImages ?? [];
  if (existing.length >= MAX_IMAGES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_IMAGES} reference images per brand` },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `brand-assets/${slug}/ref/${Date.now()}.${ext}`;
  const imageUrl = await uploadPublicImage(key, buffer, file.type);

  // Merge new URL into brandAssets.referenceImages and save
  const updatedAssets: BrandAssets = {
    ...template.brandAssets,
    referenceImages: [...existing, imageUrl],
  };
  const updatedTemplate = { ...template, brandAssets: updatedAssets };
  const newPayload = templateToJsonPayload(updatedTemplate);

  await prisma.brandTemplateMaster.update({
    where: { slug },
    data: { payload: newPayload },
  });
  invalidateBrandTemplateCache();

  return NextResponse.json({ imageUrl, total: updatedAssets.referenceImages!.length });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const row = await prisma.brandTemplateMaster.findUnique({ where: { slug } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { imageUrl } = (await req.json()) as { imageUrl?: string };
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  const template = parseBrandTemplateFromDb(slug, row.displayName, row.payload);
  const filtered = (template.brandAssets?.referenceImages ?? []).filter((u) => u !== imageUrl);

  const updatedTemplate = {
    ...template,
    brandAssets: { ...template.brandAssets, referenceImages: filtered },
  };
  await prisma.brandTemplateMaster.update({
    where: { slug },
    data: { payload: templateToJsonPayload(updatedTemplate) },
  });
  invalidateBrandTemplateCache();

  return NextResponse.json({ ok: true, remaining: filtered.length });
}
