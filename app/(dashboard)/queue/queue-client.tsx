"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { PageHeader, SectionHeading, Skeleton, CollapsibleSection } from "@/components/ui";
import type { PostListRowJson as Post } from "@/lib/post-list-payload";
import { QueueInteractivePostCard } from "./queue-interactive-post-card";
import { QueuePublishedPostCard } from "./queue-published-post-card";
import type { RefCategory } from "./queue-shared";
import { PUBLISHED_FEED_MAX } from "./queue-shared";

export default function QueueClient({
  initialPending,
  initialPublished,
}: {
  initialPending: Post[];
  initialPublished: Post[];
}) {
  const [pendingPosts, setPendingPosts] = useState<Post[]>(initialPending);
  const [publishedPosts, setPublishedPosts] = useState<Post[]>(initialPublished);
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishingVariant, setPublishingVariant] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<Record<string, string>>({});
  const [schedulingPostId, setSchedulingPostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");

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
      const [pendingRes, publishedRes] = await Promise.all([
        fetch("/api/posts?status=PENDING_APPROVAL,APPROVED,SCHEDULED"),
        fetch("/api/posts?status=PUBLISHED"),
      ]);
      if (pendingRes.ok) {
        setPendingPosts(await pendingRes.json());
      }
      if (publishedRes.ok) {
        const all = (await publishedRes.json()) as Post[];
        setPublishedPosts(all.slice(0, PUBLISHED_FEED_MAX));
      }
    } finally {
      if (silent) setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

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
      setPendingPosts(prev =>
        prev.map(p =>
          p.id === id
            ? { ...p, status: "SCHEDULED", scheduledAt }
            : p
        )
      );
    } else {
      setPendingPosts(prev =>
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
    setPendingPosts(prev => prev.filter(p => p.id !== id));
  }

  async function publishNow(id: string) {
    setPublishing(id);
    try {
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        void load({ silent: true });
        return;
      }
      void load({ silent: true });
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
      void load({ silent: true });
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

  const pendingOnly = useMemo(
    () => pendingPosts.filter((p) => p.status === "PENDING_APPROVAL"),
    [pendingPosts]
  );
  const scheduledSorted = useMemo(() => {
    const rows = pendingPosts.filter(
      (p) => p.status === "APPROVED" || p.status === "SCHEDULED"
    );
    return [...rows].sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      if (ta && tb) return ta - tb;
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [pendingPosts]);

  const publishedLast7 = useMemo(() => {
    const now = Date.now();
    const SEVEN_DAYS = 7 * 86_400_000;
    return publishedPosts
      .filter((p) => {
        const t = p.publishedAt ? new Date(p.publishedAt).getTime() : 0;
        return t > 0 && now - t <= SEVEN_DAYS;
      })
      .slice(0, PUBLISHED_FEED_MAX);
  }, [publishedPosts]);

  if (initialLoading && pendingPosts.length === 0 && publishedPosts.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <PageHeader
          title="Approval Queue"
          subtitle="Review AI-generated drafts, edit copy, approve or schedule, then publish to all platforms."
          icon={<Inbox size={28} strokeWidth={1.75} />}
        />
        <SectionHeading>Queue</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton variant="card" height={128} />
          <Skeleton variant="card" height={128} />
          <Skeleton variant="card" height={100} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <PageHeader
        title="Approval Queue"
        subtitle="Review AI-generated drafts, edit copy, approve or schedule, then publish to all platforms."
        icon={<Inbox size={28} strokeWidth={1.75} />}
        actions={
          refreshing ? (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}
              title="Refreshing list…"
            >
              <span className="spinner" /> Updating…
            </span>
          ) : null
        }
      />

      {pendingPosts.length === 0 ? (
        <div className="omg-card" style={{ padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Queue is empty</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Run the agent from Dashboard or Topics to generate new posts.
          </p>
        </div>
      ) : (
        <>
          <CollapsibleSection title="Pending" count={pendingOnly.length} defaultOpen>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {pendingOnly.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No posts awaiting review.</p>
              ) : (
                pendingOnly.map((post) => (
                  <QueueInteractivePostCard
                    key={post.id}
                    post={post}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    activePlatformTab={activePlatformTab}
                    setActivePlatformTab={setActivePlatformTab}
                    promptDrafts={promptDrafts}
                    setPromptDrafts={setPromptDrafts}
                    refCategories={refCategories}
                    refCategoryByVariant={refCategoryByVariant}
                    setRefCategoryByVariant={setRefCategoryByVariant}
                    variationCandidates={variationCandidates}
                    setVariationCandidates={setVariationCandidates}
                    variationsLoading={variationsLoading}
                    setVariationsLoading={setVariationsLoading}
                    regenLoading={regenLoading}
                    setRegenLoading={setRegenLoading}
                    selectLoading={selectLoading}
                    setSelectLoading={setSelectLoading}
                    variantError={variantError}
                    setVariantError={setVariantError}
                    setPendingPosts={setPendingPosts}
                    publishing={publishing}
                    publishingVariant={publishingVariant}
                    approve={approve}
                    reject={reject}
                    publishNow={publishNow}
                    saveEdits={saveEdits}
                    openScheduleModal={openScheduleModal}
                    publishVariant={publishVariant}
                  />
                ))
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Scheduled" count={scheduledSorted.length} defaultOpen margin="24px 0 20px">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {scheduledSorted.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No scheduled or approved posts.</p>
              ) : (
                scheduledSorted.map((post) => (
                  <QueueInteractivePostCard
                    key={post.id}
                    post={post}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    activePlatformTab={activePlatformTab}
                    setActivePlatformTab={setActivePlatformTab}
                    promptDrafts={promptDrafts}
                    setPromptDrafts={setPromptDrafts}
                    refCategories={refCategories}
                    refCategoryByVariant={refCategoryByVariant}
                    setRefCategoryByVariant={setRefCategoryByVariant}
                    variationCandidates={variationCandidates}
                    setVariationCandidates={setVariationCandidates}
                    variationsLoading={variationsLoading}
                    setVariationsLoading={setVariationsLoading}
                    regenLoading={regenLoading}
                    setRegenLoading={setRegenLoading}
                    selectLoading={selectLoading}
                    setSelectLoading={setSelectLoading}
                    variantError={variantError}
                    setVariantError={setVariantError}
                    setPendingPosts={setPendingPosts}
                    publishing={publishing}
                    publishingVariant={publishingVariant}
                    approve={approve}
                    reject={reject}
                    publishNow={publishNow}
                    saveEdits={saveEdits}
                    openScheduleModal={openScheduleModal}
                    publishVariant={publishVariant}
                  />
                ))
              )}
            </div>
          </CollapsibleSection>
        </>
      )}

      <CollapsibleSection
        title="Published · Last 7 days"
        count={publishedLast7.length}
        defaultOpen={false}
        margin="28px 0 20px"
      >
        {publishedPosts.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 0 }}>
            No published posts in this feed yet.
          </p>
        ) : publishedLast7.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 0 }}>
            No posts published in the last 7 days.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
              Showing {publishedLast7.length} published in the last 7 days (max {PUBLISHED_FEED_MAX})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 8 }}>
              {publishedLast7.map((post) => (
                <QueuePublishedPostCard
                  key={post.id}
                  post={post}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  activePlatformTab={activePlatformTab}
                  setActivePlatformTab={setActivePlatformTab}
                />
              ))}
            </div>
          </>
        )}
      </CollapsibleSection>

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
