"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Campaign, CampaignRun, CampaignStatus, Post, PostStatus } from "@prisma/client";

type CampaignDetail = Campaign & {
  runs: CampaignRun[];
  posts: (Post & { status: PostStatus })[];
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [c, setC] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function remove() {
    if (!confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/campaigns");
  }

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  }
  if (!c) {
    return (
      <p>
        Not found. <Link href="/campaigns">Back</Link>
      </p>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/campaigns" style={{ fontSize: 12, color: "var(--accent)" }}>
          ← Campaigns
        </Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{c.name}</h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
        {c.status} · {c.cadence} · theme {c.theme} · {c.timezone}
      </p>
      {c.description && <p style={{ maxWidth: 640 }}>{c.description}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        <select
          className="omg-input"
          value={c.status}
          onChange={(e) => void setStatus(e.target.value as CampaignStatus)}
          style={{ width: 160 }}
        >
          {(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="omg-btn-primary" disabled={running} onClick={() => void runNow()}>
          {running ? "Running…" : "Run now"}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent", cursor: "pointer" }}
        >
          Delete
        </button>
      </div>
      {msg && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>{msg}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 28, maxWidth: 1100 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Schedule</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Next run: {c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "—"}
            <br />
            Last run: {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : "—"}
            <br />
            Day: {c.dayOfWeek} · Hour: {c.hourOfDay} · posts/run: {c.postsPerRun}
            {c.totalPostsCap != null && (
              <>
                <br />
                Cap: {c.totalPostsCap}
              </>
            )}
            <br />
            Auto-approve: {c.autoApprove ? "yes" : "no"}
          </p>
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

      <h2 style={{ fontSize: 14, fontWeight: 600, marginTop: 24 }}>Posts</h2>
      <ul style={{ fontSize: 12, listStyle: "none", padding: 0, margin: 0 }}>
        {c.posts.length === 0 ? (
          <li style={{ color: "var(--text-muted)" }}>No posts from this campaign yet</li>
        ) : (
          c.posts.map((p) => (
            <li key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link href="/queue" style={{ color: "var(--accent)" }}>
                {p.id.slice(0, 8)}…
              </Link>{" "}
              — {p.status} — {new Date(p.createdAt).toLocaleString()}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
