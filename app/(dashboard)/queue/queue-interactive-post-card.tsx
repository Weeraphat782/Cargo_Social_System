"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import Image from "next/image";
import type { PostListRowJson as Post } from "@/lib/post-list-payload";
import { hasUsableMoodboard } from "@/lib/campaigns/require-moodboard";
import type { RefCategory } from "./queue-shared";
import { platformMeta, sortByPlatform, statusBadge, type SetPending } from "./queue-shared";
import { PlatformIcon, PlatformPill, ImageLightbox } from "@/components/ui";

export type QueueInteractivePostCardProps = {
  post: Post;
  expanded: string | null;
  setExpanded: Dispatch<SetStateAction<string | null>>;
  activePlatformTab: Record<string, string>;
  setActivePlatformTab: Dispatch<SetStateAction<Record<string, string>>>;
  promptDrafts: Record<string, string>;
  setPromptDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  creatorDirectionDrafts: Record<string, string>;
  setCreatorDirectionDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  refCategories: RefCategory[];
  refCategoryByVariant: Record<string, string>;
  setRefCategoryByVariant: Dispatch<SetStateAction<Record<string, string>>>;
  variationCandidates: Record<string, Array<{ imageUrl: string; prompt: string }>>;
  setVariationCandidates: Dispatch<SetStateAction<Record<string, Array<{ imageUrl: string; prompt: string }>>>>;
  variationsLoading: Record<string, boolean>;
  setVariationsLoading: Dispatch<SetStateAction<Record<string, boolean>>>;
  regenLoading: Record<string, boolean>;
  setRegenLoading: Dispatch<SetStateAction<Record<string, boolean>>>;
  selectLoading: Record<string, boolean>;
  setSelectLoading: Dispatch<SetStateAction<Record<string, boolean>>>;
  variantError: Record<string, string>;
  setVariantError: Dispatch<SetStateAction<Record<string, string>>>;
  setPendingPosts: SetPending;
  publishing: string | null;
  publishingVariant: string | null;
  approve: (id: string, scheduledAt?: string) => void | Promise<void>;
  reject: (id: string) => void | Promise<void>;
  publishNow: (id: string) => void | Promise<void>;
  saveEdits: (post: Post) => void | Promise<void>;
  openScheduleModal: (id: string) => void;
  publishVariant: (postId: string, variantId: string) => void | Promise<void>;
};

