"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type {
  CampaignCadence,
  CampaignContentMode,
  CampaignStatus,
  CampaignTheme,
  Platform,
  Prisma,
} from "@prisma/client";
import { Megaphone } from "lucide-react";
import { PageHeader, PlatformIcon, ProgressBar, Skeleton, StatCard } from "@/components/ui";
import { getCampaignProgressBar } from "@/lib/campaigns-progress";
import { parsePublishTimesJson } from "@/lib/campaigns/publish-times";

type CampaignRow = {
  id: string;
  name: string;
  brandTemplateId: string;
  status: CampaignStatus;
  theme: CampaignTheme;
  contentMode: CampaignContentMode;
  cadence: CampaignCadence;
  keywords: string;
  nextRunAt: string | null;
  autoApprove: boolean;
  publishHourOfDay: number | null;
  publishMinuteOfHour: number | null;
  publishSpacingMinutes: number | null;
  publishTimes: Prisma.JsonValue | null;
  timezone: string;
  startAt: string;
  endAt: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  postsPerRun: number;
  imagesPerPost: number;
  totalPostsCap: number | null;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue;
  _count: { posts: number; runs: number };
  publishedCount: number;
  platforms: Platform[];
};

/** Short countdown line for campaign row (list view). */
function formatNextRunShort(iso: string) {
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  if (diff <= 0) return "Due now";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `Next in ${h}h ${m}m`;
  if (m > 0) return `Next in ${m}m`;
  return "Due soon";
}

function formatPublishWallClock(h: number | null, m: number | null) {
  if (h == null) return null;
  const mm = m ?? 0;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function CampaignsClient({ initialCampaigns }: { initialCampaigns: CampaignRow[] }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [loading, setLoading] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const cRes = await fetch("/api/campaigns");
    if (cRes.ok) setCampaigns(await cRes.json());
    setLoading(false);
  }, []);

  async function patchStatus(id: string, next: CampaignStatus) {
    const snapshot = campaigns;
    setPatchingId(id);
    setCampaigns((rows) => rows.map((row) => (row.id === id ? { ...row, status: next } : row)));
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setCampaigns(snapshot);
        return;
      }
      const updated = (await res.json()) as CampaignRow;
      setCampaigns((rows) => rows.map((row) => (row.id === id ? updated : row)));
    } catch {
      setCampaigns(snapshot);
    } finally {
      setPatchingId(null);
    }
  }

  const withProgress = useMemo(
    () =>
      campaigns.map((c) => ({
        c,
        progress: getCampaignProgressBar({
          totalPostsCap: c.totalPostsCap,
          endAt: c.endAt,
          cadence: c.cadence,
          dayOfWeek: c.dayOfWeek,
          hourOfDay: c.hourOfDay,
          timezone: c.timezone,
          startAt: c.startAt,
          postsPerRun: c.postsPerRun,
          customCron: c.customCron,
          scheduleConfig: c.scheduleConfig,
          postCount: c._count.posts,
          publishedCount: c.publishedCount,
        }),
      })),
    [campaigns]
  );

  const active = useMemo(
    () => withProgress.filter(({ progress }) => !(progress.showBar && progress.value >= progress.max)),
    [withProgress]
  );

  const completed = useMemo(
    () => withProgress.filter(({ progress }) => progress.showBar && progress.value >= progress.max),
    [withProgress]
  );

  const statusCounts = {
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    draft: campaigns.filter((c) => c.status === "DRAFT").length,
    done: campaigns.filter((c) => c.status === "COMPLETED").length,
  };

  function renderCampaignCard(
    { c, progress }: (typeof withProgress)[number],
    isCompleted = false
  ) {
    return (
      <div
        key={c.id}
        className="omg-card is-interactive"
        style={{
          position: "relative",
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
          opacity: isCompleted ? 0.75 : 1,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16, flex: 1, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
              {isCompleted && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "var(--success-dim)",
                  color: "var(--success)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}>
                  Completed
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {c.status} · {c.brandTemplateId} · {c.contentMode === "SELF_PROMO" ? "self-promo" : "news"} ·{" "}
              {c.cadence} · {c.theme}
              {(() => {
                const pt = parsePublishTimesJson(c.publishTimes);
                if (pt.length > 0) {
                  const shown = pt.slice(0, 4).join(", ");
                  return ` · pub: ${shown}${pt.length > 4 ? "…" : ""}`;
                }
                if (c.publishHourOfDay != null) {
                  let s = ` · pub: ${formatPublishWallClock(c.publishHourOfDay, c.publishMinuteOfHour)}`;
                  if (c.publishSpacingMinutes != null) s += ` (+${c.publishSpacingMinutes}m)`;
                  return s;
                }
                return "";
              })()}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 4 }}>
              {c.platforms.map((p) => <PlatformIcon key={p} platform={p} size={14} />)}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
              {c.keywords}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>
              Next: {c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "—"} · {c._count.posts} posts
              {c.endAt ? ` · until ${new Date(c.endAt).toLocaleDateString()}` : null}
            </div>
          </div>
          <div style={{ width: 160, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
            {progress.showBar ? (
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--text-muted)" }}>{progress.subtitle}</p>
                <ProgressBar value={progress.value} max={Math.max(1, progress.max)} label="Posts" compact ratioLabelOverride={progress.ratioLabel} />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{progress.subtitle}</p>
            )}
            {c.nextRunAt && c.status === "ACTIVE" ? (
              <span className="omg-badge omg-badge-scheduled" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, maxWidth: "100%" }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, flexShrink: 0 }} aria-hidden />
                <span suppressHydrationWarning>{formatNextRunShort(c.nextRunAt)}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, position: "relative", zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
          {c.status === "DRAFT" && (
            <button type="button" className="omg-btn-primary" style={{ fontSize: 12, padding: "6px 12px" }} disabled={patchingId === c.id}
              onClick={(e) => { e.preventDefault(); void patchStatus(c.id, "ACTIVE"); }}>
              {patchingId === c.id ? "…" : "Activate"}
            </button>
          )}
          {c.status === "ACTIVE" && (
            <button type="button" className="omg-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} disabled={patchingId === c.id}
              onClick={(e) => { e.preventDefault(); void patchStatus(c.id, "DRAFT"); }}>
              {patchingId === c.id ? "…" : "Pause"}
            </button>
          )}
          <Link href={`/campaigns/${c.id}`} className="omg-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>Details</Link>
        </div>
        <Link href={`/campaigns/${c.id}`} aria-label={`Open ${c.name}`} style={{ position: "absolute", inset: 0, zIndex: 1, borderRadius: "inherit" }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle='Create a campaign with one AI click, or fill in the details yourself — lane, platforms, and caps are tucked away under "Advanced".'
        icon={<Megaphone size={28} strokeWidth={1.75} />}
        actions={
          <Link href="/campaigns/new" className="omg-btn-primary" style={{ textDecoration: "none" }}>
            New campaign
          </Link>
        }
      />

      {!loading && campaigns.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="Active" value={statusCounts.active} />
          <StatCard label="Draft" value={statusCounts.draft} />
          <StatCard label="Completed" value={statusCounts.done} />
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
        </div>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No campaigns yet — click &quot;New campaign&quot; above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.map((item) => renderCampaignCard(item, false))}

          {completed.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setCompletedOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span style={{
                  display: "inline-block",
                  transform: completedOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 180ms ease",
                  fontSize: 10,
                }}>▶</span>
                Completed ({completed.length})
              </button>
              {completedOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                  {completed.map((item) => renderCampaignCard(item, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
