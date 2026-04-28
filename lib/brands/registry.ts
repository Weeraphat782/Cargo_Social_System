import type { CampaignTheme } from "@prisma/client";
import type { BrandPromptTemplate, ThemeBundle } from "./types";
import { acmeTemplate } from "./templates/acme";
import { omgTemplate } from "./templates/omg";
import {
  ensureBrandTemplatesLoaded,
  getMergedTemplateMapOrThrow,
  invalidateBrandTemplateCache,
} from "./template-cache";

const BRAND_TEMPLATES: Record<string, BrandPromptTemplate> = {
  [omgTemplate.id]: omgTemplate,
  [acmeTemplate.id]: acmeTemplate,
};

function assertThemeServiceAlignment(t: BrandPromptTemplate, id: string): void {
  if (process.env.NODE_ENV === "production") return;
  const names = new Set(t.services.map((s) => s.name));
  for (const th of Object.keys(t.themeBundles) as CampaignTheme[]) {
    const bundle = t.themeBundles[th];
    if (!bundle) continue;
    if (!names.has(bundle.leadServiceName)) {
      console.warn(
        `[brands] Template "${id}" theme ${th} leadServiceName "${bundle.leadServiceName}" is not in services list`
      );
    }
  }
}

for (const id of Object.keys(BRAND_TEMPLATES)) {
  assertThemeServiceAlignment(BRAND_TEMPLATES[id]!, id);
}

const DEFAULT_BRAND = "omg";

export { ensureBrandTemplatesLoaded, invalidateBrandTemplateCache };

export async function listBrandTemplateIds(): Promise<string[]> {
  await ensureBrandTemplatesLoaded();
  return Array.from(getMergedTemplateMapOrThrow().keys());
}

export async function listBrandTemplatesForApi(): Promise<{ id: string; displayName: string }[]> {
  await ensureBrandTemplatesLoaded();
  const m = getMergedTemplateMapOrThrow();
  return Array.from(m.entries()).map(([id, t]) => ({ id, displayName: t.displayName }));
}

export async function isBrandTemplateId(id: string): Promise<boolean> {
  await ensureBrandTemplatesLoaded();
  return getMergedTemplateMapOrThrow().has(id);
}

export async function getBrandTemplate(id: string): Promise<BrandPromptTemplate> {
  await ensureBrandTemplatesLoaded();
  const t = getMergedTemplateMapOrThrow().get(id);
  if (!t) {
    throw new Error(`Unknown brand template: ${id}`);
  }
  return t;
}

export async function getBrandTemplateOrDefault(
  id: string | null | undefined
): Promise<BrandPromptTemplate> {
  await ensureBrandTemplatesLoaded();
  const m = getMergedTemplateMapOrThrow();
  if (id && m.has(id)) {
    return m.get(id)!;
  }
  return m.get(DEFAULT_BRAND)!;
}

export async function getThemeBundleForBrand(
  brandId: string,
  theme: CampaignTheme
): Promise<ThemeBundle> {
  const t = await getBrandTemplateOrDefault(brandId);
  return t.themeBundles[theme];
}

export { DEFAULT_BRAND };
