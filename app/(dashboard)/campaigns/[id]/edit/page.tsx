"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CampaignStatus, Prisma } from "@prisma/client";
import { Pencil } from "lucide-react";
import { PageHeader, Skeleton } from "@/components/ui";
import { endOfDayYmdToIso } from "../../schedule-editor";
import {
  campaignToFormFieldsValue,
  defaultCampaignFormFieldsValue,
  CampaignFormFields,
  type CampaignFormFieldsValue,
  type BrandOption,
} from "../../campaign-form-fields";
import { MAX_PUBLISH_TIME_SLOTS, parsePublishTimesFromText } from "@/lib/campaigns/publish-times";

type CampaignLoad = {
  id: string;
  status: CampaignStatus;
  name: string;
  brandTemplateId: string;
  keywords: string;
  contentMode: CampaignFormFieldsValue["contentMode"];
  contentLanguage: string;
  campaignGoal: string | null;
  targetPersona: string | null;
  contentPillars: string | null;
  platformStrategies: Prisma.JsonValue | null;
  description: string | null;
  brandVoice: string | null;
  theme: CampaignFormFieldsValue["theme"];
  cadence: CampaignFormFieldsValue["schedule"]["cadence"];
  dayOfWeek: number | null;
  hourOfDay: number | null;
  timezone: string;
  scheduleConfig: Prisma.JsonValue;
  platforms: CampaignFormFieldsValue["platforms"];
  postsPerRun: number;
  imagesPerPost: number;
  totalPostsCap: number | null;
  autoApprove: boolean;
  publishHourOfDay: number | null;
  publishMinuteOfHour: number | null;
  publishSpacingMinutes: number | null;
  publishTimes: Prisma.JsonValue | null;
  endAt: string | null;
};

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [form, setForm] = useState<CampaignFormFieldsValue>(() => defaultCampaignFormFieldsValue());
  const [error, setError] = useState<string | null>(null);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([
    { id: "omg", displayName: "OMG" },
    { id: "acme", displayName: "Acme (demo)" },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${id}`);
    if (!res.ok) {
      setError(res.status === 404 ? "Campaign not found." : `Error ${res.status}`);
      setLoading(false);
      return;
    }
    const c = (await res.json()) as CampaignLoad;
    setStatus(c.status);
    setForm(campaignToFormFieldsValue(c));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/brands");
      if (!res.ok) return;
      const data = (await res.json()) as { brands?: BrandOption[] };
      if (data.brands?.length) setBrandOptions(data.brands);
    })();
  }, []);

  async function save() {
    if (status === "COMPLETED") return;
    const {
      name,
      brandTemplateId,
      keywords,
      contentMode,
      contentLanguage,
      campaignGoal,
      targetPersona,
      contentPillars,
      description,
      brandVoice,
      theme,
      schedule,
      platforms,
      postsPerRun,
      imagesPerPost,
      totalPostsCap,
      autoApprove,
    } = form;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (contentMode === "NEWS_DRIVEN" && !keywords.trim()) {
      setError("Keywords are required for news-driven campaigns.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brandTemplateId,
          keywords: keywords.trim(),
          contentMode,
          contentLanguage,
          campaignGoal: campaignGoal.trim() || null,
          targetPersona: targetPersona.trim() || null,
          contentPillars: contentPillars.trim() || null,
          platformStrategies: form.platformStrategies,
          description: description.trim() || null,
          brandVoice: brandVoice.trim() || null,
          theme,
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
          totalPostsCap: totalPostsCap ? parseInt(totalPostsCap, 10) : null,
          autoApprove,
          publishHourOfDay: form.publishHourOfDay,
          publishMinuteOfHour: form.publishMinuteOfHour,
          publishSpacingMinutes: form.publishSpacingMinutes,
          publishTimes: parsePublishTimesFromText(form.publishTimesText, MAX_PUBLISH_TIME_SLOTS),
          endAt: schedule.runUntilYmd?.trim()
            ? endOfDayYmdToIso(schedule.runUntilYmd.trim(), schedule.timezone)
            : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      router.push(`/campaigns/${id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton variant="card" height={88} style={{ marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Skeleton variant="card" height={280} />
          <Skeleton variant="card" height={280} />
        </div>
      </div>
    );
  }

  if (status === "COMPLETED") {
    return (
      <div>
        <PageHeader title="Edit campaign" subtitle="This campaign is completed and cannot be edited." icon={<Pencil size={26} strokeWidth={1.75} />} />
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
          This campaign is <strong>COMPLETED</strong> and can&apos;t be edited. Create a new campaign or duplicate from
          logs if you need a similar setup.
        </p>
        <Link href={`/campaigns/${id}`} className="omg-btn-primary" style={{ display: "inline-block" }}>
          Back to campaign
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href={`/campaigns/${id}`} style={{ fontSize: 12, color: "var(--accent)" }}>← Campaign</Link>
      </div>
      <PageHeader
        eyebrow="Edit campaign"
        title="Campaign settings"
        subtitle={`Status: ${status ?? "—"} — saving updates fields only; it does not run the agent.`}
        icon={<Pencil size={26} strokeWidth={1.75} />}
      />
      {error && (
        <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 16, padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {error}
        </div>
      )}
      <CampaignFormFields
        value={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onScheduleChange={(patch) =>
          setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }))
        }
        idPrefix="edit"
        layout="page"
        showAdvanced={true}
        onAdvancedOpenChange={() => {}}
        brandOptions={brandOptions}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="omg-btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <Link href={`/campaigns/${id}`} className="omg-btn-ghost" style={{ textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
