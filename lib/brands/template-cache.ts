import { prisma } from "@/lib/db";
import type { BrandPromptTemplate } from "./types";
import { acmeTemplate } from "./templates/acme";
import { omgTemplate } from "./templates/omg";
import { parseBrandTemplateFromDb } from "./payload-schema";

/** Code fallbacks (e.g. `acme`) when no DB row exists. DB rows override by slug. */
const CODE_TEMPLATES: Record<string, BrandPromptTemplate> = {
  [omgTemplate.id]: omgTemplate,
  [acmeTemplate.id]: acmeTemplate,
};

let merged: Map<string, BrandPromptTemplate> | null = null;
let inflight: Promise<void> | null = null;

export async function ensureBrandTemplatesLoaded(): Promise<void> {
  if (merged) return;
  if (!inflight) {
    inflight = (async () => {
      const map = new Map<string, BrandPromptTemplate>();
      for (const [k, v] of Object.entries(CODE_TEMPLATES)) {
        map.set(k, v);
      }
      const rows = await prisma.brandTemplateMaster.findMany();
      for (const row of rows) {
        try {
          const t = parseBrandTemplateFromDb(row.slug, row.displayName, row.payload);
          map.set(row.slug, t);
        } catch (e) {
          console.error(`[brands] Invalid BrandTemplateMaster payload for slug "${row.slug}":`, e);
        }
      }
      merged = map;
    })();
  }
  try {
    await inflight;
  } finally {
    inflight = null;
  }
}

export function invalidateBrandTemplateCache(): void {
  merged = null;
  inflight = null;
}

export function getMergedTemplateMapOrThrow(): Map<string, BrandPromptTemplate> {
  if (!merged) {
    throw new Error("Brand templates not loaded; call await ensureBrandTemplatesLoaded() first");
  }
  return merged;
}
