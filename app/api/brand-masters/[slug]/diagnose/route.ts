import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { brandPromptTemplatePayloadZ } from "@/lib/brands/payload-schema";

/** Validate BrandTemplateMaster.payload against the app Zod schema (for debugging bhutan12-style issues). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug: rawSlug } = await ctx.params;
  const slug = decodeURIComponent(rawSlug);

  const row = await prisma.brandTemplateMaster.findUnique({
    where: { slug },
    select: { slug: true, payload: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safe = brandPromptTemplatePayloadZ.safeParse(row.payload);
  return NextResponse.json({
    slug: row.slug,
    ok: safe.success,
    issues: safe.success ? undefined : safe.error.flatten(),
  });
}
