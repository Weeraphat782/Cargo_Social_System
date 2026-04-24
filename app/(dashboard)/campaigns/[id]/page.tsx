"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FileStack } from "lucide-react";
import type { Campaign, CampaignRun, CampaignStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { getCampaignProgressBar } from "@/lib/campaigns-progress";
import { CountdownRing, PageHeader, ProgressBar, Skeleton } from "@/components/ui";

type CampaignPost = {
  id: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  topic: { name: string } | null;
  sourceNews: { title: string; url: string } | null;
  variants: Array<{
    id: string;
    platform: string;
    caption: string;
    hashtags: string | null;
    title: string | null;
    slug: string | null;
    publishedAt: string | null;
    remoteId: string | null;
    media: Array<{ id: string; imageUrl: string }>;
  }>;
};

type CampaignDetail = Campaign & {
  _count: { posts: number };
  publishedCount: number;
  upcomingRuns: string[];
  runs: CampaignRun[];
  posts: CampaignPost[];
};

const platformMeta: Record<string, { label: string; cls: string }> = {
  FACEBOOK: { label: "Facebook", cls: "platform-fb" },
  INSTAGRAM: { label: "Instagram", cls: "platform-ig" },
  LINKEDIN: { label: "LinkedIn", cls: "platform-li" },
  OMG: { label: "OMG Cargo", cls: "platform-omg" },
};

const statusBadge: Record<string, string> = {
  PENDING_APPROVAL: "omg-badge-pending",
  APPROVED: "omg-badge-approved",
  PUBLISHED: "omg-badge-published",
  FAILED: "omg-badge-failed",
  REJECTED: "omg-badge-rejected",
  SCHEDULED: "omg-badge-scheduled",
  DRAFTING: "omg-badge-pending",
};

const PLATFORM_ORDER = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as const;

function sortByPlatform<T extends { platform: string }>(variants: T[]): T[] {
  return [...variants].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a.platform as (typeof PLATFORM_ORDER)[number]);
    const ib = PLATFORM_ORDER.indexOf(b.platform as (typeof PLATFORM_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

const CAPTION_LONG_THRESHOLD = 240;

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [c, setC] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState<Record<string, string>>({});
  const [captionExpanded, setCaptionExpanded] = useState<Record<string, boolean>>({});
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${id}`);
    if (res.ok) {
      setC(await res.json());
    } else {
      setC(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(s: CampaignStatus) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
    if (res.ok) await load();
  }

  async function runNow() {
    if (!c) return;
    if (c.autoApprove) {
      const approxMin = 2 + (c.postsPerRun - 1) * 5;
      const ok = window.confirm(
        `Auto-approve is ON. This test run will publish ${c.postsPerRun} post(s) to live platforms within ~${approxMin} minutes. Continue?`
      );
      if (!ok) return;
    }
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/run`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; postIds?: string[]; error?: string };
      if (data.ok) {
        setMsg(`Created: ${(data.postIds ?? []).join(", ")}`);
        await load();
      } else {
        setMsg(data.error ?? "Error");
      }
    } catch {
      setMsg("Request failed");
    }
    setRunning(false);
  }

  async function approvePost(postId: string) {
    setActioning(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) await load();
    } finally {
      setActioning(null);
    }
  }

  async function rejectPost(postId: string) {
    setActioning(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/reject`, { method: "POST" });
      if (res.ok) await load();
    } finally {
      setActioning(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/campaigns");
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900 }}>
        <Skeleton variant="card" height={100} style={{ marginBottom: 12 }} />
        <Skeleton variant="line" width="100%" height={20} style={{ marginBottom: 8 }} />
        <Skeleton variant="line" width="60%" height={14} />
      </div>
    );
  }
  if (!c) {
    return (
      <p>
        Not found. <Link href="/campaigns">Back</Link>
      </p>
    );
  }

  const postsN = c.postsPerRun;
  const postWord = postsN !== 1 ? "posts" : "post";

  const nextRunAtPreview = c.nextRunAt
    ? new Date(c.nextRunAt).toLocaleString()
    : "the next scheduled time (see Schedule below)";

  const st = c.status;
  const primaryStatusButton =
    st === "DRAFT" ? (
      <button type="button" className="omg-btn-primary" onClick={() => void setStatus("ACTIVE")}>
        Activate
      </button>
    ) : st === "ACTIVE" ? (
      <button type="button" className="omg-btn-primary" onClick={() => void setStatus("PAUSED")}>
        Pause
      </button>
    ) : st === "PAUSED" ? (
      <button type="button" className="omg-btn-primary" onClick={() => void setStatus("ACTIVE")}>
        Resume
      </button>
    ) : (
      <button type="button" className="omg-btn-ghost" disabled style={{ pointerEvents: "none" }}>
        Completed
      </button>
    );

  const progress = getCampaignProgressBar({
    totalPostsCap: c.totalPostsCap,
    endAt: c.endAt ? new Date(c.endAt as Date | string).toISOString() : null,
    cadence: c.cadence,
    dayOfWeek: c.dayOfWeek,
    hourOfDay: c.hourOfDay,
    timezone: c.timezone,
    startAt: new Date(c.startAt as Date | string).toISOString(),
    postsPerRun: c.postsPerRun,
    customCron: c.customCron,
    scheduleConfig: c.scheduleConfig,
    postCount: c._count.posts,
    publishedCount: c.publishedCount,
  });

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/campaigns" style={{ fontSize: 12, color: "var(--accent)" }}>
          ← Campaigns
        </Link>
      </div>
      <PageHeader
        title={c.name}
        subtitle={`${c.status} · ${c.contentMode} · ${c.cadence} · theme ${c.theme} · ${c.timezone}`}
        icon={<FileStack size={28} strokeWidth={1.75} />}
      />
      <div
        className="omg-card is-interactive"
        style={{
          padding: 16,
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          {progress.showBar ? (
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: "var(--text-muted)" }}>{progress.subtitle}</p>
              <ProgressBar
                value={progress.value}
                max={Math.max(1, progress.max)}
                label="Published posts"
                ratioLabelOverride={progress.ratioLabel}
              />
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{progress.subtitle}</p>
          )}
        </div>
        {c.nextRunAt != null ? (
          <CountdownRing targetIso={new Date(c.nextRunAt as Date | string).toISOString()} label="Next run" size={56} />
        ) : null}
      </div>
      {c.description && <p style={{ maxWidth: 640, marginTop: 0 }}>{c.description}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 16 }}>
        {primaryStatusButton}
        <button
          type="button"
          className="omg-btn-ghost"
          disabled={running || c.status === "COMPLETED"}
          title="Generate one batch now, outside the schedule (does not change next run time)"
          onClick={() => void runNow()}
        >
          {running ? "Running…" : "Test run"}
        </button>
        <select
          className="omg-input"
          value={c.status}
          onChange={(e) => void setStatus(e.target.value as CampaignStatus)}
          style={{ width: 130, fontSize: 12 }}
        >
          {(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {c.status !== "COMPLETED" && (
          <Link
            href={`/campaigns/${id}/edit`}
            className="omg-btn-ghost"
            style={{ fontSize: 12, textDecoration: "none" }}
          >
            Edit
          </Link>
        )}
        <button type="button" className="omg-btn-danger" onClick={() => void remove()}>
          Delete
        </button>
      </div>
      {c.status === "DRAFT" && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, maxWidth: 640, lineHeight: 1.5 }}>
          Not producing posts on schedule yet. Click <strong>Activate</strong> to let the scheduler run this campaign at{" "}
          <strong>{nextRunAtPreview}</strong>.
        </p>
      )}
      {msg && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>{msg}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 28, maxWidth: 1100 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Schedule</h2>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "grid", gap: 4 }}>
            <span>Next run: {c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "—"}</span>
            <span>Last run: {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : "—"}</span>
            {c.cadence === "TEST_MINUTES" && Array.isArray((c.scheduleConfig as { datetimes?: string[] } | null)?.datetimes) ? (
              <span>
                Test slots (TZ {c.timezone}):{" "}
                {((c.scheduleConfig as { datetimes: string[] }).datetimes || []).join(", ")}
              </span>
            ) : null}
            {c.upcomingRuns.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Upcoming runs
                </div>
                <ul
                  style={{
                    margin: "0 0 8px",
                    paddingLeft: 18,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "grid",
                    gap: 2,
                  }}
                >
                  {c.upcomingRuns.slice(0, 8).map((iso) => (
                    <li key={iso} suppressHydrationWarning>
                      {formatInTimeZone(new Date(iso), c.timezone, "EEE, dd MMM yyyy, HH:mm")}
                    </li>
                  ))}
                  {c.upcomingRuns.length > 8 ? (
                    <li style={{ listStyle: "none", color: "var(--text-secondary)" }}>+{c.upcomingRuns.length - 8} more</li>
                  ) : null}
                </ul>
                <span>posts/run: {c.postsPerRun} · TZ {c.timezone}</span>
              </div>
            ) : (
              <span>Day: {c.dayOfWeek} · Hour: {c.hourOfDay} · posts/run: {c.postsPerRun}</span>
            )}
            <span>Auto-approve: {c.autoApprove ? "yes" : "no"}</span>
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Keywords</h2>
          <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.keywords}</p>
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, marginTop: 24 }}>Recent runs</h2>
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-elevated)", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Started</th>
              <th style={{ padding: 8 }}>OK</th>
              <th style={{ padding: 8 }}>Post</th>
              <th style={{ padding: 8 }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {c.runs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "var(--text-muted)" }}>
                  No runs yet
                </td>
              </tr>
            ) : (
              c.runs.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 8 }}>{new Date(r.startedAt).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{r.ok ? "yes" : "no"}</td>
                  <td style={{ padding: 8 }}>{r.postId ? r.postId.slice(0, 8) + "…" : "—"}</td>
                  <td style={{ padding: 8, color: "var(--danger)" }}>{r.error ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Posts</h2>
      {c.posts.length === 0 ? (
        <div
          className="omg-card"
          style={{ padding: "20px 16px", maxWidth: 520, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}
        >
          <p style={{ margin: 0, marginBottom: 8 }}>No posts from this campaign yet.</p>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Click <strong>Run now</strong> above to generate the first batch ({postsN} {postWord} per run).
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 16,
          }}
        >
          {c.posts.map((post) => {
            const sorted = sortByPlatform(post.variants);
            const defPlat = sorted[0]?.platform ?? "FACEBOOK";
            const activePlat = activePlatformTab[post.id] ?? defPlat;
            const v = sorted.find((x) => x.platform === activePlat) ?? sorted[0];
            const capText = (v?.caption ?? "").trim();
            const longCaption = capText.length > CAPTION_LONG_THRESHOLD;
            const expanded = captionExpanded[post.id] === true;
            const showClamp = longCaption && !expanded;

            return (
              <div key={post.id} className="omg-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                      {post.topic?.name ?? "Post"}
                    </span>
                    <span className={`omg-badge ${statusBadge[post.status] ?? "omg-badge-pending"}`}>
                      {post.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                  {post.sourceNews && (
                    <a
                      href={post.sourceNews.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 12,
                        color: "var(--accent)",
                        textDecoration: "none",
                        wordBreak: "break-word",
                      }}
                    >
                      {post.sourceNews.title}
                    </a>
                  )}
                  {post.status === "SCHEDULED" && post.scheduledAt && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--purple)", fontWeight: 600 }}>
                      Scheduled:{" "}
                      {new Date(post.scheduledAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>

                {sorted.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      padding: "10px 16px 0",
                      background: "var(--bg-elevated)",
                      borderTop: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border-muted)",
                    }}
                  >
                    {sorted.map((variant) => {
                      const active = activePlat === variant.platform;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() =>
                            setActivePlatformTab((prev) => ({ ...prev, [post.id]: variant.platform }))
                          }
                          className="omg-btn-ghost"
                          style={{
                            fontSize: 12,
                            padding: "6px 12px",
                            background: active ? "var(--accent-dim)" : "var(--bg-surface)",
                            borderColor: active ? "var(--ring-accent)" : "var(--border)",
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          {platformMeta[variant.platform]?.label ?? variant.platform}
                        </button>
                      );
                    })}
                  </div>
                )}

                {v && (
                  <div style={{ padding: 16 }}>
                    {v.platform === "OMG" && (v.title || v.slug) && (
                      <div style={{ marginBottom: 8 }}>
                        {v.title && (
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                            {v.title}
                          </div>
                        )}
                        {v.slug && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>/{v.slug}</div>
                        )}
                      </div>
                    )}
                    {v.media[0]?.imageUrl ? (
                      <img
                        src={v.media[0].imageUrl}
                        alt=""
                        style={{
                          width: "100%",
                          maxHeight: 220,
                          objectFit: "cover",
                          borderRadius: 8,
                          marginBottom: 10,
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          minHeight: 120,
                          borderRadius: 8,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                          color: "var(--text-muted)",
                          marginBottom: 10,
                        }}
                      >
                        📝
                      </div>
                    )}
                    {capText && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "var(--text-primary)",
                          lineHeight: 1.5,
                          ...(showClamp
                            ? {
                                display: "-webkit-box",
                                WebkitLineClamp: 5,
                                WebkitBoxOrient: "vertical" as const,
                                overflow: "hidden",
                              }
                            : {}),
                        }}
                      >
                        {capText}
                      </p>
                    )}
                    {v.platform === "INSTAGRAM" && v.hashtags && (
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: 12,
                          color: "var(--text-muted)",
                          lineHeight: 1.45,
                        }}
                      >
                        {v.hashtags}
                      </p>
                    )}
                    {longCaption && (
                      <button
                        type="button"
                        className="omg-btn-ghost"
                        style={{ marginTop: 8, fontSize: 12, padding: "4px 0" }}
                        onClick={() =>
                          setCaptionExpanded((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                      >
                        {expanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  {post.status === "PENDING_APPROVAL" && (
                    <>
                      <button
                        type="button"
                        className="omg-btn-primary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        disabled={actioning === post.id}
                        onClick={() => void approvePost(post.id)}
                      >
                        {actioning === post.id ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="omg-btn-ghost"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        disabled={actioning === post.id}
                        onClick={() => void rejectPost(post.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <Link
                    href={`/queue#${post.id}`}
                    className="omg-btn-ghost"
                    style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}
                  >
                    Open in queue
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
