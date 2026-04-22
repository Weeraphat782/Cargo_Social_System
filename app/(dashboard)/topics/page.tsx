"use client";

import { useCallback, useEffect, useState } from "react";

type Topic = {
  id: string;
  name: string;
  keywords: string;
  brandVoice: string | null;
  active: boolean;
};

type SuggestedTopic = {
  name: string;
  keywords: string;
  brandVoice: string;
  rationale: string;
};

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // AI Suggest state
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedTopic[]>([]);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch("/api/topics");
    if (res.ok) setTopics(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const [suggestError, setSuggestError] = useState<string | null>(null);

  async function suggestTopics() {
    setSuggesting(true);
    setSuggestions([]);
    setSuggestError(null);
    setAddedIds(new Set());
    try {
      const res = await fetch("/api/topics/suggest", { method: "POST" });
      const data = await res.json() as { topics?: SuggestedTopic[]; error?: string };
      if (!res.ok) {
        setSuggestError(data.error ?? `Error ${res.status} — check that GEMINI_API_KEY is set in .env`);
      } else {
        setSuggestions(data.topics ?? []);
      }
    } catch {
      setSuggestError("Network error — is the server running?");
    }
    setSuggesting(false);
  }

  async function addSuggestedTopic(s: SuggestedTopic, idx: number) {
    setAddingIds(prev => new Set(prev).add(idx));
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: s.name, keywords: s.keywords, brandVoice: s.brandVoice }),
    });
    setAddingIds(prev => { const n = new Set(prev); n.delete(idx); return n; });
    setAddedIds(prev => new Set(prev).add(idx));
    await load();
  }

  async function addAllSuggestions() {
    const toAdd = suggestions.filter((_, i) => !addedIds.has(i));
    for (let i = 0; i < suggestions.length; i++) {
      if (!addedIds.has(i)) {
        await addSuggestedTopic(suggestions[i], i);
      }
    }
    void toAdd;
  }

  async function createTopic(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, keywords, brandVoice: brandVoice || undefined }),
    });
    setName(""); setKeywords(""); setBrandVoice("");
    setShowForm(false);
    setCreating(false);
    await load();
  }

  async function deleteTopic(id: string) {
    if (!confirm("Delete this topic?")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    await load();
  }

  async function runAgent(topicId: string) {
    setRunning(topicId);
    setRunResult(r => ({ ...r, [topicId]: "running" }));
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    });
    setRunning(null);
    if (res.ok) {
      setRunResult(r => ({ ...r, [topicId]: "done" }));
      setTimeout(() => setRunResult(r => { const x = { ...r }; delete x[topicId]; return x; }), 4000);
    } else {
      const data = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
      setRunResult(r => ({ ...r, [topicId]: `error: ${data.error ?? "unknown"}` }));
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Topics</h1>
          <p className="page-subtitle">AI searches Google for news on each topic, then drafts posts for all platforms.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="omg-btn-ghost" onClick={() => setShowForm(!showForm)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add manually
          </button>
        </div>
      </div>

      {/* ── AI Suggest Banner ── */}
      <div
        className="omg-card"
        style={{
          padding: "22px 24px",
          marginBottom: 20,
          background: "linear-gradient(135deg, rgba(26,140,255,0.08) 0%, rgba(26,140,255,0.04) 100%)",
          borderColor: "var(--accent-glow)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>AI Topic Suggestions</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Powered by Gemini
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Gemini will analyze OMG Experience&apos;s industry — pharma cargo, cold chain, AI in logistics, IATA compliance —
              and suggest the most relevant content topics with ready-to-use Google search keywords.
            </p>
          </div>
          <button
            className="omg-btn-primary"
            onClick={suggestTopics}
            disabled={suggesting}
            style={{ flexShrink: 0 }}
          >
            {suggesting ? (
              <><span className="spinner" />Gemini is thinking…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Suggest Topics with AI
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {suggestError && (
          <div style={{
            marginTop: 16,
            background: "var(--danger-dim)", border: "1px solid rgba(255,77,106,0.3)",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "var(--danger)", display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {suggestError}
          </div>
        )}

        {/* Suggestions list */}
        {suggestions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                {suggestions.length} topics suggested — click to add
              </span>
              {suggestions.some((_, i) => !addedIds.has(i)) && (
                <button
                  className="omg-btn-ghost"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={addAllSuggestions}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add all
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 10 }}>
              {suggestions.map((s, i) => {
                const added = addedIds.has(i);
                const adding = addingIds.has(i);
                return (
                  <div
                    key={i}
                    style={{
                      background: added ? "var(--success-dim)" : "var(--bg-surface)",
                      border: `1px solid ${added ? "rgba(0,212,170,0.3)" : "var(--border)"}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: added ? "var(--success)" : "var(--text-primary)", lineHeight: 1.3 }}>
                        {s.name}
                      </span>
                      {added ? (
                        <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => addSuggestedTopic(s, i)}
                          disabled={adding}
                          style={{
                            flexShrink: 0,
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "4px 10px", borderRadius: 6,
                            background: "var(--accent-dim)",
                            border: "1px solid var(--accent-glow)",
                            color: "var(--accent)",
                            fontSize: 11, fontWeight: 600,
                            cursor: adding ? "not-allowed" : "pointer",
                            opacity: adding ? 0.6 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          {adding ? <span className="spinner" style={{ width: 10, height: 10 }} /> : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          )}
                          {adding ? "Adding…" : "Add"}
                        </button>
                      )}
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Keywords:</span> {s.keywords}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--accent)", fontStyle: "italic", lineHeight: 1.5 }}>
                      {s.rationale}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Manual create form */}
      {showForm && (
        <div className="omg-card" style={{ padding: "24px", marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Add Topic Manually</h2>
          <form onSubmit={createTopic}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Topic name *</label>
                <input
                  required className="omg-input"
                  placeholder="e.g. Pharma Cargo Trends"
                  value={name} onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Google search keywords *</label>
                <input
                  required className="omg-input"
                  placeholder="e.g. pharmaceutical cold chain logistics 2025"
                  value={keywords} onChange={e => setKeywords(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Brand voice <span style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <textarea
                className="omg-input" rows={2}
                placeholder="Tone and angle for this topic…"
                value={brandVoice} onChange={e => setBrandVoice(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="omg-btn-primary" disabled={creating}>
                {creating ? <><span className="spinner" />Creating…</> : "Create Topic"}
              </button>
              <button type="button" className="omg-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Topics list */}
      {topics.length === 0 ? (
        <div className="omg-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 8px", fontWeight: 600 }}>No topics yet</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 16px" }}>Let Gemini suggest topics for you, or add one manually.</p>
          <button className="omg-btn-primary" onClick={suggestTopics} disabled={suggesting}>
            {suggesting ? <><span className="spinner" />Thinking…</> : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>Suggest Topics with AI</>
            )}
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, paddingLeft: 4 }}>
            {topics.length} topic{topics.length !== 1 ? "s" : ""} active
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topics.map(t => {
              const result = runResult[t.id];
              return (
                <div key={t.id} className="omg-card" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                          background: t.active ? "var(--success-dim)" : "rgba(100,116,139,0.15)",
                          color: t.active ? "var(--success)" : "var(--text-muted)",
                          textTransform: "uppercase", letterSpacing: "0.05em",
                        }}>
                          {t.active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 2px", fontSize: 12, color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--text-muted)" }}>Search:</span> {t.keywords}
                      </p>
                      {t.brandVoice && (
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          &quot;{t.brandVoice}&quot;
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {result === "done" && (
                        <span style={{ fontSize: 12, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          Done — check Queue
                        </span>
                      )}
                      {result?.startsWith("error") && (
                        <span
                          style={{ fontSize: 12, color: "var(--danger)", maxWidth: 360, overflowWrap: "anywhere" }}
                          title={result}
                        >
                          {result}
                        </span>
                      )}
                      <button
                        className="omg-btn-primary"
                        disabled={!t.active || running === t.id}
                        onClick={() => runAgent(t.id)}
                        style={{ padding: "8px 14px", fontSize: 13 }}
                      >
                        {running === t.id ? (
                          <><span className="spinner" />Running…</>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            Run Agent
                          </>
                        )}
                      </button>
                      <button
                        className="omg-btn-ghost"
                        style={{ padding: "8px 10px" }}
                        onClick={() => deleteTopic(t.id)}
                        title="Delete topic"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
