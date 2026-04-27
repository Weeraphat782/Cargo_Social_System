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

  return (
    <div style={{ width: "100%" }}>
      <PageHeader
        title="Dashboard"
        subtitle="Campaigns, upcoming posts, and queue health at a glance."
        icon={<LayoutDashboard size={28} strokeWidth={1.75} />}
      />

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
            minHeight: 320,
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
                {activeTotal === 0 ? "No active campaigns" : `${activeTotal} active`}
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

          {campaigns.length === 0 ? (
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
              {campaigns.map((c) => {
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
              Recent campaign runs
            </div>
            {recentRuns.length === 0 ? (
              <p style={{ margin: 0, padding: "20px 16px", fontSize: 13, color: "var(--text-muted)" }}>No runs yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recentRuns.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      title={r.ok ? "OK" : "Failed"}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: r.ok ? "var(--success)" : "var(--danger)",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{r.campaignName}</div>
                      <div suppressHydrationWarning style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatAgo(r.startedAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="omg-card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Quick actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={runAllAgents} disabled={!!running} className="omg-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
                {running ? (
                  <>
                    <span className="spinner" />
                    Running…
                  </>
                ) : (
                  "Run AI for active topics"
                )}
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Link href="/topics" className="omg-btn-ghost" style={{ justifyContent: "center", fontSize: 12 }}>
                  Browse topics
                </Link>
                <Link href="/queue" className="omg-btn-ghost" style={{ justifyContent: "center", fontSize: 12 }}>
                  Review queue
                </Link>
              </div>
              <Link href="/logs" className="omg-btn-ghost" style={{ justifyContent: "center", fontSize: 12, width: "100%" }}>
                Open logs
              </Link>
            </div>
            {runLog && (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: running ? "var(--text-secondary)" : "var(--success)", lineHeight: 1.4 }}>
                {runLog}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Lane C: Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 24,
        }}
      >
        {statCards.map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none", color: "inherit" }}>
            <StatCard label={s.label} value={s.value} />
          </Link>
        ))}
      </div>

      {/* Recent topics (compact) */}
      <div className="omg-card" style={{ padding: 0, overflow: "hidden", marginTop: 24 }}>
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recent topics</h3>
          <Link href="/topics" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Manage all →
          </Link>
        </div>
        {topics.length === 0 ? (
          <div style={{ padding: "24px 18px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>No topics yet. Create one to run the topic-based agent.</p>
            <Link href="/topics" className="omg-btn-primary" style={{ fontSize: 13, padding: "8px 16px" }}>
              Add topic
            </Link>
          </div>
        ) : (
          <div style={{ padding: "8px 12px" }}>
            {topics.slice(0, 5).map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 8px",
                  borderBottom: "1px solid var(--border-muted)",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.active ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {t.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>{t.keywords}</span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: t.active ? "var(--success-dim)" : "var(--slate-dim)",
                    color: t.active ? "var(--success)" : "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t.active ? "Active" : "Paused"}
                </span>
              </div>
            ))}
            {topics.length > 5 && <p style={{ margin: 0, padding: "4px 8px 10px", fontSize: 11, color: "var(--text-muted)" }}>Showing 5 of {topics.length} topics.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
