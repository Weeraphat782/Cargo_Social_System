import { z } from "zod";
import type { BrandPromptTemplate, ThemeBundle } from "./types";
import { CampaignTheme } from "@prisma/client";

const campaignThemeSchema = z.nativeEnum(CampaignTheme);

const themeBundleSchema: z.ZodType<ThemeBundle> = z.object({
  id: campaignThemeSchema,
  label: z.string(),
  leadServiceName: z.string(),
  tone: z.string(),
  angle: z.string(),
  visualStyleNotes: z.string(),
  referenceCategory: z.string().optional(),
  thumbnailPath: z.string(),
});

const themeBundlesSchema: z.ZodType<Record<import("@prisma/client").CampaignTheme, ThemeBundle>> = z
  .object({
    RELIABILITY_PRO: themeBundleSchema,
    INNOVATION_TECH: themeBundleSchema,
    SPEED_URGENCY: themeBundleSchema,
  });

const brandServiceSchema = z.object({
  name: z.string(),
  tags: z.array(z.string()),
  pitch: z.string(),
});

const selfPromoSchema = z.object({
  defaultSourceTitle: z.string(),
  contentMarker: z.string(),
  citationLine: z.string(),
  fallbackPublicUrl: z.string(),
});

const suggestSchema = z.object({
  plannerBrief: z.string(),
  plannerRoleLine: z.string(),
  forbiddenNameSubstrings: z.array(z.string()),
  orgShort: z.string(),
});

export const brandPromptTemplatePayloadZ = z.object({
  id: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  strategistTagline: z.string(),
  orgShort: z.string(),
  orgDisplayName: z.string(),
  sourceArticleSiteLabel: z.string(),
  servicesCatalogHeading: z.string(),
  newsroomRequirementsHeading: z.string(),
  industryContext: z.string(),
  services: z.array(brandServiceSchema),
  promoGuidance: z.string(),
  mandatoryCtaUrl: z.union([z.string().url(), z.string().min(1)]),
  selfPromo: selfPromoSchema,
  selfPromoEditorialNoExternalSource: z.string(),
  selfPromoGeneralValueProposition: z.string(),
  suggestCampaign: suggestSchema,
  themeBundles: themeBundlesSchema,
});

/**
 * Build a `BrandPromptTemplate` from JSON stored in `BrandTemplateMaster.payload`.
 * `slug` / `displayName` from the row take precedence.
 */
export function parseBrandTemplateFromDb(
  slug: string,
  displayName: string,
  raw: unknown
): BrandPromptTemplate {
  const parsed = brandPromptTemplatePayloadZ.parse(raw);
  return {
    id: slug,
    displayName: displayName.trim() || parsed.displayName || slug,
    strategistTagline: parsed.strategistTagline,
    orgShort: parsed.orgShort,
    orgDisplayName: parsed.orgDisplayName,
    sourceArticleSiteLabel: parsed.sourceArticleSiteLabel,
    servicesCatalogHeading: parsed.servicesCatalogHeading,
    newsroomRequirementsHeading: parsed.newsroomRequirementsHeading,
    industryContext: parsed.industryContext,
    services: parsed.services,
    promoGuidance: parsed.promoGuidance,
    mandatoryCtaUrl: parsed.mandatoryCtaUrl,
    selfPromo: parsed.selfPromo,
    selfPromoEditorialNoExternalSource: parsed.selfPromoEditorialNoExternalSource,
    selfPromoGeneralValueProposition: parsed.selfPromoGeneralValueProposition,
    suggestCampaign: parsed.suggestCampaign,
    themeBundles: parsed.themeBundles,
  };
}

export function templateToJsonPayload(t: BrandPromptTemplate): object {
  return {
    id: t.id,
    displayName: t.displayName,
    strategistTagline: t.strategistTagline,
    orgShort: t.orgShort,
    orgDisplayName: t.orgDisplayName,
    sourceArticleSiteLabel: t.sourceArticleSiteLabel,
    servicesCatalogHeading: t.servicesCatalogHeading,
    newsroomRequirementsHeading: t.newsroomRequirementsHeading,
    industryContext: t.industryContext,
    services: t.services,
    promoGuidance: t.promoGuidance,
    mandatoryCtaUrl: t.mandatoryCtaUrl,
    selfPromo: t.selfPromo,
    selfPromoEditorialNoExternalSource: t.selfPromoEditorialNoExternalSource,
    selfPromoGeneralValueProposition: t.selfPromoGeneralValueProposition,
    suggestCampaign: t.suggestCampaign,
    themeBundles: t.themeBundles,
  };
}
