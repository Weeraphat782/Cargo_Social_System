import type { BrandPromptTemplate } from "@/lib/brands/types";
import type { CampaignTheme } from "@prisma/client";

export function buildStrategyAnalyzePrompt(params: {
  template: BrandPromptTemplate;
  lanesText: string;
  serviceDisallowList: string;
}): string {
  const { template, lanesText, serviceDisallowList } = params;

  return `${template.strategistTagline}

You are analyzing an attached PDF marketing strategy document. Your job is to propose concrete social-media campaigns that operationalize the document — NOT generic ideas unrelated to the PDF.

BRAND / CATEGORY CONTEXT
Industry context: ${template.industryContext}
Organization shorthand: ${template.orgShort}

SERVICE CATALOG (feature truthfully; do not invent offerings):
${template.services.map((s) => `- ${s.name}: ${s.pitch}`).join("\n")}

THEME LANES (pick ONE enum per campaign for visual lane only):
${lanesText}

DISALLOWED campaign names (verbatim product/service labels — do not use as campaign titles): ${serviceDisallowList}

RULES
1. Propose between 1 and 8 campaigns based ONLY on what the PDF supports. Prefer fewer, stronger campaigns if the document is thin.
2. Every campaign MUST include "sourceQuote": a verbatim quote from the PDF (10–40 words) that justifies this campaign. If you cannot find a quote, do not propose that campaign.
3. Do not invent budgets, dates, or KPI numbers not present in the PDF.
4. Fill campaign fields so they can be used to create scheduled campaigns:
   - contentMode: NEWS_DRIVEN or SELF_PROMO
   - keywords: if NEWS_DRIVEN use an English news search query aligned to the PDF; if SELF_PROMO use comma-separated promo themes or leave concise
   - cadence: prefer DAILY, WEEKLY, BIWEEKLY, MONTHLY unless the PDF clearly implies SPECIFIC_DATES or CUSTOM_DATETIMES
   - sourceQuote: verbatim quote from the PDF, 10–40 words
   - If cadence is WEEKLY_MULTI, output daysOfWeekMulti as a comma-separated string of weekday indices 0–6 (Sun–Sat), e.g. "1,3,5"
   - If cadence is SPECIFIC_DATES, output specificDates as a comma-separated string of ISO yyyy-mm-dd dates mentioned or implied in the PDF, e.g. "2026-06-12,2026-07-04"
   - If cadence is CUSTOM_DATETIMES, output scheduledDatetimes as a comma-separated string of YYYY-MM-DDTHH:mm values (no timezone; assume Asia/Bangkok wall time), e.g. "2026-06-12T09:00,2026-06-19T15:30"
   - For fields above that do not apply to the chosen cadence, output an empty string ""
5. theme MUST be one of: RELIABILITY_PRO | INNOVATION_TECH | SPEED_URGENCY
6. Output JSON only (schema enforced). Include top-level "summary" (3–5 sentences summarizing the PDF for a marketer).

LANGUAGE: Write summary, campaign names, descriptions, rationale, sourceQuote, campaignGoal, contentPillars, brandVoice in the same language as the PDF when possible; English is acceptable if the PDF is English.
`;
}

export const STRATEGY_THEME_ORDER: CampaignTheme[] = [
  "RELIABILITY_PRO",
  "INNOVATION_TECH",
  "SPEED_URGENCY",
];
