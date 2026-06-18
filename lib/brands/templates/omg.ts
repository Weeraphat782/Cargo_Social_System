import type { BrandPromptTemplate } from "../types";

const PROMO_GUIDANCE = `OMG self-promotion rules for Facebook / Instagram / LinkedIn:
- Do NOT rewrite or summarize the news article. Use the news only as a contextual hook (industry trend) and pivot quickly to OMG's capability.
- Pick the ONE service from the services catalog below whose tags best match the news topic and lead with it. If none clearly match, default to "Specialized Air Freight".
- Highlight a concrete benefit (reliability, compliance, speed, visibility) and end with a soft CTA ("Talk to our team", "Learn more", etc.).
- Never quote long passages from the source. No citations needed on social.`;

export const omgTemplate: BrandPromptTemplate = {
  id: "omg",
  displayName: "OMG Experience",
  focusKeywords: [
    "eu gmp annex 7 herbal medicinal products cannabis",
    "gmp cannabis logistics",
    "eu gmp certification cannabis",
    "gacp cannabis",
    "eu gdp cold chain cannabis",
    "medical cannabis import eu",
    "germany medical cannabis logistics",
  ],
  strategistTagline:
    "You are a social media strategist for OMG Experience — specialized air freight, pharmaceutical cold chain, EU GMP/GACP cannabis logistics, time-critical cargo, and AI-powered logistics.",
  orgShort: "OMG",
  orgDisplayName: "OMG",
  sourceArticleSiteLabel: "for OMG newsroom only",
  servicesCatalogHeading: "OMG services catalog (for Facebook / Instagram / LinkedIn promo):",
  newsroomRequirementsHeading: "OMG newsroom requirements:",
  industryContext: "EU GMP/GACP cannabis logistics, pharmaceutical cold chain, and regulated air freight compliance",
  services: [
    {
      name: "Specialized Air Freight",
      tags: ["air freight", "aircargo", "charter", "time-critical"],
      pitch:
        "End-to-end managed air freight for time-critical and oversized cargo, with proactive milestone tracking and 24/7 ops control.",
    },
    {
      name: "Pharmaceutical Cold Chain",
      tags: ["pharma", "cold chain", "gdp", "temperature-controlled"],
      pitch:
        "GDP-compliant temperature-controlled movements with documented handling, validated packaging, and full chain-of-custody evidence.",
    },
    {
      name: "AI-Powered Logistics Visibility",
      tags: ["ai", "visibility", "predictive", "analytics"],
      pitch:
        "AI-assisted shipment monitoring that predicts delays, flags anomalies, and keeps stakeholders aligned in real time.",
    },
    {
      name: "Time-Critical & Emergency Cargo",
      tags: ["emergency", "next-flight-out", "on-board courier"],
      pitch:
        "Rapid-response logistics for shipments where every hour matters — NFO, on-board couriers, and chartered lift.",
    },
  ],
  promoGuidance: PROMO_GUIDANCE,
  mandatoryCtaUrl: "https://cargo.omgexp.com/site",
  selfPromo: {
    defaultSourceTitle: "Original brand content (OMG Experience)",
    contentMarker: "Original brand content — OMG Experience",
    citationLine: "> *Original brand content — OMG Experience.*",
    fallbackPublicUrl: "https://www.omg.experience",
  },
  selfPromoEditorialNoExternalSource: `OMG newsroom / site article (self-promo editorial, NOT a syndicated news piece):
- Write an **original editorial** (400-800 words, ## markdown headings) explaining why this capability matters, how OMG approaches it, and a soft CTA. No need to reference a real breaking-news URL.
- Open the article with a 1-2 sentence direct answer to the core question before any heading (optimised for AI/LLM extraction and featured snippets).
- Heading hierarchy: the page title is the H1; inside bodyMd use ## (H2) for main sections and ### (H3) for subsections only — never a single # H1, never skip levels.
- Use bullet/numbered lists for steps or criteria, and include at least one markdown comparison table when comparing options, tools, or approaches.
- Write a meta description (150-160 chars, PRIMARY SEO KEYWORD first) in the metaDescription field.
- Include at least one markdown link to the money page: [OMG Experience](https://cargo.omgexp.com/site)
- Where relevant, cross-reference sibling topics in the cannabis/GMP/EU compliance cluster (GACP, EU GDP cold chain, EU GMP Annex 7, medical cannabis import) to build topical authority.
- Do NOT add a "Source: [external URL]" line for a news site — the article is OMG-originated.
- slug: semantic kebab-case with the PRIMARY SEO KEYWORD (3-6 words), no random suffix.`,
  selfPromoGeneralValueProposition:
    "General OMG value proposition; pick the most relevant OMG services below.",
  suggestCampaign: {
    plannerBrief:
      "OMG Experience — specialized air freight, cold chain, time-critical / DG, AI visibility, Asia-Pacific. Audience: supply chain, pharma, ops.",
    plannerRoleLine: "You are a senior B2B social + newsroom campaign planner for OMG Experience.",
    orgShort: "OMG",
    forbiddenNameSubstrings: [
      "pharmaceutical cold chain",
      "ai-powered logistics visibility",
      "time-critical",
      "reliability & compliance",
      "innovation & visibility",
      "speed & time-critical",
    ],
  },
  themeBundles: {
    RELIABILITY_PRO: {
      id: "RELIABILITY_PRO",
      label: "Reliability & compliance",
      leadServiceName: "Pharmaceutical Cold Chain",
      tone:
        "Authoritative, audit-ready, calm confidence. Emphasize GDP, chain-of-custody, and zero-excursion delivery.",
      angle:
        "Frame every story as proof of operational discipline: validated packaging, documented handoffs, and predictable outcomes for life-science and regulated cargo.",
      visualStyleNotes:
        "Navy, white, and cool grey palette; soft even lighting; calm, premium mood.",
      thumbnailPath: "",
    },
    INNOVATION_TECH: {
      id: "INNOVATION_TECH",
      label: "Innovation & visibility",
      leadServiceName: "AI-Powered Logistics Visibility",
      tone:
        "Forward-looking, data-informed, product-led. Emphasize prediction, exception handling, and stakeholder alignment.",
      angle:
        "Connect industry headlines to visibility and control: real-time monitoring, AI-assisted foresight, and transparent ops without hype.",
      visualStyleNotes:
        "Teal and electric blue accents; balanced natural light; forward-looking mood.",
      thumbnailPath: "",
    },
    SPEED_URGENCY: {
      id: "SPEED_URGENCY",
      label: "Speed & time-critical",
      leadServiceName: "Time-Critical & Emergency Cargo",
      tone:
        "Decisive, high-trust, clock-aware. Emphasize NFO, charter, and on-board courier when minutes matter.",
      angle:
        "Tie news to response velocity: same-day execution, 24/7 control, and escalation paths for mission-critical freight.",
      visualStyleNotes:
        "Deep orange and crimson highlights on a neutral base; dramatic but professional lighting; sense of momentum and urgency.",
      thumbnailPath: "",
    },
  },
};