export function QueueInteractivePostCard({
  post,
  expanded,
  setExpanded,
  activePlatformTab,
  setActivePlatformTab,
  promptDrafts,
  setPromptDrafts,
  creatorDirectionDrafts,
  setCreatorDirectionDrafts,
  refCategories,
  refCategoryByVariant,
  setRefCategoryByVariant,
  variationCandidates,
  setVariationCandidates,
  variationsLoading,
  setVariationsLoading,
  regenLoading,
  setRegenLoading,
  selectLoading,
  setSelectLoading,
  variantError,
  setVariantError,
  setPendingPosts,
  publishing,
  publishingVariant,
  approve,
  reject,
  publishNow,
  saveEdits,
  openScheduleModal,
  publishVariant,
}: QueueInteractivePostCardProps) {
            const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null);
            const thumbUrl =
              post.variants.map((v) => v.media[0]?.imageUrl).find(Boolean) ?? null;
            const ex = (post.variants[0]?.caption || post.sourceNews?.title || "").trim();
            const excerpt = ex.length > 180 ? `${ex.slice(0, 180)}…` : ex;
            const blockCampaignImages =
              post.campaign != null &&
              !hasUsableMoodboard(post.campaign.moodboardImages);
            return (
            <>
            <div className="omg-card is-interactive" style={{ overflow: "hidden" }}>
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
                    <div style={{ position: "relative", width: "100%", height: "100%" }}>
                      <Image
                        src={thumbUrl}
                        alt=""
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    </div>
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
                        <PlatformPill platform={v.platform} size={11} />
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
                          <PlatformPill platform={v.platform} size={12} active={active} />
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
                            <PlatformPill platform={v.platform} size={11} />
                          </span>
                        </div>

                        {v.media.length > 0 && (
                          v.media.length === 1 ? (
                            <div
                              onClick={(e) => { e.stopPropagation(); setLightbox({ images: v.media.map(m => m.imageUrl), idx: 0 }); }}
                              style={{ position: "relative", width: "100%", height: 140, borderRadius: 8, overflow: "hidden", marginBottom: 10, cursor: "zoom-in" }}
                            >
                              <Image
                                src={v.media[0].imageUrl}
                                alt=""
                                fill
                                style={{ objectFit: "cover" }}
                              />
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 10, borderRadius: 8, scrollSnapType: "x mandatory" }}>
                              {v.media.map((m, i) => (
                                <div
                                  key={m.id}
                                  onClick={(e) => { e.stopPropagation(); setLightbox({ images: v.media.map(x => x.imageUrl), idx: i }); }}
                                  style={{ position: "relative", flexShrink: 0, width: 110, height: 110, borderRadius: 6, overflow: "hidden", scrollSnapAlign: "start", cursor: "zoom-in" }}
                                >
                                  <Image src={m.imageUrl} alt={`Image ${i + 1}`} fill style={{ objectFit: "cover" }} />
                                  {i === 0 && (
                                    <span style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 5px" }}>
                                      {v.media.length}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )
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
                            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              Creator direction (negatives become positives, optional)
                            </label>
                            <textarea
                              className="omg-input"
                              style={{ fontSize: 12, padding: "8px 10px", resize: "vertical", minHeight: 56 }}
                              rows={2}
                              value={creatorDirectionDrafts[v.id] ?? ""}
                              placeholder='e.g. "no people", "avoid logos"'
                              onChange={e =>
                                setCreatorDirectionDrafts(prev => ({
                                  ...prev,
                                  [v.id]: e.target.value,
                                }))
                              }
                            />
                            {blockCampaignImages && (
                              <p style={{ margin: 0, fontSize: 11, color: "var(--warning, #b45309)", fontWeight: 600 }}>
                                Generate the campaign moodboard first — image tools are disabled until then.
                              </p>
                            )}
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
                                disabled={regenLoading[v.id] || blockCampaignImages}
                                onClick={async () => {
                                  setRegenLoading(prev => ({ ...prev, [v.id]: true }));
                                  const prompt =
                                    (promptDrafts[v.id] ?? "").trim() ||
                                    "Professional logistics hero image, no text";
                                  const refCat = refCategoryByVariant[v.id]?.trim();
                                  const userPrompt = (creatorDirectionDrafts[v.id] ?? "").trim();
                                  try {
                                    const res = await fetch(`/api/posts/${post.id}/regenerate-image`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        variantId: v.id,
                                        prompt,
                                        ...(userPrompt ? { userPrompt } : {}),
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
                                        setPendingPosts(prev =>
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
                                disabled={variationsLoading[v.id] || blockCampaignImages}
                                onClick={async () => {
                                  setVariationsLoading(prev => ({ ...prev, [v.id]: true }));
                                  const prompt =
                                    (promptDrafts[v.id] ?? "").trim() ||
                                    "Professional logistics hero image, no text";
                                  const refCat = refCategoryByVariant[v.id]?.trim();
                                  const userPrompt = (creatorDirectionDrafts[v.id] ?? "").trim();
                                  try {
                                    const res = await fetch(`/api/posts/${post.id}/generate-variations`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        variantId: v.id,
                                        prompt,
                                        ...(userPrompt ? { userPrompt } : {}),
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
                                      <div style={{ position: "relative", width: "100%", height: 72 }}>
                                        <Image
                                          src={c.imageUrl}
                                          alt=""
                                          fill
                                          style={{ objectFit: "cover" }}
                                        />
                                      </div>
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
                                            setPendingPosts(prev =>
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
                                setPendingPosts(prev => prev.map(p => p.id !== post.id ? p : {
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
                                setPendingPosts(prev => prev.map(p => p.id !== post.id ? p : {
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
                            setPendingPosts(prev => prev.map(p => p.id !== post.id ? p : {
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
                                setPendingPosts(prev => prev.map(p => p.id !== post.id ? p : {
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
            {lightbox && (
              <ImageLightbox
                images={lightbox.images}
                initialIndex={lightbox.idx}
                onClose={() => setLightbox(null)}
              />
            )}
            </>
            );
}
