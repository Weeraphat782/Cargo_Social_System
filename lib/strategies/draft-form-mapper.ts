import { formatInTimeZone } from "date-fns-tz";
import type { CreateCampaignPayload } from "@/lib/campaigns/create-from-payload";
import {
  defaultCampaignFormFieldsValue,
  type CampaignFormFieldsValue,
} from "@/app/(dashboard)/campaigns/campaign-form-fields";
import { defaultScheduleValue } from "@/app/(dashboard)/campaigns/schedule-editor";
import { MAX_PUBLISH_TIME_SLOTS, parsePublishTimesFromText } from "@/lib/campaigns/publish-times";

function platformStrategiesFromPayload(
  ps: Record<string, string> | null | undefined
): CampaignFormFieldsValue["platformStrategies"] {
  const obj = (ps ?? {}) as Record<string, unknown>;
  return {
    FACEBOOK: typeof obj.FACEBOOK === "string" ? obj.FACEBOOK : "",
    INSTAGRAM: typeof obj.INSTAGRAM === "string" ? obj.INSTAGRAM : "",
    LINKEDIN: typeof obj.LINKEDIN === "string" ? obj.LINKEDIN : "",
    OMG: typeof obj.OMG === "string" ? obj.OMG : "",
  };
}

/** Build form state from a draft payload (POST /api/campaigns shape without brandTemplateId). */
export function strategyPayloadToFormFields(
  payload: CreateCampaignPayload,
  brandTemplateId: string
): CampaignFormFieldsValue {
  const baseForm = defaultCampaignFormFieldsValue();
  const schedBase = defaultScheduleValue();
  const tz = payload.timezone ?? schedBase.timezone;
  const dow = payload.dayOfWeek ?? 1;
  const hod = payload.hourOfDay ?? 9;

  const daysMulti =
    payload.cadence === "WEEKLY_MULTI"
      ? payload.daysOfWeekMulti?.length
        ? payload.daysOfWeekMulti
        : [dow]
      : schedBase.daysOfWeekMulti;

  const runUntilYmd =
    payload.endAt == null || payload.endAt === ""
      ? null
      : formatInTimeZone(new Date(payload.endAt), tz, "yyyy-MM-dd");

  return {
    name: payload.name,
    brandTemplateId,
    keywords: payload.keywords ?? "",
    contentMode: payload.contentMode ?? "NEWS_DRIVEN",
    contentLanguage: payload.contentLanguage ?? "en",
    campaignGoal: payload.campaignGoal ?? "",
    targetPersona: payload.targetPersona ?? "",
    contentPillars: payload.contentPillars ?? "",
    platformStrategies: platformStrategiesFromPayload(payload.platformStrategies ?? undefined),
    description: typeof payload.description === "string" ? payload.description : "",
    brandVoice: payload.brandVoice ?? "",
    theme: payload.theme,
    schedule: {
      cadence: payload.cadence,
      dayOfWeek: dow,
      hourOfDay: hod,
      timezone: tz,
      daysOfWeekMulti: daysMulti,
      specificDates: payload.specificDates ?? [],
      scheduledDatetimes: payload.scheduledDatetimes ?? [],
      runUntilYmd,
    },
    platforms: payload.platforms?.length ? [...payload.platforms] : [...baseForm.platforms],
    postsPerRun: payload.postsPerRun ?? 1,
    imagesPerPost: payload.imagesPerPost ?? 1,
    totalPostsCap:
      payload.totalPostsCap != null ? String(payload.totalPostsCap) : "",
    autoApprove: payload.autoApprove ?? false,
    publishHourOfDay: payload.publishHourOfDay ?? null,
    publishMinuteOfHour:
      payload.publishHourOfDay != null
        ? (payload.publishMinuteOfHour ?? 0)
        : null,
    publishSpacingMinutes: payload.publishSpacingMinutes ?? null,
    publishTimesText: payload.publishTimes?.length ? payload.publishTimes.join("\n") : "",
  };
}

/** Serialize form back to API payload (brand injected at commit). */
export function formFieldsToStrategyPayload(
  form: CampaignFormFieldsValue,
  scheduleExtras: {
    endAtIso: string | null;
    publishTimes: string[];
  }
): CreateCampaignPayload {
  const { schedule, platforms, postsPerRun, imagesPerPost, totalPostsCap, autoApprove } = form;

  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    keywords: form.keywords.trim(),
    brandVoice: form.brandVoice.trim() || undefined,
    theme: form.theme,
    contentMode: form.contentMode,
    cadence: schedule.cadence,
    dayOfWeek: schedule.dayOfWeek,
    hourOfDay: schedule.hourOfDay,
    timezone: schedule.timezone,
    daysOfWeekMulti: schedule.daysOfWeekMulti,
    specificDates: schedule.specificDates,
    scheduledDatetimes: schedule.scheduledDatetimes,
    platforms: platforms.length ? platforms : undefined,
    postsPerRun,
    imagesPerPost,
    totalPostsCap: totalPostsCap ? parseInt(totalPostsCap, 10) : undefined,
    autoApprove,
    publishHourOfDay: form.publishHourOfDay,
    publishMinuteOfHour: form.publishMinuteOfHour,
    publishSpacingMinutes: form.publishSpacingMinutes,
    publishTimes: scheduleExtras.publishTimes.slice(0, MAX_PUBLISH_TIME_SLOTS),
    endAt: scheduleExtras.endAtIso ?? undefined,
    status: "DRAFT",
    campaignGoal: form.campaignGoal.trim() || undefined,
    targetPersona: form.targetPersona.trim() || undefined,
    contentPillars: form.contentPillars.trim() || undefined,
    platformStrategies: form.platformStrategies,
    contentLanguage: form.contentLanguage,
  };
}

export function publishTimesFromFormText(text: string): string[] {
  return parsePublishTimesFromText(text, MAX_PUBLISH_TIME_SLOTS);
}

export function defaultStrategyForm(
  brandTemplateId: string
): CampaignFormFieldsValue {
  return {
    ...defaultCampaignFormFieldsValue(),
    brandTemplateId,
    schedule: defaultScheduleValue(),
  };
}
