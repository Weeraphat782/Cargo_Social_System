import type {
  CampaignCadence,
  CampaignContentMode,
  CampaignTheme,
} from "@prisma/client";
import type { CreateCampaignPayload } from "@/lib/campaigns/create-from-payload";

/** Raw campaign object from Gemini strategy analysis JSON (before normalization). */
export type StrategyAiCampaign = {
  name: string;
  description: string;
  keywords: string;
  brandVoice: string;
  theme: string;
  themePitch: string;
  contentMode: string;
  cadence: string;
  dayOfWeek: number;
  hourOfDay: number;
  postsPerRun: number;
  imagesPerPost?: number;
  autoApprove: boolean;
  rationale: string;
  campaignGoal: string;
  contentPillars: string;
  sourceQuote: string;
  /** Comma-separated weekday indices 0-6, e.g. "1,3,5". Arrays accepted for backwards compat. */
  daysOfWeekMulti?: string | number[];
  /** Comma-separated ISO yyyy-mm-dd dates. */
  specificDates?: string | string[];
  /** Comma-separated YYYY-MM-DDTHH:mm datetimes. */
  scheduledDatetimes?: string | string[];
  targetPersona?: string;
};

function splitCsv(value: string | string[] | number[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const VALID_THEMES: CampaignTheme[] = [
  "RELIABILITY_PRO",
  "INNOVATION_TECH",
  "SPEED_URGENCY",
];

const VALID_CADENCE: CampaignCadence[] = [
  "DAILY",
  "WEEKLY",
  "WEEKLY_MULTI",
  "BIWEEKLY",
  "MONTHLY",
  "SPECIFIC_DATES",
  "CUSTOM",
  "CUSTOM_DATETIMES",
];

const VALID_CONTENT_MODES: CampaignContentMode[] = ["NEWS_DRIVEN", "SELF_PROMO"];

function clampTheme(s: string): CampaignTheme {
  const t = s.trim().toUpperCase() as CampaignTheme;
  return VALID_THEMES.includes(t) ? t : "INNOVATION_TECH";
}

function clampCadence(s: string): CampaignCadence {
  const t = s.trim().toUpperCase() as CampaignCadence;
  return VALID_CADENCE.includes(t) ? t : "WEEKLY";
}

function clampContentMode(s: string): CampaignContentMode {
  const t = s.trim().toUpperCase() as CampaignContentMode;
  return VALID_CONTENT_MODES.includes(t) ? t : "NEWS_DRIVEN";
}

/**
 * Normalize AI output into a payload compatible with `createCampaignFromPayload`
 * (same shape as POST /api/campaigns). Brand template is injected at commit time.
 */
export function normalizeStrategyAiCampaignToPayload(
  c: StrategyAiCampaign,
  industryFallbackKeyword: string
): CreateCampaignPayload {
  const contentMode = clampContentMode(c.contentMode ?? "NEWS_DRIVEN");
  let keywords = String(c.keywords ?? "").trim();
  if (contentMode === "NEWS_DRIVEN" && !keywords) {
    keywords = industryFallbackKeyword;
  }

  let cadence = clampCadence(c.cadence ?? "WEEKLY");
  const dayOfWeek = Math.max(0, Math.min(6, Math.floor(Number(c.dayOfWeek) || 1)));
  const hourOfDay = Math.max(0, Math.min(23, Math.floor(Number(c.hourOfDay) || 9)));

  let daysOfWeekMulti = splitCsv(c.daysOfWeekMulti)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
  if (cadence === "WEEKLY_MULTI" && daysOfWeekMulti.length === 0) {
    daysOfWeekMulti = [dayOfWeek];
  }

  let specificDates = splitCsv(c.specificDates).filter((d) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d)
  );
  if (cadence === "SPECIFIC_DATES" && specificDates.length === 0) {
    cadence = "WEEKLY";
  }

  let scheduledDatetimes = splitCsv(c.scheduledDatetimes).filter((s) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)
  );
  if (cadence === "CUSTOM_DATETIMES" && scheduledDatetimes.length === 0) {
    cadence = "WEEKLY";
  }

  const postsPerRun = Math.min(5, Math.max(1, Math.floor(Number(c.postsPerRun) || 1)));
  const imagesPerPost = Math.min(
    4,
    Math.max(1, Math.floor(Number(c.imagesPerPost) || 1))
  );

  return {
    name: c.name,
    description: c.description,
    keywords,
    brandVoice: c.brandVoice,
    theme: clampTheme(c.theme ?? "INNOVATION_TECH"),
    contentMode,
    cadence,
    dayOfWeek,
    hourOfDay,
    postsPerRun,
    imagesPerPost,
    autoApprove: Boolean(c.autoApprove),
    campaignGoal: String(c.campaignGoal ?? "").trim() || undefined,
    contentPillars: String(c.contentPillars ?? "").trim() || undefined,
    targetPersona: String(c.targetPersona ?? "").trim() || undefined,
    contentLanguage: "en",
    timezone: "Asia/Bangkok",
    daysOfWeekMulti:
      cadence === "WEEKLY_MULTI" ? daysOfWeekMulti : undefined,
    specificDates:
      cadence === "SPECIFIC_DATES" ? specificDates : undefined,
    scheduledDatetimes:
      cadence === "CUSTOM_DATETIMES" ? scheduledDatetimes : undefined,
    status: "DRAFT",
  };
}
