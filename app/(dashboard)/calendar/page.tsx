"use client";

import { useCallback, useEffect, useState } from "react";

type Post = {
  id: string;
  status: string;
  scheduledAt: string | null;
  topic: { name: string } | null;
  variants: Array<{ platform: string }>;
};

const platformMeta: Record<string, { label: string; cls: string }> = {
  FACEBOOK:  { label: "Facebook",  cls: "platform-fb" },
  INSTAGRAM: { label: "Instagram", cls: "platform-ig" },
  LINKEDIN:  { label: "LinkedIn",  cls: "platform-li" },
  OMG:       { label: "OMG Cargo", cls: "platform-omg" },
};

function groupByDate(posts: Post[]): Record<string, Post[]> {
  return posts.reduce<Record<string, Post[]>>((acc, post) => {
    const date = post.scheduledAt
      ? new Date(post.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "Unscheduled";
    if (!acc[date]) acc[date] = [];
    acc[date].push(post);
    return acc;
  }, {});
}

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/posts?status=SCHEDULED");
    if (res.ok) setPosts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", paddingTop: 40 }}>
        <span className="spinner" /> Loading schedule…
      </div>
    );
  }

  const grouped = groupByDate(posts);
  const dates = Object.keys(grouped);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Scheduled Posts</h1>
        <p className="page-subtitle">Posts in SCHEDULED status publish automatically when the cron runs.</p>
      </div>

      {/* Cron info */}
      <div style={{
        background: "var(--accent-dim)",
        border: "1px solid var(--accent-glow)",
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 24,
        fontSize: 12,
        color: "var(--accent)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span>
          Auto-publish via <code style={{ background: "rgba(26,140,255,0.2)", padding: "1px 6px", borderRadius: 4 }}>/api/cron/publish</code> · Requires <code style={{ background: "rgba(26,140,255,0.2)", padding: "1px 6px", borderRadius: 4 }}>CRON_SECRET</code> in env
        </span>
      </div>

      {posts.length === 0 ? (
        <div className="omg-card" style={{ padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>No scheduled posts</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Approve posts and use &quot;Schedule&quot; to set a publish time.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {dates.map(date => (
            <div key={date}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", color: "var(--text-muted)",
                marginBottom: 8, paddingLeft: 4,
              }}>
                {date}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grouped[date].map(p => (
                  <div key={p.id} className="omg-card" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {p.topic?.name ?? "Post"}
                        </span>
                        <span className="omg-badge omg-badge-scheduled">Scheduled</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {p.variants?.map(v => (
                          <span key={v.platform} className={`platform-pill ${platformMeta[v.platform]?.cls ?? ""}`}>
                            {platformMeta[v.platform]?.label ?? v.platform}
                          </span>
                        ))}
                      </div>
                    </div>
                    {p.scheduledAt && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--purple)" }}>
                          {new Date(p.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {new Date(p.scheduledAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
