"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import type { PostListRowJson as Post } from "@/lib/post-list-payload";
import { platformMeta, sortByPlatform, statusBadge } from "./queue-shared";
import { PlatformPill } from "@/components/ui";

export type QueuePublishedPostCardProps = {
  post: Post;
  expanded: string | null;
  setExpanded: Dispatch<SetStateAction<string | null>>;
  activePlatformTab: Record<string, string>;
  setActivePlatformTab: Dispatch<SetStateAction<Record<string, string>>>;
};

export function QueuePublishedPostCard({
  post,
  expanded,
  setExpanded,
  activePlatformTab,
  setActivePlatformTab,
}: QueuePublishedPostCardProps) {
            const thumbUrl =
              post.variants.map((v) => v.media[0]?.imageUrl).find(Boolean) ?? null;
            const ex = (post.variants[0]?.caption || post.sourceNews?.title || "").trim();
            const excerpt = ex.length > 180 ? `${ex.slice(0, 180)}…` : ex;
            return (
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
                            onClick={() => setActivePlatformTab((prev) => ({ ...prev, [post.id]: v.platform }))}
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
                          <div
                            key={v.id}
                            style={{
                              background: "var(--bg-surface)",
                              border: "1px solid var(--border-muted)",
                              borderRadius: 10,
                              padding: 14,
                              marginTop: 16,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <span className={`platform-pill ${platformMeta[v.platform]?.cls ?? ""}`}>
                                <PlatformPill platform={v.platform} size={11} />
                              </span>
                            </div>
                            {v.media[0]?.imageUrl && (
                              <div style={{ position: "relative", width: "100%", height: 140, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                                <Image
                                  src={v.media[0].imageUrl}
                                  alt=""
                                  fill
                                  style={{ objectFit: "cover" }}
                                />
                              </div>
                            )}
                            {v.platform === "OMG" && (
                              <>
                                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>Title</p>
                                <p style={{ fontSize: 12, margin: "0 0 10px" }}>{v.title ?? "—"}</p>
                                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>Slug</p>
                                <p style={{ fontSize: 12, margin: "0 0 10px" }}>{v.slug ?? "—"}</p>
                              </>
                            )}
                            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>
                              {v.platform === "OMG" ? "Article body" : "Caption"}
                            </p>
                            <div
                              style={{
                                fontSize: 12,
                                lineHeight: 1.5,
                                whiteSpace: "pre-wrap",
                                color: "var(--text-primary)",
                                marginBottom: v.platform === "INSTAGRAM" && v.hashtags ? 10 : 0,
                              }}
                            >
                              {v.platform === "OMG" ? v.bodyMd ?? v.caption : v.caption}
                            </div>
                            {v.platform === "INSTAGRAM" && v.hashtags && (
                              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{v.hashtags}</p>
                            )}
                            <div
                              style={{
                                marginTop: 12,
                                paddingTop: 10,
                                borderTop: "1px dashed var(--border-muted)",
                                fontSize: 12,
                                color: v.publishedAt ? "var(--success)" : "var(--text-muted)",
                              }}
                            >
                              {v.publishedAt
                                ? `Published ${new Date(v.publishedAt).toLocaleString()}`
                                : "Not published on this platform"}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
}
