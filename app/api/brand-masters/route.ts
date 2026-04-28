import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureBrandTemplatesLoaded, getBrandTemplate, invalidateBrandTemplateCache } from "@/lib/brands/registry";
import { parseBrandTemplateFromDb, templateToJsonPayload } from "@/lib/brands/payload-schema";

const slugZ = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, "Use lowercase, digits, hyphens; start with a letter");

const postBodyZ = z.object({
  slug: slugZ,
  displayName: z.string().min(1),
  cloneFrom: z.string().min(1).optional(),
  payload: z.unknown().optional(),
});

/** `payload: {}` is truthy but not a real template; must fall through to `cloneFrom`. */
function isMeaningfulPayload(v: unknown): v is object {
  return v != null && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.brandTemplateMaster.findMany({
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      displayName: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ brands: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postBodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const { slug, displayName, cloneFrom, payload: rawPayload } = parsed.data;

  let payloadJson: unknown;
  if (isMeaningfulPayload(rawPayload)) {
    payloadJson = rawPayload;
  } else if (cloneFrom) {
    await ensureBrandTemplatesLoaded();
    const src = await getBrandTemplate(cloneFrom);
    payloadJson = templateToJsonPayload({
      ...src,
      id: slug,
      displayName,
    });
  } else {
    return NextResponse.json(
      {
        error: "Send a full `payload` (non-empty object) or `cloneFrom` (e.g. omg) to copy an existing brand.",
      },
      { status: 400 }
    );
  }

  try {
    parseBrandTemplateFromDb(slug, displayName, payloadJson);
  } catch (e) {
    const hint =
      "A brand template must include all fields in the OMG shape (strategistTagline, services, themeBundles, suggestCampaign, selfPromo, etc.). " +
      "Use clone from an existing brand (e.g. omg) in the form, or paste the full JSON from Settings → edit OMG payload.";
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid template payload", issues: e.issues, hint },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid payload", hint },
      { status: 400 }
    );
  }

  const existing = await prisma.brandTemplateMaster.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "slug already exists" }, { status: 409 });
  }

  const row = await prisma.brandTemplateMaster.create({
    data: {
      slug,
      displayName,
      payload: payloadJson as object,
      isSystem: false,
    },
  });
  invalidateBrandTemplateCache();
  return NextResponse.json(row, { status: 201 });
}
