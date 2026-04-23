"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LiStatus = { connected: boolean; personUrn?: string };

export default function LinkedInTestPage() {
  const [li, setLi] = useState<LiStatus | null>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ remoteId: string; postUrl: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/credentials/linkedin")
      .then((r) => r.json())
      .then((j: LiStatus) => setLi(j));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!file) {
      setError("Please choose an image (PNG or JPEG).");
      return;
    }
    if (!caption.trim()) {
      setError("Please enter a caption.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("caption", caption.trim());
      fd.set("image", file);
      const res = await fetch("/api/test/linkedin-post", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        remoteId?: string;
        postUrl?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.remoteId && data.postUrl) {
        setSuccess({ remoteId: data.remoteId, postUrl: data.postUrl });
      }
      setCaption("");
      setFile(null);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">LinkedIn test post</h1>
        <p className="page-subtitle">
          Upload an image and caption, then post directly to your connected LinkedIn profile. This bypasses
          topics and drafts.
        </p>
      </div>

      {li === null && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Checking LinkedIn connection…</p>
      )}

      {li && !li.connected && (
        <div
          className="omg-card"
          style={{
            padding: "16px 18px",
            marginBottom: 20,
            border: "1px solid var(--warning-dim)",
            background: "var(--warning-dim)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--warning)" }}>
            LinkedIn is not connected.{" "}
            <Link href="/settings/connections" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Connect in Settings
            </Link>
          </p>
        </div>
      )}

      {li?.connected && (
        <div
          className="omg-card"
          style={{
            padding: "12px 16px",
            marginBottom: 20,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <strong style={{ color: "var(--success)" }}>Connected</strong>
          {li.personUrn && (
            <span style={{ marginLeft: 10, fontFamily: "monospace", fontSize: 11 }}>
              {li.personUrn}
            </span>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "var(--danger-dim)",
            border: "1px solid var(--ring-danger)",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--danger)",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "var(--success-dim)",
            border: "1px solid var(--ring-success)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--success)" }}>
            Posted successfully.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>
            {success.remoteId}
          </p>
          <a
            href={success.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="omg-btn-primary"
            style={{ display: "inline-flex", fontSize: 13, textDecoration: "none" }}
          >
            View on LinkedIn
          </a>
        </div>
      )}

      <form onSubmit={onSubmit} className="omg-card" style={{ padding: "22px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}
          >
            Image (PNG or JPEG, max 5 MB)
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={!li?.connected || loading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
            style={{ fontSize: 13, color: "var(--text-primary)" }}
          />
        </div>

        {previewUrl && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, border: "1px solid var(--border)" }}
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}
          >
            Caption (max 3000 characters)
          </label>
          <textarea
            className="omg-input"
            style={{ minHeight: 120, resize: "vertical", fontSize: 13 }}
            value={caption}
            maxLength={3000}
            disabled={!li?.connected || loading}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your post text…"
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {caption.length} / 3000
          </p>
        </div>

        <button
          type="submit"
          className="omg-btn-primary"
          disabled={!li?.connected || loading}
          style={{ fontSize: 13 }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ marginRight: 8 }} /> Posting…
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
              Post to LinkedIn
            </>
          )}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/settings/connections" style={{ color: "var(--accent)" }}>
          ← Back to Connections
        </Link>
      </p>
    </div>
  );
}
