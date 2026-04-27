"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { CollapsibleSection, CountdownRing, MotionList, PageHeader, SectionHeading } from "@/components/ui";

type Post = {
  id: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  topic: { name: string } | null;
  variants: Array<{ platform: string }>;
};

type UpcomingCampaign = {
  id: string;
  name: string;
  nextRunAt: string;
  postsPerRun: number;
  platforms: string[];
};

const platformMeta: Record<string, { label: string; cls: string }> = {
  FACEBOOK: { label: "Facebook", cls: "platform-fb" },
  INSTAGRAM: { label: "Instagram", cls: "platform-ig" },
  LINKEDIN: { label: "LinkedIn", cls: "platform-li" },
  OMG: { label: "OMG Cargo", cls: "platform-omg" },
};

const PLATFORM_ORDER = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as const;

function sortByPlatform<T extends { platform: string }>(variants: T[]): T[] {
  return [...variants].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a.platform as (typeof PLATFORM_ORDER)[number]);
    const ib = PLATFORM_ORDER.indexOf(b.platform as (typeof PLATFORM_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function groupByDate(posts: Post[], dateField: "scheduledAt" | "publishedAt"): Record<string, Post[]> {
  return posts.reduce<Record<string, Post[]>>((acc, post) => {
    const raw = post[dateField];
    const date = raw
      ? new Date(raw).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "Unscheduled";
    if (!acc[date]) acc[date] = [];
    acc[date].push(post);
    return acc;
  }, {});
}

function TimelineGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "relative", paddingLeft: 4, marginBottom: 8 }}>{children}</div>;
}

export default function CalendarClient({
  scheduledPosts,
  publishedPosts,
  upcomingCampaigns,
}: {
  scheduledPosts: Post[];
  publishedPosts: Post[];
  upcomingCampaigns: UpcomingCampaign[];
}) {
  const groupedScheduled = useMemo(() => groupByDate(scheduledPosts, "scheduledAt"), [scheduledPosts]);
  const groupedPublished = useMemo(() => groupByDate(publishedPosts, "publishedAt"), [publishedPosts]);
  const scheduledDates = Object.keys(groupedScheduled);
  const publishedDates = Object.keys(groupedPublished);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        title="Scheduled Posts"
        subtitle="Upcoming agent runs, posts waiting to publish, and posts published in the last 7 days. Refresh the page to update."
        icon={<Calendar size={28} strokeWidth={1.75} />}
      />

      <SectionHeading margin="0 0 12px">Waiting for cron</SectionHeading>
      {upcomingCampaigns.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>No active campaigns with a next run time scheduled.</p>
      ) : (
        <div
          style={{
            marginBottom: 28,
            paddingLeft: 12,
            marginLeft: 4,
            borderLeft: "2px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
          }}
        >
          <MotionList>
            {upcomingCampaigns.map((c) => (
              <div
                key={c.id}
                className="omg-card is-interactive"
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                    <span className="omg-badge omg-badge-pending" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                      Waiting for cron
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                    {c.postsPerRun} post{c.postsPerRun === 1 ? "" : "s"} per run
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {sortByPlatform(c.platforms.map((platform) => ({ platform }))).map(({ platform }) => (
                      <span key={platform} className={`platform-pill ${platformMeta[platform]?.cls ?? ""}`}>
                        {platformMeta[platform]?.label ?? platform}
                      </span>
                    ))}
                  </div>
                </div>
                <CountdownRing targetIso={c.nextRunAt} label="Agent" size={54} />
              </div>
            ))}
          </MotionList>
        </div>
      )}

      <SectionHeading>Waiting for publish</SectionHeading>
      {scheduledPosts.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>No posts queued for publish.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
          {scheduledDates.map((date) => (
            <TimelineGroup key={date}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  paddingLeft: 4,
                }}
              >
                {date}
              </div>
              <MotionList style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {groupedScheduled[date].map((p) => (
                  <div
                    key={p.id}
                    className="omg-card is-interactive"
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.topic?.name ?? "Post"}</span>
                        <span className="omg-badge omg-badge-scheduled">Waiting for publish</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {sortByPlatform(p.variants ?? []).map((v) => (
                          <span key={v.platform} className={`platform-pill ${platformMeta[v.platform]?.cls ?? ""}`}>
                            {platformMeta[v.platform]?.label ?? v.platform}
                          </span>
                        ))}
                      </div>
                    </div>
                    {p.scheduledAt ? <CountdownRing targetIso={p.scheduledAt} label="Publish" size={48} /> : null}
                  </div>
                ))}
              </MotionList>
            </TimelineGroup>
          ))}
        </div>
      )}

      <CollapsibleSection
        title="Published (last 7 days)"
        count={publishedPosts.length}
        defaultOpen={false}
        margin="28px 0 20px"
      >
      {publishedPosts.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 0 }}>No posts published in the last 7 days.</p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Showing {publishedPosts.length} post{publishedPosts.length === 1 ? "" : "s"} (last 7 days)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 8 }}>
            {publishedDates.map((date) => (
              <div key={date}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 8,
                    paddingLeft: 4,
                  }}
                >
                  {date}
                </div>
                <MotionList style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groupedPublished[date].map((p) => (
                    <div
                      key={p.id}
                      className="omg-card is-interactive"
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                        opacity: 0.95,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.topic?.name ?? "Post"}</span>
                          <span className="omg-badge omg-badge-published" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span className="pulse-dot pulse-dot--ok" style={{ width: 5, height: 5 }} />
                            Published
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {sortByPlatform(p.variants ?? []).map((v) => (
                            <span key={v.platform} className={`platform-pill ${platformMeta[v.platform]?.cls ?? ""}`}>
                              {platformMeta[v.platform]?.label ?? v.platform}
                            </span>
                          ))}
                        </div>
                      </div>
                      {p.publishedAt && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--success)" }}>
                            {new Date(p.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(p.publishedAt).toLocaleDateString()}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </MotionList>
              </div>
            ))}
          </div>
        </>
      )}
      </CollapsibleSection>
    </div>
  );
}
