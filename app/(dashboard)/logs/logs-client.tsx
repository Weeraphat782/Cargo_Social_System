"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText } from "lucide-react";
import { PageHeader, PlatformPill, StatCard } from "@/components/ui";

export type LogRow = {
  id: string;
  platform: string;
  postId: string;
  attemptAt: string;
  success: boolean;
  remoteId: string | null;
  errorMessage: string | null;
  post: { id: string; status: string; topic: { name: string } | null };
};


export default function LogsClient({ initialLogs }: { initialLogs: LogRow[] }) {
  const [logs, setLogs] = useState<LogRow[]>(initialLogs);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/logs");
    if (res.ok) setLogs(await res.json());
  }, []);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const filtered = logs.filter(l =>
    filter === "all" ? true : filter === "success" ? l.success : !l.success
  );

  const successCount = logs.filter(l => l.success).length;
  const failedCount = logs.filter(l => !l.success).length;
  const rate = logs.length ? successCount / logs.length : 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        title="Publish Logs"
        subtitle="History of all publish attempts across platforms."
        icon={<ScrollText size={28} strokeWidth={1.75} />}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <StatCard label="Total attempts" value={logs.length} />
        <StatCard label="Successful" value={successCount} trend={rate >= 0.5 ? "up" : "flat"} />
        <StatCard label="Failed" value={failedCount} trend={failedCount > 0 ? "down" : "flat"} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        {(["all", "success", "failed"] as const).map(f => (
          <button
            key={f}
            type="button"
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
        <button type="button" className="omg-btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={load}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
          </svg>
          Refresh
        </button>
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
                {filtered.map((l, idx) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.25, idx * 0.02), duration: 0.2 }}
                  >
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(l.attemptAt).toLocaleString()}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {l.post.topic?.name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td>
                      <PlatformPill platform={l.platform} size={12} />
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
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
