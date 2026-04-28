import type { CampaignTheme } from "@prisma/client";

/** Visual + copy lane; shared across agent and UI. */
export type ThemeBundle = {
  id: CampaignTheme;
  label: string;
  leadServiceName: string;
  tone: string;
  angle: string;
  visualStyleNotes: string;
  referenceCategory?: string;
  thumbnailPath: string;
};

export type BrandService = {
  name: string;
  tags: string[];
  pitch: string;
};

export type SelfPromoSourceConfig = {
  defaultSourceTitle: string;
  /** Shown in body if missing marker */
  contentMarker: string;
  /** Markdown line appended if marker missing */
  citationLine: string;
  /** When env URLs unset, use this for sourceUrl */
  fallbackPublicUrl: string;
};

export type SuggestCampaignCopy = {
  plannerBrief: string;
  /** First line, e.g. "You are a senior ... for X" */
  plannerRoleLine: string;
  forbiddenNameSubstrings: string[];
  /** e.g. "OMG" in "promotes OMG" rules */
  orgShort: string;
};

export type BrandPromptTemplate = {
  id: string;
  displayName: string;
  /** First sentence of draft prompts ("You are a social media strategist for …") */
  strategistTagline: string;
  /** Short name for in-copy rules ("OMG") */
  orgShort: string;
  /** "OMG Experience" style */
  orgDisplayName: string;
  /** e.g. "for OMG newsroom only" segment */
  sourceArticleSiteLabel: string;
  /** Heading before bullet list in prompts */
  servicesCatalogHeading: string;
  newsroomRequirementsHeading: string;
  industryContext: string;
  services: BrandService[];
  promoGuidance: string;
  mandatoryCtaUrl: string;
  selfPromo: SelfPromoSourceConfig;
  selfPromoEditorialNoExternalSource: string;
  selfPromoGeneralValueProposition: string;
  suggestCampaign: SuggestCampaignCopy;
  themeBundles: Record<CampaignTheme, ThemeBundle>;
};
