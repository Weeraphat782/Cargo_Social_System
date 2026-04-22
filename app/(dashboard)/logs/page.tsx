"use client";

import { useCallback, useEffect, useState } from "react";

type Log = {
  id: string;
  platform: string;
  attemptAt: string;
  success: boolean;
  remoteId: string | null;
  errorMessage: string | null;
  post: { id: string; topic: { name: string } | null };
};

const platformMeta: Record<string, { label: string; cls: string }> = {
  FACEBOOK:  { label: "Facebook",  cls: "platform-fb" },
  INSTAGRAM: { label: "Instagram", cls: "platform-ig" },
  LINKEDIN:  { label: "LinkedIn",  cls: "platform-li" },
  OMG:       { label: "OMG Cargo", cls: "platform-omg" },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/logs");
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l =>
    filter === "all" ? true : filter === "success" ? l.success : !l.success
  );

  const successCount = logs.filter(l => l.success).length;
  const failedCount = logs.filter(l => !l.success).length;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", paddingTop: 40 }}>
        <span className="spinner" /> Loading logs…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Publish Logs</h1>
        <p className="page-subtitle">History of all publish attempts across platforms.</p>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="omg-card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{logs.length}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Total attempts</span>
        </div>
        <div className="omg-card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>{successCount}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Successful</span>
        </div>
        <div className="omg-card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--danger)" }}>{failedCount}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Failed</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {(["all", "success", "failed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                border: "1px solid",
                borderColor: filter === f ? "var(--border-focus)" : "var(--border)",
                background: filter === f ? "var(--accent-dim)" : "transparent",
                color: filter === f ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.15s",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
          <button className="omg-btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={load}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="omg-card" style={{ overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No logs found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="omg-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Topic</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Remote ID</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(l.attemptAt).toLocaleString()}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {l.post.topic?.name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td>
                      <span className={`platform-pill ${platformMeta[l.platform]?.cls ?? ""}`}>
                        {platformMeta[l.platform]?.label ?? l.platform}
                      </span>
                    </td>
                    <td>
                      {l.success ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          Success
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          Failed
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                      {l.remoteId ?? "—"}
                    </td>
                    <td style={{ maxWidth: 260, fontSize: 11 }}>
                      {l.errorMessage ? (
                        <span style={{ color: "var(--danger)", wordBreak: "break-word" }}>{l.errorMessage}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
