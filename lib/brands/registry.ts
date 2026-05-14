import type { CampaignTheme } from "@prisma/client";
import type { BrandPromptTemplate, ThemeBundle } from "./types";
import { acmeTemplate } from "./templates/acme";
import { omgTemplate } from "./templates/omg";
import {
  ensureBrandTemplatesLoaded,
  ensureBrandTemplateFromDb,
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
  const m = getMergedTemplateMapOrThrow();
  if (m.has(id)) return true;
  const loaded = await ensureBrandTemplateFromDb(id);
  return loaded != null;
}

export async function getBrandTemplate(id: string): Promise<BrandPromptTemplate> {
  await ensureBrandTemplatesLoaded();
  const m = getMergedTemplateMapOrThrow();
  if (m.has(id)) return m.get(id)!;
  const loaded = await ensureBrandTemplateFromDb(id);
  if (loaded) return loaded;
  throw new Error(`Unknown brand template: ${id}`);
}

export async function getBrandTemplateOrDefault(
  id: string | null | undefined
): Promise<BrandPromptTemplate> {
  await ensureBrandTemplatesLoaded();
  const m = getMergedTemplateMapOrThrow();
  const key = typeof id === "string" ? id.trim() : "";
  if (!key) {
    return m.get(DEFAULT_BRAND)!;
  }
  if (m.has(key)) {
    return m.get(key)!;
  }
  const loaded = await ensureBrandTemplateFromDb(key);
  if (loaded) return loaded;
  console.warn(`[brands] Unknown brand template "${key}", falling back to ${DEFAULT_BRAND}`);
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
