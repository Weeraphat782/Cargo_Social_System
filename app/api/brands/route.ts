import { NextResponse } from "next/server";
import type { CampaignTheme } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { acmeTemplate } from "@/lib/brands/templates/acme";
import { omgTemplate } from "@/lib/brands/templates/omg";
import { brandPromptTemplatePayloadZ } from "@/lib/brands/payload-schema";
import type { BrandPromptTemplate, ThemeBundle } from "@/lib/brands/types";

type ThemeLabel = {
  label: string;
  angle: string;
  leadServiceName: string;
};

type BrandApiItem = {
  id: string;
  displayName: string;
  themeLabels?: Partial<Record<CampaignTheme, ThemeLabel>>;
};

function extractThemeLabels(
  bundles: BrandPromptTemplate["themeBundles"]
): Partial<Record<CampaignTheme, ThemeLabel>> {
  const out: Partial<Record<CampaignTheme, ThemeLabel>> = {};
  for (const [theme, bundle] of Object.entries(bundles) as [CampaignTheme, ThemeBundle][]) {
    if (!bundle) continue;
    out[theme] = {
      label: bundle.label,
      angle: bundle.angle,
      leadServiceName: bundle.leadServiceName,
    };
  }
  return out;
}

const CODE_BRAND_DEFAULTS: BrandApiItem[] = [
  {
    id: omgTemplate.id,
    displayName: omgTemplate.displayName,
    themeLabels: extractThemeLabels(omgTemplate.themeBundles),
  },
  {
    id: acmeTemplate.id,
    displayName: acmeTemplate.displayName,
    themeLabels: extractThemeLabels(acmeTemplate.themeBundles),
  },
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const map = new Map<string, BrandApiItem>();
  for (const b of CODE_BRAND_DEFAULTS) map.set(b.id, b);

  const rows = await prisma.brandTemplateMaster.findMany({
    select: { slug: true, displayName: true, payload: true },
    orderBy: { slug: "asc" },
  });
  for (const row of rows) {
    let themeLabels: Partial<Record<CampaignTheme, ThemeLabel>> | undefined;
    const parsed = brandPromptTemplatePayloadZ.safeParse(row.payload);
    if (parsed.success) {
      themeLabels = extractThemeLabels(parsed.data.themeBundles);
    }
    map.set(row.slug, {
      id: row.slug,
      displayName: row.displayName,
      themeLabels,
    });
  }

  const brands = Array.from(map.values());
  return NextResponse.json({ brands });
}
