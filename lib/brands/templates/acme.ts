import type { BrandPromptTemplate } from "../types";

/** Placeholder second brand to prove multi-template wiring; replace copy for real use. */
export const acmeTemplate: BrandPromptTemplate = {
  id: "acme",
  displayName: "Acme Demo Co",
  strategistTagline:
    "You are a social media strategist for Acme Demo Co — a fictional B2B brand (software + operations) used to validate multi-brand templates.",
  orgShort: "Acme",
  orgDisplayName: "Acme",
  sourceArticleSiteLabel: "for Acme content hub only",
  servicesCatalogHeading: "Acme capabilities (for Facebook / Instagram / LinkedIn promo):",
  newsroomRequirementsHeading: "Acme long-form content requirements:",
  industryContext: "B2B operations and technology",
  services: [
    {
      name: "Cloud Reliability Suite",
      tags: ["cloud", "uptime", "sre", "monitoring"],
      pitch: "Managed observability and incident response to keep business-critical systems predictable.",
    },
    {
      name: "Data Integration",
      tags: ["etl", "apis", "pipelines", "warehouse"],
      pitch: "Connect systems with governed pipelines and clear SLAs for analytics teams.",
    },
    {
      name: "24/7 Support Desk",
      tags: ["support", "tickets", "escalation"],
      pitch: "Global follow-the-sun support with clear escalation and root-cause discipline.",
    },
  ],
  promoGuidance: `Acme self-promotion rules for Facebook / Instagram / LinkedIn:
- Do NOT rewrite or summarize the news article. Use the news as a short hook, then pivot to Acme.
- Pick ONE capability from the catalog that best matches the story.
- Be factual; do not invent customer names or numbers.`,
  mandatoryCtaUrl: "https://example.com/acme",
  selfPromo: {
    defaultSourceTitle: "Original brand content (Acme Demo Co)",
    contentMarker: "Original brand content — Acme Demo Co",
    citationLine: "> *Original brand content — Acme Demo Co.*",
    fallbackPublicUrl: "https://example.com/acme",
  },
  selfPromoEditorialNoExternalSource: `Acme editorial (self-promo, NOT a syndicated news article):
- Write an original piece (400-800 words, ## markdown) about why the capability matters and how Acme helps.
- Do not add a Source line to an external news URL — content is Acme-originated.
- slug: kebab-case, unique for this piece.`,
  selfPromoGeneralValueProposition: "General Acme value proposition; pick the most relevant capabilities below.",
  suggestCampaign: {
    plannerBrief:
      "Acme Demo Co — B2B software and services. Audience: operations and IT leaders (placeholder).",
    plannerRoleLine: "You are a B2B campaign planner for Acme Demo Co (placeholder brand).",
    orgShort: "Acme",
    forbiddenNameSubstrings: ["cloud reliability suite", "24/7 support desk", "placeholder"],
  },
  themeBundles: {
    RELIABILITY_PRO: {
      id: "RELIABILITY_PRO",
      label: "Trust & uptime",
      leadServiceName: "Cloud Reliability Suite",
      tone: "Calm, evidence-led, SLA-aware.",
      angle: "Frame stories around predictability, observability, and risk reduction.",
      visualStyleNotes: "Cool greys, soft gradients, clean UI-adjacent mood (no real logos in image).",
      thumbnailPath: "",
    },
    INNOVATION_TECH: {
      id: "INNOVATION_TECH",
      label: "Data-forward",
      leadServiceName: "Data Integration",
      tone: "Curious, practical, no hype.",
      angle: "Connect industry headlines to integration and data readiness.",
      visualStyleNotes: "Teal accents, open whitespace, forward-looking but sober.",
      thumbnailPath: "",
    },
    SPEED_URGENCY: {
      id: "SPEED_URGENCY",
      label: "Rapid response",
      leadServiceName: "24/7 Support Desk",
      tone: "Decisive, empathetic, clock-aware.",
      angle: "When minutes matter, emphasize escalation and coverage.",
      visualStyleNotes: "Warm highlight on neutral base; professional urgency without alarm.",
      thumbnailPath: "",
    },
  },
};
