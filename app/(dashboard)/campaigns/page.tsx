"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CampaignCadence, CampaignStatus, CampaignTheme, Platform } from "@prisma/client";

type ThemeRow = {
  id: CampaignTheme;
  label: string;
  leadServiceName: string;
  tone: string;
  angle: string;
  thumbnailPath: string;
};

type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  theme: CampaignTheme;
  cadence: CampaignCadence;
  keywords: string;
  nextRunAt: string | null;
  autoApprove: boolean;
  timezone: string;
  _count: { posts: number; runs: number };
};

const CADENCES: { v: CampaignCadence; label: string }[] = [
  { v: "WEEKLY", label: "Every week" },
  { v: "BIWEEKLY", label: "Every 2 weeks" },
  { v: "MONTHLY", label: "Monthly (first slot in next month)" },
  { v: "CUSTOM", label: "Custom (treated as weekly for now)" },
];

const DOW: { v: number; label: string }[] = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

const PLATFORMS: { v: Platform; label: string }[] = [
  { v: "FACEBOOK", label: "Facebook" },
  { v: "INSTAGRAM", label: "Instagram" },
  { v: "LINKEDIN", label: "LinkedIn" },
  { v: "OMG", label: "OMG" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewDates, setPreviewDates] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [description, setDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [theme, setTheme] = useState<CampaignTheme | "">("");
  const [cadence, setCadence] = useState<CampaignCadence>("WEEKLY");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hourOfDay, setHourOfDay] = useState(9);
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [platforms, setPlatforms] = useState<Platform[]>(["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"]);
  const [postsPerRun, setPostsPerRun] = useState(1);
  const [totalPostsCap, setTotalPostsCap] = useState<string>("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [status, setStatus] = useState<CampaignStatus>("DRAFT");

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes] = await Promise.all([fetch("/api/campaigns"), fetch("/api/campaigns/themes")]);
    if (cRes.ok) setCampaigns(await cRes.json());
    if (tRes.ok) {
      const d = (await tRes.json()) as { themes: ThemeRow[] };
      setThemes(d.themes ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (themes[0] && !theme) setTheme(themes[0].id);
  }, [themes, theme]);

  const refreshPreview = useCallback(async () => {
    const res = await fetch("/api/campaigns/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cadence,
        dayOfWeek,
        hourOfDay,
        timezone,
        startAt: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as { dates: string[] };
      setPreviewDates(d.dates ?? []);
    }
  }, [cadence, dayOfWeek, hourOfDay, timezone]);

  useEffect(() => {
    if (showForm) void refreshPreview();
  }, [showForm, refreshPreview, cadence, dayOfWeek, hourOfDay, timezone]);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function createCampaign() {
    if (!name.trim() || !keywords.trim() || !theme) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          keywords: keywords.trim(),
          description: description.trim() || undefined,
          brandVoice: brandVoice.trim() || undefined,
          theme,
          cadence,
          dayOfWeek,
          hourOfDay,
          timezone,
          platforms: platforms.length ? platforms : undefined,
          postsPerRun,
          totalPostsCap: totalPostsCap ? parseInt(totalPostsCap, 10) : undefined,
          autoApprove,
          status,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setName("");
        setKeywords("");
        setDescription("");
        setBrandVoice("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Campaigns</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0" }}>
            Theme + cadence automation (beside Topics). Active campaigns run on the daily agent cron; dev runs every ~60s.
          </p>
        </div>
        <button
          type="button"
          className="omg-btn-primary"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Close" : "New campaign"}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            maxWidth: 720,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>New campaign</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Name
              <input className="omg-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Keywords (news search)
              <input className="omg-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Description (optional)
              <textarea className="omg-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Brand voice (optional)
              <textarea className="omg-input" rows={2} value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} />
            </label>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Theme</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {themes.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 8,
                      border: theme === t.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: theme === t.id ? "var(--bg-elevated)" : "var(--bg-base)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Lead: {t.leadServiceName}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Cadence
                <select className="omg-input" value={cadence} onChange={(e) => setCadence(e.target.value as CampaignCadence)}>
                  {CADENCES.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Day (local week)
                <select className="omg-input" value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}>
                  {DOW.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Hour (0–23)
                <input
                  className="omg-input"
                  type="number"
                  min={0}
                  max={23}
                  value={hourOfDay}
                  onChange={(e) => setHourOfDay(parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Timezone
                <input className="omg-input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </label>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Platforms</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATFORMS.map((p) => (
                  <label key={p.v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={platforms.includes(p.v)}
                      onChange={() => togglePlatform(p.v)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Posts per run
                <input
                  className="omg-input"
                  type="number"
                  min={1}
                  max={5}
                  value={postsPerRun}
                  onChange={(e) => setPostsPerRun(parseInt(e.target.value, 10) || 1)}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Total cap (optional)
                <input
                  className="omg-input"
                  type="number"
                  min={0}
                  placeholder="∞"
                  value={totalPostsCap}
                  onChange={(e) => setTotalPostsCap(e.target.value)}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Status
                <select
                  className="omg-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                </select>
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
              Auto-approve: schedule for publish 2 min after generate (bypasses queue)
            </label>

            {previewDates.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-primary)" }}>Next run preview</strong> (6 slots, BIWEEKLY 2+ assume prior run)
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {previewDates.map((d) => (
                    <li key={d}>{new Date(d).toLocaleString()}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="omg-btn-primary" disabled={saving} onClick={() => void createCampaign()}>
                {saving ? "Saving…" : "Create campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No campaigns yet. Create one to automate on a theme + schedule.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 16,
                background: "var(--bg-surface)",
                display: "block",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {c.status} · {c.cadence} · {c.theme}
              </div>
              <div style={{ fontSize: 12, marginTop: 8, color: "var(--text-secondary)" }}>{c.keywords}</div>
              <div style={{ fontSize: 11, marginTop: 8, color: "var(--text-muted)" }}>
                Next: {c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "—"} · {c._count.posts} posts
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
