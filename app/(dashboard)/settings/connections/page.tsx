"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui";

function ConnectionCard({
  title,
  icon,
  connected,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="omg-card is-interactive" style={{ padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 20,
            background: connected ? "var(--success-dim)" : "var(--warning-dim)",
            color: connected ? "var(--success)" : "var(--warning)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {connected ? (
            <span className="pulse-dot pulse-dot--ok" style={{ width: 7, height: 7 }} aria-hidden />
          ) : (
            <span className="pulse-dot" style={{ width: 7, height: 7 }} aria-hidden />
          )}
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      {children}
    </div>
  );
}

function ConnectionsInner() {
  const sp = useSearchParams();
  const [meta, setMeta] = useState({ pageAccessToken: "", pageId: "", igUserId: "" });
  const [li, setLi] = useState({ accessToken: "", personUrn: "" });
  const [metaOk, setMetaOk] = useState(false);
  const [liOk, setLiOk] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/settings/credentials/meta").then(r => r.json()).then(j => setMetaOk(!!j.connected));
    fetch("/api/settings/credentials/linkedin").then(r => r.json()).then(j => setLiOk(!!j.connected));
  }, []);

  useEffect(() => {
    const l = sp.get("linkedin");
    if (l === "ok") setMsg({ text: "LinkedIn connected successfully.", type: "success" });
    if (l && l !== "ok") setMsg({ text: `LinkedIn OAuth error: ${l}`, type: "error" });
  }, [sp]);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/credentials/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    setMsg(res.ok
      ? { text: "Meta credentials saved successfully.", type: "success" }
      : { text: "Failed to save Meta credentials.", type: "error" }
    );
    if (res.ok) setMetaOk(true);
  }

  async function saveLiManual(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/credentials/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(li),
    });
    setMsg(res.ok
      ? { text: "LinkedIn credentials saved.", type: "success" }
      : { text: "Failed to save LinkedIn credentials.", type: "error" }
    );
    if (res.ok) setLiOk(true);
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <PageHeader
        title="Platform Connections"
        subtitle="Connect your social media accounts to enable automated posting."
        icon={<Link2 size={28} strokeWidth={1.75} />}
      />

      {msg && (
        <div style={{
          background: msg.type === "success" ? "var(--success-dim)" : "var(--danger-dim)",
          border: `1px solid ${msg.type === "success" ? "var(--ring-success)" : "var(--ring-danger)"}`,
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: msg.type === "success" ? "var(--success)" : "var(--danger)",
          marginBottom: 20,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {msg.type === "success"
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          }
          {msg.text}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Meta */}
        <ConnectionCard
          title="Meta — Facebook & Instagram"
          connected={metaOk}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
            </svg>
          }
        >
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
            Uses a Facebook Page Access Token to post to your Page and linked Instagram Business account.
            Generate a long-lived page token in Meta Business Suite → Settings → Advanced → Page Access Tokens.
          </p>
          <form onSubmit={saveMeta} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Page Access Token</label>
              <input
                className="omg-input"
                style={{ fontSize: 13 }}
                placeholder="EAAxxxxxx…"
                value={meta.pageAccessToken}
                onChange={e => setMeta({ ...meta, pageAccessToken: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Facebook Page ID</label>
                <input
                  className="omg-input"
                  style={{ fontSize: 13 }}
                  placeholder="123456789012345"
                  value={meta.pageId}
                  onChange={e => setMeta({ ...meta, pageId: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Instagram Business User ID</label>
                <input
                  className="omg-input"
                  style={{ fontSize: 13 }}
                  placeholder="17841400000000000"
                  value={meta.igUserId}
                  onChange={e => setMeta({ ...meta, igUserId: e.target.value })}
                />
              </div>
            </div>
            <div>
              <button type="submit" className="omg-btn-primary" style={{ fontSize: 13 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                Save Meta credentials
              </button>
            </div>
          </form>
        </ConnectionCard>

        {/* LinkedIn */}
        <ConnectionCard
          title="LinkedIn — Personal Profile"
          connected={liOk}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--li)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
              <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
            </svg>
          }
        >
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
            Posts to your personal LinkedIn profile. Use OAuth below or paste your access token and Person URN manually.
          </p>

          {/* OAuth */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <a
              href="/api/oauth/linkedin"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 8,
                background: "var(--li-dim-bg)",
                border: "1px solid var(--ring-li)",
                color: "var(--li)", fontSize: 13, fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              Connect with LinkedIn OAuth
            </a>
            <a
              href="/settings/linkedin-test"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 8,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Test post (image + caption)
            </a>
          </div>

          <hr className="omg-divider" style={{ marginBottom: 14 }} />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Or paste tokens manually:</p>

          <form onSubmit={saveLiManual} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Access Token</label>
              <input
                className="omg-input"
                style={{ fontSize: 13 }}
                placeholder="AQxxxxxx…"
                value={li.accessToken}
                onChange={e => setLi({ ...li, accessToken: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Person URN</label>
              <input
                className="omg-input"
                style={{ fontSize: 13 }}
                placeholder="urn:li:person:xxxxxxxxxxxx"
                value={li.personUrn}
                onChange={e => setLi({ ...li, personUrn: e.target.value })}
              />
            </div>
            <div>
              <button type="submit" className="omg-btn-ghost" style={{ fontSize: 13 }}>
                Save LinkedIn manually
              </button>
            </div>
          </form>
        </ConnectionCard>

        {/* OMG Cargo info */}
        <div className="omg-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>OMG Cargo Website</h2>
            </div>
            <span style={{
              marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: "var(--accent-dim)", color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Auto-configured
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Posts to <span style={{ color: "var(--accent)" }}>cargo.omgexp.com</span> use the{" "}
            <code style={{ background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>OMG_API_URL</code> and{" "}
            <code style={{ background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>OMG_API_KEY</code>{" "}
            environment variables. These are configured in your <code style={{ background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>.env</code> file or Vercel project settings.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", paddingTop: 40 }}>
        <span className="spinner" /> Loading…
      </div>
    }>
      <ConnectionsInner />
    </Suspense>
  );
}
