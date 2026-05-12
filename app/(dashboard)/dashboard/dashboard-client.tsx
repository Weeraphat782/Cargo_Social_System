"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { CountdownRing, PageHeader, PlatformIcon, ProgressBar, StatCard } from "@/components/ui";
import type { CampaignCadence, Prisma } from "@prisma/client";
import { getCampaignProgressBar } from "@/lib/campaigns-progress";

export type DashboardStats = {
  pending: number;
  approved: number;
  scheduled: number;
  published: number;
  topics: number;
};

type Topic = { id: string; name: string; keywords: string; active: boolean };

export type DashboardCampaignRow = {
  id: string;
  name: string;
  cadence: CampaignCadence;
  theme: string;
  nextRunAt: string | null;
  platforms: string[];
  postsPerRun: number;
  totalPostsCap: number | null;
  startAt: string;
  endAt: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  timezone: string;
  customCron: string | null;
  scheduleConfig: Prisma.JsonValue;
  publishedCount: number;
  _count: { runs: number; posts: number };
};

export type DashboardUpcomingPost = {
  id: string;
  scheduledAt: string;
  campaignName: string | null;
  platform: string;
  captionSnippet: string;
};

export type DashboardRecentRun = {
  id: string;
  startedAt: string;
  ok: boolean;
  campaignName: string;
};

const platformPill: Record<string, { label: string; cls: string }> = {
  FACEBOOK: { label: "FB", cls: "platform-fb" },
  INSTAGRAM: { label: "IG", cls: "platform-ig" },
  LINKEDIN: { label: "LI", cls: "platform-li" },
  OMG: { label: "OMG", cls: "platform-omg" },
};

function formatNextRun(iso: string | null) {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return "Due now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 72) return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  if (h > 0) return `Next in ${h}h ${m}m`;
  if (m > 0) return `Next in ${m}m`;
  return "Due soon";
}

function formatAgo(iso: string) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  const r = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (sec < 45) return "just now";
  if (sec < 3600) return r.format(-Math.floor(sec / 60), "minute");
  if (sec < 86400) return r.format(-Math.floor(sec / 3600), "hour");
  return r.format(-Math.floor(sec / 86400), "day");
}

function formatScheduleTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardClient({
  initialStats,
  initialTopics,
  activeCampaignTotal,
  initialCampaigns,
  initialUpcoming,
  initialRecentRuns,
}: {
  initialStats: DashboardStats;
  initialTopics: Topic[];
  activeCampaignTotal: number;
  initialCampaigns: DashboardCampaignRow[];
  initialUpcoming: DashboardUpcomingPost[];
  initialRecentRuns: DashboardRecentRun[];
}) {
  const router = useRouter();
  const [stats, setStats] = useState(initialStats);
  const [topics, setTopics] = useState(initialTopics);
  const [running, setRunning] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [recentRuns, setRecentRuns] = useState(initialRecentRuns);
  const [activeTotal, setActiveTotal] = useState(activeCampaignTotal);

  useEffect(() => {
    setStats(initialStats);
    setTopics(initialTopics);
    setCampaigns(initialCampaigns);
    setUpcoming(initialUpcoming);
    setRecentRuns(initialRecentRuns);
    setActiveTotal(activeCampaignTotal);
  }, [initialStats, initialTopics, initialCampaigns, initialUpcoming, initialRecentRuns, activeCampaignTotal]);

  const loadData = useCallback(async () => {
    const [sRes, tRes] = await Promise.all([fetch("/api/posts/stats"), fetch("/api/topics")]);
    if (sRes.ok) setStats(await sRes.json());
    if (tRes.ok) setTopics(await tRes.json());
  }, []);

  async function runAllAgents() {
    const activeTopics = topics.filter((t) => t.active);
    if (!activeTopics.length) {
      setRunLog("No active topics found. Add a topic first.");
      return;
    }
    setRunning("all");
    setRunLog(`Running AI agent for ${activeTopics.length} topic(s)…`);
    for (const t of activeTopics) {
      setRunLog(`Processing topic: ${t.name}…`);
      await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: t.id }),
      });
    }
    setRunning(null);
    setRunLog(`Done! ${activeTopics.length} post(s) created. Check the Queue.`);
    await loadData();
    router.refresh();
  }

  const statCards = [
    { label: "Pending review", value: stats.pending, href: "/queue" as const },
    { label: "Approved", value: stats.approved, href: "/queue" as const },
    { label: "Scheduled", value: stats.scheduled, href: "/calendar" as const },
    { label: "Published", value: stats.published, href: "/logs" as const },
  ];

  // Hide campaigns that have reached their post cap (progress bar full)
  const visibleCampaigns = campaigns.filter((c) => {
    const progress = getCampaignProgressBar({
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
    });
    return !(progress.showBar && progress.value >= progress.max);
  });

  return (
    <div style={{ width: "100%" }}>
      <PageHeader
        title="Dashboard"
        subtitle="Campaigns, upcoming posts, and queue health at a glance."
        icon={<LayoutDashboard size={28} strokeWidth={1.75} />}
      />

      {/* Stats strip — top, always visible */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {statCards.map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none", color: "inherit" }}>
            <StatCard label={s.label} value={s.value} />
          </Link>
        ))}
      </div>

      <div
        className="dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Lane A: Campaign command center */}
        <div
          className="omg-card"
          style={{
            padding: "24px 22px 28px",
            background: "var(--navy-dim)",
            borderColor: "color-mix(in srgb, var(--info) 12%, var(--border))",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-bricolage, var(--font-funnel, sans-serif))",
                }}
              >
                Your campaigns
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                {visibleCampaigns.length === 0 && activeTotal > 0
                  ? "All caught up!"
                  : activeTotal === 0
                    ? "No active campaigns"
                    : `${activeTotal} active`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/campaigns" className="omg-btn-primary" style={{ fontSize: 13, padding: "8px 16px" }}>
                New campaign
              </Link>
              <Link href="/campaigns" className="omg-btn-ghost" style={{ fontSize: 13, padding: "8px 14px" }}>
                View all →
              </Link>
            </div>
          </div>

          {visibleCampaigns.length === 0 ? (
            <div style={{ padding: "20px 0" }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 12px" }}>
                Campaigns queue posts on your schedule: set keywords, platforms, and cadence — drafts go to the queue (or auto-approve) until they publish.
              </p>
              <Link href="/campaigns" className="omg-btn-primary" style={{ fontSize: 13, display: "inline-flex" }}>
                Create your first campaign
              </Link>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleCampaigns.map((c) => {
                const progress = getCampaignProgressBar({
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
                });
                return (
                  <li
                    key={c.id}
                    className="omg-card is-interactive"
                    style={{ position: "relative", padding: "14px 16px", background: "var(--bg-surface)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{c.name}</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                          <span className="omg-badge" style={{ background: "var(--navy-dim)", color: "var(--info)" }}>
                            {c.cadence.replace(/_/g, " ")}
                          </span>
                          <span suppressHydrationWarning style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatNextRun(c.nextRunAt)}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, alignItems: "center" }}>
                          {c.platforms.map((p) => (
                            <PlatformIcon key={p} platform={p} size={15} />
                          ))}
                        </div>
                        {progress.showBar ? (
                          <>
                            <p style={{ margin: "8px 0 4px", fontSize: 12, color: "var(--text-secondary)" }}>{progress.subtitle}</p>
                            <ProgressBar
                              value={progress.value}
                              max={Math.max(1, progress.max)}
                              label="Progress"
                              compact
                              ratioLabelOverride={progress.ratioLabel}
                            />
                          </>
                        ) : (
                          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{progress.subtitle}</p>
                        )}
                      </div>
                      {c.nextRunAt ? <CountdownRing targetIso={c.nextRunAt} label="Next run" size={50} /> : null}
                    </div>
                    <Link
                      href={`/campaigns/${c.id}`}
                      aria-label={`Open ${c.name}`}
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        borderRadius: "inherit",
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Lane B: Upcoming + recent runs + quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="omg-card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Upcoming (next 5)
            </div>
            {upcoming.length === 0 ? (
              <p style={{ margin: 0, padding: "20px 16px", fontSize: 13, color: "var(--text-muted)" }}>No scheduled posts yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {upcoming.map((p) => {
                  const pill = platformPill[p.platform] ?? { label: p.platform, cls: "platform-omg" };
                  return (
                    <li
                      key={p.id}
                      style={{
                        padding: "10px 16px",
                        borderBottom: "1px solid var(--border-muted)",
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 8,
                        alignItems: "start",
                      }}
                    >
                      <CountdownRing targetIso={p.scheduledAt} label="Publish" size={44} />
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span suppressHydrationWarning style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatScheduleTime(p.scheduledAt)}</span>
                          <PlatformIcon platform={p.platform} size={14} />
                      </div>
                      {p.campaignName && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--info)" }}>{p.campaignName}</span>
                      )}
                      {p.captionSnippet ? (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{p.captionSnippet}</p>
                      ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
