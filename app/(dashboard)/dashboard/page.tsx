"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  pending: number;
  approved: number;
  scheduled: number;
  published: number;
  topics: number;
};

type Topic = { id: string; name: string; keywords: string; active: boolean };

const platforms = [
  { key: "FACEBOOK",  label: "Facebook",  color: "var(--fb)",  icon: "f", cls: "platform-fb" },
  { key: "INSTAGRAM", label: "Instagram", color: "var(--ig)",  icon: "ig", cls: "platform-ig" },
  { key: "LINKEDIN",  label: "LinkedIn",  color: "var(--li)",  icon: "in", cls: "platform-li" },
  { key: "OMG",       label: "OMG Cargo", color: "var(--omg)", icon: "⬡", cls: "platform-omg" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, scheduled: 0, published: 0, topics: 0 });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [postsRes, topicsRes] = await Promise.all([
      fetch("/api/posts?status=PENDING_APPROVAL,APPROVED,SCHEDULED,PUBLISHED"),
      fetch("/api/topics"),
    ]);
    const posts = postsRes.ok ? await postsRes.json() : [];
    const topicsList = topicsRes.ok ? await topicsRes.json() : [];
    setTopics(topicsList);
    setStats({
      pending:   posts.filter((p: { status: string }) => p.status === "PENDING_APPROVAL").length,
      approved:  posts.filter((p: { status: string }) => p.status === "APPROVED").length,
      scheduled: posts.filter((p: { status: string }) => p.status === "SCHEDULED").length,
      published: posts.filter((p: { status: string }) => p.status === "PUBLISHED").length,
      topics:    topicsList.length,
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function runAllAgents() {
    const activeTopics = topics.filter(t => t.active);
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
  }

  const statCards = [
    { label: "Pending Review", value: stats.pending, color: "var(--warning)", dim: "var(--warning-dim)", href: "/queue" },
    { label: "Approved", value: stats.approved, color: "var(--success)", dim: "var(--success-dim)", href: "/queue" },
    { label: "Scheduled", value: stats.scheduled, color: "var(--purple)", dim: "var(--purple-dim)", href: "/calendar" },
    { label: "Published", value: stats.published, color: "var(--accent)", dim: "var(--accent-dim)", href: "/logs" },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">AI Social Media Command Center</h1>
        <p className="page-subtitle">One click to research news, generate content, and publish across all platforms.</p>
      </div>

      {/* Run Agent Hero */}
      <div
        className="omg-card"
        style={{
          padding: "32px 28px",
          marginBottom: 28,
          background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 200, height: 200,
          background: "radial-gradient(circle, rgba(26,140,255,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Run AI Agent</h2>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Gemini searches Google for the latest news on your topics, writes tailored captions for each platform,
              generates images with Gemini, and queues everything for your review.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {platforms.map(p => (
                <span key={p.key} className={`platform-pill ${p.cls}`}>{p.label}</span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <button
              onClick={runAllAgents}
              disabled={!!running}
              className={`omg-btn-primary${!running ? " glow-pulse" : ""}`}
              style={{ padding: "14px 28px", fontSize: 15, borderRadius: 10 }}
            >
              {running ? (
                <>
                  <span className="spinner" />
                  Running…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Run Agent Now
                </>
              )}
            </button>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {topics.filter(t => t.active).length} active topic{topics.filter(t => t.active).length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {runLog && (
          <div style={{
            marginTop: 16,
            background: running ? "var(--accent-dim)" : "var(--success-dim)",
            border: `1px solid ${running ? "var(--accent-glow)" : "rgba(0,212,170,0.3)"}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: running ? "var(--accent)" : "var(--success)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {running && <span className="spinner" style={{ width: 12, height: 12 }} />}
            {runLog}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        {statCards.map(s => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none" }}>
            <div className="omg-card" style={{ padding: "18px 20px", cursor: "pointer" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              <div style={{ width: "100%", height: 2, background: s.dim, borderRadius: 1, marginTop: 10 }}>
                <div style={{ width: s.value > 0 ? "100%" : "0%", height: "100%", background: s.color, borderRadius: 1, transition: "width 0.5s" }} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Active Topics */}
      <div className="omg-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Active Topics</h3>
          <Link href="/topics" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Manage →</Link>
        </div>
        {topics.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>No topics yet. Create one to get started.</p>
            <Link href="/topics" className="omg-btn-primary" style={{ fontSize: 13, padding: "8px 16px" }}>Add Topic</Link>
          </div>
        ) : (
          <div style={{ padding: "8px 12px" }}>
            {topics.map(t => (
              <div key={t.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 8px",
                borderBottom: "1px solid var(--border-muted)",
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.active ? "var(--text-primary)" : "var(--text-muted)" }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>{t.keywords}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                  background: t.active ? "var(--success-dim)" : "rgba(100,116,139,0.15)",
                  color: t.active ? "var(--success)" : "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {t.active ? "Active" : "Paused"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platforms info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginTop: 28 }}>
        {[
          { label: "Facebook", cls: "platform-fb", desc: "Page posts via Graph API", icon: "📘" },
          { label: "Instagram", cls: "platform-ig", desc: "Business account via Meta", icon: "📸" },
          { label: "LinkedIn", cls: "platform-li", desc: "Personal profile posts", icon: "💼" },
          { label: "OMG Cargo", cls: "platform-omg", desc: "cargo.omgexp.com news", icon: "✈️" },
        ].map(p => (
          <div key={p.label} className="omg-card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <span className={`platform-pill ${p.cls}`}>{p.label}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
