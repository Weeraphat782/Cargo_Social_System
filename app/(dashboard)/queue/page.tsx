"use client";

import { useCallback, useEffect, useState } from "react";

type RefCategory = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
};

type Post = {
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
    bodyMd: string | null;
    publishedAt: string | null;
    remoteId: string | null;
    media: Array<{ id: string; imageUrl: string }>;
  }>;
};

const platformMeta: Record<string, { label: string; cls: string }> = {
  FACEBOOK:  { label: "Facebook",  cls: "platform-fb" },
  INSTAGRAM: { label: "Instagram", cls: "platform-ig" },
  LINKEDIN:  { label: "LinkedIn",  cls: "platform-li" },
  OMG:       { label: "OMG Cargo", cls: "platform-omg" },
};

const statusBadge: Record<string, string> = {
  PENDING_APPROVAL: "omg-badge-pending",
  APPROVED:         "omg-badge-approved",
  PUBLISHED:        "omg-badge-published",
  FAILED:           "omg-badge-failed",
  REJECTED:         "omg-badge-rejected",
  SCHEDULED:        "omg-badge-scheduled",
};

const PLATFORM_ORDER = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as const;

function sortByPlatform<T extends { platform: string }>(variants: T[]): T[] {
  return [...variants].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a.platform as (typeof PLATFORM_ORDER)[number]);
    const ib = PLATFORM_ORDER.indexOf(b.platform as (typeof PLATFORM_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishingVariant, setPublishingVariant] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<Record<string, string>>({});
  const [schedulingPostId, setSchedulingPostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerMsg, setSchedulerMsg] = useState<string | null>(null);

  const [refCategories, setRefCategories] = useState<RefCategory[]>([]);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [refCategoryByVariant, setRefCategoryByVariant] = useState<Record<string, string>>({});
  const [variationCandidates, setVariationCandidates] = useState<
    Record<string, Array<{ imageUrl: string; prompt: string }>>
  >({});
  const [variationsLoading, setVariationsLoading] = useState<Record<string, boolean>>({});
  const [regenLoading, setRegenLoading] = useState<Record<string, boolean>>({});
  const [selectLoading, setSelectLoading] = useState<Record<string, boolean>>({});
  const [activePlatformTab, setActivePlatformTab] = useState<Record<string, string>>({});

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) setRefreshing(true);
    try {
      const res = await fetch("/api/posts?status=PENDING_APPROVAL,APPROVED,SCHEDULED");
      if (res.ok) setPosts(await res.json());
    } finally {
      if (silent) setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch("/api/references")
      .then((r) => (r.ok ? r.json() : Promise.resolve({ categories: [] })))
      .then((d: { categories?: RefCategory[] }) => setRefCategories(d.categories ?? []))
      .catch(() => setRefCategories([]));
  }, []);

  async function approve(id: string, scheduledAt?: string) {
    const res = await fetch(`/api/posts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
    });
    if (!res.ok) {
      void load({ silent: true });
      return;
    }
    if (scheduledAt) {
      setPosts(prev =>
        prev.map(p =>
          p.id === id
            ? { ...p, status: "SCHEDULED", scheduledAt }
            : p
        )
      );
    } else {
      setPosts(prev =>
        prev.map(p =>
          p.id === id
            ? { ...p, status: "APPROVED", scheduledAt: null }
            : p
        )
      );
    }
  }

  async function reject(id: string) {
    if (!confirm("Reject this post?")) return;
    const res = await fetch(`/api/posts/${id}/reject`, { method: "POST" });
    if (!res.ok) {
      void load({ silent: true });
      return;
    }
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  async function publishNow(id: string) {
    setPublishing(id);
    try {
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        void load({ silent: true });
        return;
      }
      setPosts(prev => prev.filter(p => p.id !== id));
    } finally {
      setPublishing(null);
    }
  }

  async function publishVariant(postId: string, variantId: string) {
    setPublishingVariant(variantId);
    setVariantError(prev => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
    try {
      const res = await fetch(
        `/api/posts/${postId}/variants/${variantId}/publish`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setVariantError(prev => ({
          ...prev,
          [variantId]: data.error ?? `HTTP ${res.status}`,
        }));
        return;
      }
      const publishedAt = new Date().toISOString();
      setPosts(prev =>
        prev.map(p =>
          p.id !== postId
            ? p
            : {
                ...p,
                variants: p.variants.map(v =>
                  v.id === variantId ? { ...v, publishedAt } : v
                ),
              }
        )
      );
    } catch (err) {
      setVariantError(prev => ({
        ...prev,
        [variantId]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setPublishingVariant(null);
    }
  }

  async function saveEdits(post: Post) {
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variants: post.variants.map(v => ({
          id: v.id,
          caption: v.caption,
          hashtags: v.hashtags ?? undefined,
          title: v.title ?? undefined,
          slug: v.slug ?? undefined,
          bodyMd: v.bodyMd ?? undefined,
        })),
      }),
    });
  }

  function openScheduleModal(id: string) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60 - (now.getMinutes() % 15), 0, 0);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    setScheduleDate(`${yyyy}-${mm}-${dd}`);
    setScheduleTime(`${hh}:${mi}`);
    setSchedulingPostId(id);
  }

  function closeScheduleModal() {
    setSchedulingPostId(null);
    setScheduleDate("");
    setScheduleTime("");
  }

  async function confirmSchedule() {
    if (!schedulingPostId || !scheduleDate || !scheduleTime) return;
    const local = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (isNaN(local.getTime())) return;
    if (local.getTime() < Date.now()) {
      alert("Please pick a future time.");
      return;
    }
    const id = schedulingPostId;
    closeScheduleModal();
    await approve(id, local.toISOString());
  }

  async function runSchedulerNow() {
    setSchedulerRunning(true);
    setSchedulerMsg(null);
    try {
      const res = await fetch("/api/cron/publish/manual", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        processed?: Array<{ id: string; ok: boolean; error?: string }>;
        error?: string;
      };
      if (!res.ok) {
        setSchedulerMsg(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const n = data.processed?.length ?? 0;
      if (n === 0) {
        setSchedulerMsg("No due scheduled posts (nothing to publish right now).");
      } else {
        const ok = data.processed?.filter((p) => p.ok).length ?? 0;
        setSchedulerMsg(`Processed ${n} post(s): ${ok} succeeded.`);
      }
      await load({ silent: true });
    } catch (e) {
      setSchedulerMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSchedulerRunning(false);
    }
  }

  if (initialLoading && posts.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", paddingTop: 40 }}>
        <span className="spinner" /> Loading queue…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="page-title" style={{ margin: 0 }}>Approval Queue</h1>
          {refreshing && (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}
              title="Refreshing list…"
            >
              <span className="spinner" /> Updating…
            </span>
          )}
        </div>
        <p className="page-subtitle">Review AI-generated drafts, edit copy, approve or schedule, then publish to all platforms.</p>
      </div>

      <div
        className="omg-card"
        style={{
          marginBottom: 20,
          padding: "14px 18px",
          border: "1px solid var(--ring-accent)",
          background: "color-mix(in srgb, var(--accent) 5%, var(--bg-card))",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 520 }}>
            <strong style={{ color: "var(--text-primary)" }}>Scheduled posts</strong> publish when{" "}
            <code style={{ background: "var(--inline-code-bg)", padding: "1px 6px", borderRadius: 4 }}>/api/cron/publish</code>{" "}
            runs (every 5 min on Vercel). On <strong>local dev</strong>, run the scheduler below or wait ~60s for the dev loop.
            Set <code style={{ background: "var(--inline-code-bg)", padding: "1px 6px", borderRadius: 4 }}>CRON_SECRET</code> in{" "}
            <code style={{ background: "var(--inline-code-bg)", padding: "1px 6px", borderRadius: 4 }}>.env</code> for curl.
          </div>
          <button
            type="button"
            className="omg-btn-primary"
            style={{ fontSize: 13, flexShrink: 0 }}
            disabled={schedulerRunning}
            onClick={() => void runSchedulerNow()}
          >
            {schedulerRunning ? (
              <><span className="spinner" /> Running…</>
            ) : (
              <>Run scheduler now</>
            )}
          </button>
        </div>
        {schedulerMsg && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{schedulerMsg}</p>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="omg-card" style={{ padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Queue is empty</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Run the agent from Dashboard or Topics to generate new posts.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {posts.map((post) => {
            const thumbUrl =
              post.variants.map((v) => v.media[0]?.imageUrl).find(Boolean) ?? null;
            const ex = (post.variants[0]?.caption || post.sourceNews?.title || "").trim();
            const excerpt = ex.length > 180 ? `${ex.slice(0, 180)}…` : ex;
            return (
            <div key={post.id} className="omg-card" style={{ overflow: "hidden" }}>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (expanded === post.id) setExpanded(null);
                    else {
                      const sorted = sortByPlatform(post.variants);
                      setActivePlatformTab((prev) => ({
                        ...prev,
                        [post.id]: sorted[0]?.platform ?? "FACEBOOK",
                      }));
                      setExpanded(post.id);
                    }
                  }
                }}
                onClick={() => {
                  if (expanded === post.id) {
                    setExpanded(null);
                  } else {
                    const sorted = sortByPlatform(post.variants);
                    setActivePlatformTab((prev) => ({
                      ...prev,
                      [post.id]: sorted[0]?.platform ?? "FACEBOOK",
                    }));
                    setExpanded(post.id);
                  }
                }}
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                  }}
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        color: "var(--text-muted)",
                      }}
                    >
                      📝
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      {post.topic?.name ?? "Post"}
                    </span>
                    <span className={`omg-badge ${statusBadge[post.status] ?? "omg-badge-pending"}`}>
                      {post.status.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                    {sortByPlatform(post.variants).map((v) => (
                      <span key={v.id} className={`platform-pill ${platformMeta[v.platform]?.cls ?? ""}`}>
                        {platformMeta[v.platform]?.label ?? v.platform}
                      </span>
                    ))}
                  </div>
                  {excerpt && (
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                      {excerpt}
                    </p>
                  )}
                  {post.sourceNews && (
                    <a
                      href={post.sourceNews.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "inline-block" }}
                    >
                      📰 {post.sourceNews.title}
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className="omg-btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 12, pointerEvents: "none" }}
                    aria-hidden
                  >
                    {expanded === post.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded variants */}
              {expanded === post.id && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      padding: "12px 20px 0",
                      background: "var(--bg-elevated)",
                      borderBottom: "1px solid var(--border-muted)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sortByPlatform(post.variants).map((v) => {
                      const defPlat = sortByPlatform(post.variants)[0]?.platform;
                      const active = (activePlatformTab[post.id] ?? defPlat) === v.platform;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() =>
                            setActivePlatformTab((prev) => ({ ...prev, [post.id]: v.platform }))
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
                          {platformMeta[v.platform]?.label ?? v.platform}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: "0 20px 20px" }}>
                    {post.variants
                      .filter(
                        (v) =>
                          v.platform ===
                          (activePlatformTab[post.id] ?? sortByPlatform(post.variants)[0]?.platform)
                      )
                      .map((v) => (
                      <div key={v.id} style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-muted)",
                        borderRadius: 10,
                        padding: 14,
                        marginTop: 16,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span className={`platform-pill ${platformMeta[v.platform]?.cls ?? ""}`}>
                            {platformMeta[v.platform]?.label ?? v.platform}
                          </span>
                        </div>

                        {v.media[0]?.imageUrl && (
                          <img
                            src={v.media[0].imageUrl}
                            alt=""
                            style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 8, marginBottom: 10 }}
                          />
                        )}

                        <details style={{ marginBottom: 12, fontSize: 12 }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "var(--accent)",
                              fontWeight: 600,
                              listStyle: "none",
                            }}
                          >
                            Image tools (prompt, reference, variations)
                          </summary>
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Image prompt</label>
                            <textarea
                              className="omg-input"
                              style={{ fontSize: 12, padding: "8px 10px", resize: "vertical", minHeight: 72 }}
                              rows={3}
                              value={promptDrafts[v.id] ?? ""}
                              placeholder="Describe the image you want…"
                              onChange={e =>
                                setPromptDrafts(prev => ({ ...prev, [v.id]: e.target.value }))
                              }
                            />
                            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Reference set</label>
                            <select
                              className="omg-input"
                              style={{ fontSize: 12, padding: "8px 10px" }}
                              value={refCategoryByVariant[v.id] ?? ""}
                              onChange={e =>
                                setRefCategoryByVariant(prev => ({
                                  ...prev,
                                  [v.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">None (text-only or env default)</option>
                              {refCategories.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {c.description ? ` — ${c.description.slice(0, 60)}` : ""}
                                </option>
                              ))}
                            </select>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              <button
                                type="button"
                                className="omg-btn-ghost"
                                style={{ fontSize: 11, padding: "6px 12px" }}
                                disabled={regenLoading[v.id]}
                                onClick={async () => {
                                  setRegenLoading(prev => ({ ...prev, [v.id]: true }));
                                  const prompt =
                                    (promptDrafts[v.id] ?? "").trim() ||
                                    "Professional logistics hero image, no text";
                                  const refCat = refCategoryByVariant[v.id]?.trim();
                                  try {
                                    const res = await fetch(`/api/posts/${post.id}/regenerate-image`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        variantId: v.id,
                                        prompt,
                                        referenceCategory: refCat || undefined,
                                      }),
                                    });
                                    const data = (await res.json().catch(() => ({}))) as {
                                      ok?: boolean;
                                      imageUrl?: string;
                                      error?: string;
                                    };
                                    if (!res.ok) {
                                      setVariantError(prev => ({
                                        ...prev,
                                        [v.id]: data.error ?? `HTTP ${res.status}`,
                                      }));
                                    } else {
                                      setVariantError(prev => {
                                        const next = { ...prev };
                                        delete next[v.id];
                                        return next;
                                      });
                                      setVariationCandidates(prev => {
                                        const n = { ...prev };
                                        delete n[v.id];
                                        return n;
                                      });
                                      if (data.imageUrl) {
                                        setPosts(prev =>
                                          prev.map(p =>
                                            p.id !== post.id
                                              ? p
                                              : {
                                                  ...p,
                                                  variants: p.variants.map(x =>
                                                    x.id === v.id
                                                      ? {
                                                          ...x,
                                                          media: x.media.length
                                                            ? [
                                                                {
                                                                  ...x.media[0],
                                                                  imageUrl: data.imageUrl!,
                                                                  prompt,
                                                                },
                                                              ]
                                                            : [
                                                                {
                                                                  id: `temp-${v.id}`,
                                                                  imageUrl: data.imageUrl!,
                                                                  prompt,
                                                                },
                                                              ],
                                                        }
                                                      : x
                                                  ),
                                                }
                                          )
                                        );
                                      }
                                    }
                                  } finally {
                                    setRegenLoading(prev => ({ ...prev, [v.id]: false }));
                                  }
                                }}
                              >
                                {regenLoading[v.id] ? (
                                  <><span className="spinner" /> Regenerating…</>
                                ) : (
                                  <>↻ Regenerate image</>
                                )}
                              </button>
                              <button
                                type="button"
                                className="omg-btn-primary"
                                style={{ fontSize: 11, padding: "6px 12px" }}
                                disabled={variationsLoading[v.id]}
                                onClick={async () => {
                                  setVariationsLoading(prev => ({ ...prev, [v.id]: true }));
                                  const prompt =
                                    (promptDrafts[v.id] ?? "").trim() ||
                                    "Professional logistics hero image, no text";
                                  const refCat = refCategoryByVariant[v.id]?.trim();
                                  try {
                                    const res = await fetch(`/api/posts/${post.id}/generate-variations`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        variantId: v.id,
                                        prompt,
                                        referenceCategory: refCat || undefined,
                                        count: 3,
                                      }),
                                    });
                                    const data = (await res.json().catch(() => ({}))) as {
                                      ok?: boolean;
                                      candidates?: Array<{ imageUrl: string; prompt: string }>;
                                      error?: string;
                                    };
                                    if (!res.ok || !data.ok) {
                                      setVariantError(prev => ({
                                        ...prev,
                                        [v.id]: data.error ?? `HTTP ${res.status}`,
                                      }));
                                      return;
                                    }
                                    setVariantError(prev => {
                                      const next = { ...prev };
                                      delete next[v.id];
                                      return next;
                                    });
                                    if (data.candidates?.length) {
                                      setVariationCandidates(prev => ({
                                        ...prev,
                                        [v.id]: data.candidates!,
                                      }));
                                    }
                                  } finally {
                                    setVariationsLoading(prev => ({ ...prev, [v.id]: false }));
                                  }
                                }}
                              >
                                {variationsLoading[v.id] ? (
                                  <><span className="spinner" /> Generating…</>
                                ) : (
                                  <>Generate variations (3)</>
                                )}
                              </button>
                            </div>

                            {variationCandidates[v.id]?.length ? (
                              <div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                                  Pick a preview (does not publish until you approve the post):
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                                    gap: 8,
                                  }}
                                >
                                  {variationCandidates[v.id]!.map((c, idx) => (
                                    <div
                                      key={`${c.imageUrl}-${idx}`}
                                      style={{
                                        border: "1px solid var(--border-muted)",
                                        borderRadius: 8,
                                        overflow: "hidden",
                                        background: "var(--bg-surface)",
                                      }}
                                    >
                                      <img
                                        src={c.imageUrl}
                                        alt=""
                                        style={{
                                          width: "100%",
                                          height: 72,
                                          objectFit: "cover",
                                          display: "block",
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="omg-btn-ghost"
                                        style={{
                                          width: "100%",
                                          fontSize: 10,
                                          padding: "4px 4px",
                                          borderRadius: 0,
                                        }}
                                        disabled={selectLoading[v.id]}
                                        onClick={async () => {
                                          setSelectLoading(prev => ({ ...prev, [v.id]: true }));
                                          try {
                                            const res = await fetch(`/api/posts/${post.id}/select-variation`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                variantId: v.id,
                                                imageUrl: c.imageUrl,
                                                prompt: c.prompt,
                                              }),
                                            });
                                            const data = (await res.json().catch(() => ({}))) as {
                                              error?: string;
                                            };
                                            if (!res.ok) {
                                              setVariantError(prev => ({
                                                ...prev,
                                                [v.id]: data.error ?? `HTTP ${res.status}`,
                                              }));
                                              return;
                                            }
                                            setVariationCandidates(prev => {
                                              const n = { ...prev };
                                              delete n[v.id];
                                              return n;
                                            });
                                            setPromptDrafts(prev => ({ ...prev, [v.id]: c.prompt }));
                                            setPosts(prev =>
                                              prev.map(p =>
                                                p.id !== post.id
                                                  ? p
                                                  : {
                                                      ...p,
                                                      variants: p.variants.map(x =>
                                                        x.id === v.id
                                                          ? {
                                                              ...x,
                                                              media: x.media.length
                                                                ? [
                                                                    {
                                                                      ...x.media[0],
                                                                      imageUrl: c.imageUrl,
                                                                      prompt: c.prompt,
                                                                    },
                                                                  ]
                                                                : [
                                                                    {
                                                                      id: `temp-${v.id}`,
                                                                      imageUrl: c.imageUrl,
                                                                      prompt: c.prompt,
                                                                    },
                                                                  ],
                                                            }
                                                          : x
                                                      ),
                                                    }
                                              )
                                            );
                                          } finally {
                                            setSelectLoading(prev => ({ ...prev, [v.id]: false }));
                                          }
                                        }}
                                      >
                                        {selectLoading[v.id] ? "…" : "Use this"}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>

                        {v.platform === "OMG" && (
                          <>
                            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Title</label>
                            <input
                              className="omg-input"
                              style={{ fontSize: 12, marginBottom: 10, padding: "8px 10px" }}
                              value={v.title ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setPosts(prev => prev.map(p => p.id !== post.id ? p : {
                                  ...p, variants: p.variants.map(x => x.id === v.id ? { ...x, title: val } : x)
                                }));
                              }}
                            />
                            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Slug</label>
                            <input
                              className="omg-input"
                              style={{ fontSize: 12, marginBottom: 10, padding: "8px 10px" }}
                              value={v.slug ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setPosts(prev => prev.map(p => p.id !== post.id ? p : {
                                  ...p, variants: p.variants.map(x => x.id === v.id ? { ...x, slug: val } : x)
                                }));
                              }}
                            />
                          </>
                        )}

                        <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                          {v.platform === "OMG" ? "Article body (Markdown)" : "Caption"}
                        </label>
                        <textarea
                          className="omg-input"
                          style={{ fontSize: 12, padding: "8px 10px", resize: "vertical" }}
                          rows={v.platform === "OMG" ? 8 : 4}
                          value={v.platform === "OMG" ? v.bodyMd ?? v.caption : v.caption}
                          onChange={e => {
                            const val = e.target.value;
                            setPosts(prev => prev.map(p => p.id !== post.id ? p : {
                              ...p, variants: p.variants.map(x => x.id === v.id
                                ? v.platform === "OMG"
                                  ? { ...x, bodyMd: val, caption: val.slice(0, 500) }
                                  : { ...x, caption: val }
                                : x
                              )
                            }));
                          }}
                        />

                        {v.platform === "INSTAGRAM" && (
                          <>
                            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 8, marginBottom: 4 }}>Hashtags</label>
                            <input
                              className="omg-input"
                              style={{ fontSize: 12, padding: "8px 10px" }}
                              value={v.hashtags ?? ""}
                              placeholder="#logistics #cargo #pharma"
                              onChange={e => {
                                const val = e.target.value;
                                setPosts(prev => prev.map(p => p.id !== post.id ? p : {
                                  ...p, variants: p.variants.map(x => x.id === v.id ? { ...x, hashtags: val } : x)
                                }));
                              }}
                            />
                          </>
                        )}

                        {/* Per-platform publish controls */}
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--border-muted)" }}>
                          {v.publishedAt ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--success)" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                              Published {new Date(v.publishedAt).toLocaleString()}
                            </div>
                          ) : (
                            <>
                              <button
                                className="omg-btn-primary"
                                style={{ fontSize: 12, padding: "7px 12px", width: "100%", background: "var(--success)" }}
                                disabled={publishingVariant === v.id}
                                onClick={() => {
                                  if (!confirm(`Approve and publish this variant to ${platformMeta[v.platform]?.label ?? v.platform}?`)) return;
                                  void publishVariant(post.id, v.id);
                                }}
                              >
                                {publishingVariant === v.id ? (
                                  <><span className="spinner" /> Publishing…</>
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    Approve & publish to {platformMeta[v.platform]?.label ?? v.platform}
                                  </>
                                )}
                              </button>
                              {variantError[v.id] && (
                                <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)", overflowWrap: "anywhere" }}>
                                  {variantError[v.id]}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      padding: "12px 20px 20px",
                      borderTop: "1px solid var(--border-muted)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="omg-btn-ghost" style={{ fontSize: 13 }} onClick={() => saveEdits(post)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      Save edits
                    </button>

                    {post.status === "PENDING_APPROVAL" && (
                      <>
                        <button
                          className="omg-btn-primary"
                          style={{ fontSize: 13, background: "var(--success)", padding: "8px 16px" }}
                          onClick={() => approve(post.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          Approve
                        </button>
                        <button
                          className="omg-btn-ghost"
                          style={{ fontSize: 13, color: "var(--purple)", borderColor: "var(--ring-purple)" }}
                          onClick={() => openScheduleModal(post.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          Schedule
                        </button>
                        <button className="omg-btn-danger" style={{ fontSize: 13 }} onClick={() => reject(post.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Reject
                        </button>
                      </>
                    )}

                    {post.status === "APPROVED" && (
                      <button
                        className="omg-btn-primary"
                        style={{ fontSize: 13 }}
                        disabled={publishing === post.id}
                        onClick={() => publishNow(post.id)}
                      >
                        {publishing === post.id ? (
                          <><span className="spinner" /> Publishing…</>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            Publish now to all platforms
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Schedule modal */}
      {schedulingPostId && (
        <div
          onClick={closeScheduleModal}
          style={{
            position: "fixed", inset: 0, background: "var(--overlay-scrim)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20, backdropFilter: "blur(3px)",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="omg-card"
            style={{ width: "100%", maxWidth: 420, padding: 24 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                Schedule post
              </h3>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--text-muted)" }}>
              Pick a date and time. Uses your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Date
                </label>
                <input
                  type="date"
                  className="omg-input"
                  style={{ fontSize: 14, padding: "10px 12px", width: "100%", colorScheme: "light" }}
                  value={scheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Time
                </label>
                <input
                  type="time"
                  className="omg-input"
                  style={{ fontSize: 14, padding: "10px 12px", width: "100%", colorScheme: "light" }}
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            {/* Quick presets */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {[
                { label: "In 1 hour", offsetMin: 60 },
                { label: "Tonight 8pm", tonight: true },
                { label: "Tomorrow 9am", tomorrow: 9 },
                { label: "Tomorrow 2pm", tomorrow: 14 },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className="omg-btn-ghost"
                  style={{ fontSize: 11, padding: "5px 10px" }}
                  onClick={() => {
                    const d = new Date();
                    if ("offsetMin" in preset && preset.offsetMin) {
                      d.setMinutes(d.getMinutes() + preset.offsetMin);
                    } else if ("tonight" in preset && preset.tonight) {
                      d.setHours(20, 0, 0, 0);
                      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
                    } else if ("tomorrow" in preset && typeof preset.tomorrow === "number") {
                      d.setDate(d.getDate() + 1);
                      d.setHours(preset.tomorrow, 0, 0, 0);
                    }
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    const h = String(d.getHours()).padStart(2, "0");
                    const mi = String(d.getMinutes()).padStart(2, "0");
                    setScheduleDate(`${y}-${m}-${day}`);
                    setScheduleTime(`${h}:${mi}`);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {scheduleDate && scheduleTime && (
              <div style={{
                fontSize: 12, color: "var(--text-secondary)",
                padding: "10px 12px", background: "var(--bg-surface)",
                border: "1px solid var(--border-muted)", borderRadius: 8,
                marginBottom: 16,
              }}>
                Will publish on{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString(undefined, {
                    dateStyle: "full", timeStyle: "short",
                  })}
                </strong>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="omg-btn-ghost" style={{ fontSize: 13 }} onClick={closeScheduleModal}>
                Cancel
              </button>
              <button
                className="omg-btn-primary"
                style={{ fontSize: 13, background: "var(--purple)" }}
                disabled={!scheduleDate || !scheduleTime}
                onClick={confirmSchedule}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
