import type { CampaignCadence, Prisma } from "@prisma/client";
import {
  previewNextRunsInRange,
  type ComputeNextRunInput,
} from "@/lib/campaigns/schedule-math";

export type CampaignProgressBarInput = {
  totalPostsCap: number | null;
  endAt: string | null;
  cadence: CampaignCadence;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  timezone: string;
  startAt: string;
  postsPerRun: number;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue | null;
  /** Total posts for this campaign (all statuses), same as Prisma `_count.posts` */
  postCount: number;
  /** Published only; used for subtitle text on dashboard */
  publishedCount: number;
};

export type CampaignProgressBarResult = {
  showBar: boolean;
  value: number;
  max: number;
  /** e.g. "1 / 8" or "3 / ~7" */
  ratioLabel: string;
  /** Line under the title: published + total posts */
  subtitle: string;
};

function toComputeInput(
  p: Omit<CampaignProgressBarInput, "postCount" | "publishedCount">
): ComputeNextRunInput {
  return {
    cadence: p.cadence,
    dayOfWeek: p.dayOfWeek,
    hourOfDay: p.hourOfDay,
    timezone: p.timezone?.trim() || "Asia/Bangkok",
    lastRunAt: null,
    startAt: new Date(p.startAt),
    customCron: p.customCron,
    scheduleConfig: p.scheduleConfig,
  };
}

/**
 * Expected max posts from schedule + end date (cap wins / intersects with cap when both set).
 */
export function getExpectedPostBudget(p: CampaignProgressBarInput): number | null {
  if (!p.endAt) return null;
  const end = new Date(p.endAt);
  if (Number.isNaN(end.getTime())) return null;
  const c = toComputeInput(p);
  const start = new Date(p.startAt);
  const runDates = previewNextRunsInRange(c, start, end, 365);
  const perRun = Math.max(1, Math.min(5, p.postsPerRun || 1));
  return runDates.length * perRun;
}

export function getCampaignProgressBar(
  p: CampaignProgressBarInput
): CampaignProgressBarResult {
  const { postCount, publishedCount } = p;
  const perRun = Math.max(1, Math.min(5, p.postsPerRun || 1));
  const expectedFromEnd = getExpectedPostBudget(p);

  let max: number | null = null;
  let isApprox = false;

  if (p.totalPostsCap != null && p.totalPostsCap > 0) {
    if (expectedFromEnd != null) {
      max = Math.min(p.totalPostsCap, expectedFromEnd);
    } else {
      max = p.totalPostsCap;
    }
  } else if (expectedFromEnd != null && expectedFromEnd > 0) {
    max = expectedFromEnd;
    isApprox = true;
  }

  const subtitleParts: string[] = [];
  if (publishedCount > 0) {
    subtitleParts.push(`${publishedCount} published`);
  }
  subtitleParts.push(`${postCount} post${postCount === 1 ? "" : "s"}`);
  const subtitle = subtitleParts.join(" · ");

  if (max == null || max <= 0) {
    return {
      showBar: false,
      value: postCount,
      max: 1,
      ratioLabel: "",
      subtitle,
    };
  }

  const value = Math.min(postCount, max);
  const ratioLabel = isApprox
    ? `${value} / ~${max}`
    : `${value} / ${max}`;

  return {
    showBar: true,
    value,
    max,
    ratioLabel,
    subtitle,
  };
}
