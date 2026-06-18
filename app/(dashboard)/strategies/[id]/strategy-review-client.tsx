"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import {
  CampaignFormFields,
  type BrandOption,
  type CampaignFormFieldsValue,
} from "@/app/(dashboard)/campaigns/campaign-form-fields";
import type { CreateCampaignPayload } from "@/lib/campaigns/create-from-payload";
import {
  formFieldsToStrategyPayload,
  publishTimesFromFormText,
  strategyPayloadToFormFields,
} from "@/lib/strategies/draft-form-mapper";
import { endOfDayYmdToIso } from "@/app/(dashboard)/campaigns/schedule-editor";

type DetailDraft = {
  id: string;
  orderIndex: number;
  status: string;
  rationale: string | null;
  sourceQuote: string | null;
  payload: unknown;
  createdCampaignId: string | null;
};

type DetailCampaign = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

type DetailResponse = {
  strategy: {
    id: string;
    name: string;
    brandTemplateId: string;
    brandDisplayName: string;
    status: string;
    summary: string | null;
    sourceFileUrl: string;
    sourceFileName: string;
    analyzeError: string | null;
    createdAt: string;
    updatedAt: string;
  };
  drafts: DetailDraft[];
  campaigns: DetailCampaign[];
};

export default function StrategyReviewClient({
  strategyId,
  autoAnalyze,
}: {
  strategyId: string;
  autoAnalyze: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([
    { id: "omg", displayName: "OMG" },
  ]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [forms, setForms] = useState<Record<string, CampaignFormFieldsValue>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [committing, setCommitting] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/strategies/${strategyId}`);
    const data = (await res.json()) as DetailResponse & { error?: string };
    if (!res.ok) {
      setLoadError(data.error ?? `Error ${res.status}`);
      return;
    }
    setLoadError(null);
    setDetail(data);

    setForms((prev) => {
      const next = { ...prev };
      const brandId = data.strategy.brandTemplateId;
      for (const d of data.drafts) {
        if (d.status === "CREATED") continue;
        if (!next[d.id]) {
          next[d.id] = strategyPayloadToFormFields(d.payload as CreateCampaignPayload, brandId);
        }
      }
      for (const k of Object.keys(next)) {
        if (!data.drafts.some((x) => x.id === k)) delete next[k];
      }
      return next;
    });
  }, [strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoAnalyze) return;
    let cancelled = false;
    void (async () => {
      setAnalyzeBusy(true);
      try {
        await fetch(`/api/strategies/${strategyId}/analyze`, { method: "POST" });
        if (!cancelled) await load();
      } finally {
        if (!cancelled) setAnalyzeBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoAnalyze, strategyId, load]);

  useEffect(() => {
    void fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { brands?: BrandOption[] } | null) => {
        if (d?.brands?.length) setBrandOptions(d.brands);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const status = detail?.strategy.status;
    if (status !== "ANALYZING" && status !== "UPLOADED") return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [detail?.strategy.status, load]);

  const pendingDrafts = useMemo(
    () => detail?.drafts.filter((d) => d.status === "PENDING") ?? [],
    [detail?.drafts]
  );

  async function retryAnalyze() {
    setAnalyzeBusy(true);
    try {
      const res = await fetch(`/api/strategies/${strategyId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setLoadError(data.error ?? `Analyze failed (${res.status})`);
      }
      await load();
    } finally {
      setAnalyzeBusy(false);
    }
  }

  function queueSave(draftId: string, form: CampaignFormFieldsValue) {
    clearTimeout(saveTimers.current[draftId]);
    saveTimers.current[draftId] = setTimeout(() => void persistDraft(draftId, form), 750);
  }

  async function persistDraft(draftId: string, form: CampaignFormFieldsValue) {
    const endAtIso =
      form.schedule.runUntilYmd?.trim()
        ? endOfDayYmdToIso(form.schedule.runUntilYmd.trim(), form.schedule.timezone)
        : null;
    const payload = formFieldsToStrategyPayload(form, {
      endAtIso,
      publishTimes: publishTimesFromFormText(form.publishTimesText),
    });
    await fetch(`/api/strategies/${strategyId}/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
  }

  async function setDraftStatus(draftId: string, status: "PENDING" | "REJECTED") {
    await fetch(`/api/strategies/${strategyId}/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function commitPending() {
    setCommitting(true);
    try {
      const res = await fetch(`/api/strategies/${strategyId}/commit`, { method: "POST" });
      const data = (await res.json()) as {
        createdCount?: number;
        campaignIds?: string[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? `Commit failed (${res.status})`);
        return;
      }
      await load();
      router.push("/campaigns");
      router.refresh();
    } finally {
      setCommitting(false);
    }
  }

  const status = detail?.strategy.status;
  const showAnalyzing =
    status === "ANALYZING" || (autoAnalyze && status === "UPLOADED");

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/strategies" style={{ fontSize: 12, color: "var(--accent)" }}>
          ← Strategies
        </Link>
      </div>

      <PageHeader
        title={detail?.strategy.name ?? "Strategy"}
        subtitle={
          detail
            ? `${detail.strategy.brandDisplayName} · ${detail.strategy.status}`
            : "Loading…"
        }
        icon={<FileText size={28} strokeWidth={1.75} />}
      />

      {loadError && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            color: "var(--danger)",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            fontSize: 13,
          }}
        >
          {loadError}
        </div>
      )}

      {!detail ? (
        <p style={{ color: "var(--text-muted)" }}>Loading strategy…</p>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: "2 1 300px", minWidth: 0 }}>
            <div className="omg-card" style={{ padding: 16, marginBottom: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-muted)" }}>
                Brand (locked)
              </p>
              <p style={{ margin: 0, fontWeight: 700 }}>{detail.strategy.brandDisplayName}</p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Source: {detail.strategy.sourceFileName}
              </p>
              {detail.strategy.summary ? (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-muted)" }}>
                    Summary
                  </p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    {detail.strategy.summary}
                  </p>
                </div>
              ) : null}
              {(showAnalyzing || analyzeBusy) && (
                <p style={{ marginTop: 12, fontSize: 13, color: "var(--accent)" }}>
                  Analyzing PDF with AI… this may take a minute.
                </p>
              )}
              {detail.strategy.status === "UPLOADED" && !autoAnalyze ? (
                <button
                  type="button"
                  className="omg-btn-primary"
                  style={{ marginTop: 12 }}
                  disabled={analyzeBusy}
                  onClick={() => void retryAnalyze()}
                >
                  Analyze PDF
                </button>
              ) : null}
              {detail.strategy.status === "FAILED" && detail.strategy.analyzeError ? (
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: "var(--danger)", fontSize: 13 }}>
                    {detail.strategy.analyzeError}
                  </p>
                  <button
                    type="button"
                    className="omg-btn-primary"
                    style={{ marginTop: 8 }}
                    disabled={analyzeBusy}
                    onClick={() => void retryAnalyze()}
                  >
                    Retry analysis
                  </button>
                </div>
              ) : null}
            </div>

            <div
              className="omg-card"
              style={{
                padding: 0,
                overflow: "hidden",
                height: "72vh",
                minHeight: 420,
              }}
            >
              <iframe
                title="Strategy PDF"
                src={`${detail.strategy.sourceFileUrl}#toolbar=0`}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>

          <div style={{ flex: "3 1 360px", minWidth: 0 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Proposed campaigns</h3>
            {detail.drafts.length === 0 && detail.strategy.status === "READY_REVIEW" ? (
              <p style={{ color: "var(--text-muted)" }}>No drafts (unexpected).</p>
            ) : null}

            {detail.drafts.map((d) => {
              const form = forms[d.id];
              const open = expanded[d.id];
              const isCreated = d.status === "CREATED";

              return (
                <div
                  key={d.id}
                  className="omg-card"
                  style={{
                    marginBottom: 12,
                    padding: 14,
                    opacity: d.status === "REJECTED" ? 0.65 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    {!isCreated && (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={d.status === "PENDING"}
                          disabled={isCreated}
                          onChange={(e) =>
                            void setDraftStatus(
                              d.id,
                              e.target.checked ? "PENDING" : "REJECTED"
                            )
                          }
                        />
                        Include
                      </label>
                    )}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {form?.name ?? "Campaign"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        {d.status}
                        {d.createdCampaignId ? (
                          <>
                            {" "}
                            ·{" "}
                            <Link
                              href={`/campaigns/${d.createdCampaignId}`}
                              style={{ color: "var(--accent)" }}
                            >
                              Open campaign
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {!isCreated && (
                      <>
                        <button
                          type="button"
                          className="omg-btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={() =>
                            void setDraftStatus(d.id, "REJECTED")
                          }
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="omg-btn-ghost"
                          style={{
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                          }
                        >
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          Details
                        </button>
                      </>
                    )}
                  </div>

                  {d.sourceQuote ? (
                    <blockquote
                      style={{
                        margin: "12px 0 0",
                        padding: "10px 12px",
                        borderLeft: "3px solid var(--accent)",
                        background: "var(--bg-elevated)",
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: "var(--text-secondary)",
                      }}
                    >
                      “{d.sourceQuote}”
                    </blockquote>
                  ) : null}

                  {d.rationale ? (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {d.rationale}
                    </p>
                  ) : null}

                  {open && form && !isCreated ? (
                    <div style={{ marginTop: 16 }}>
                      <CampaignFormFields
                        value={form}
                        onChange={(patch) => {
                          const { brandTemplateId: _brand, ...rest } = patch;
                          if (Object.keys(rest).length === 0) return;
                          setForms((prev) => {
                            const cur = prev[d.id];
                            if (!cur) return prev;
                            const merged = { ...cur, ...rest };
                            const next = { ...prev, [d.id]: merged };
                            queueSave(d.id, merged);
                            return next;
                          });
                        }}
                        onScheduleChange={(patch) => {
                          setForms((prev) => {
                            const cur = prev[d.id];
                            if (!cur) return prev;
                            const merged = {
                              ...cur,
                              schedule: { ...cur.schedule, ...patch },
                            };
                            const next = { ...prev, [d.id]: merged };
                            queueSave(d.id, merged);
                            return next;
                          });
                        }}
                        idPrefix={`strategy-draft-${d.id}`}
                        layout="page"
                        showAdvanced
                        alwaysShowAdvanced
                        onAdvancedOpenChange={() => {}}
                        brandOptions={brandOptions}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

            {detail.campaigns.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 14, margin: "0 0 8px" }}>Campaigns from this strategy</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {detail.campaigns.map((c) => (
                    <li key={c.id} style={{ marginBottom: 6 }}>
                      <Link href={`/campaigns/${c.id}`} style={{ color: "var(--accent)" }}>
                        {c.name}
                      </Link>{" "}
                      <span style={{ color: "var(--text-muted)" }}>({c.status})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "var(--sidebar-w, 220px)",
          right: 0,
          padding: "14px 24px",
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          zIndex: 30,
        }}
      >
        <button
          type="button"
          className="omg-btn-primary"
          disabled={
            committing ||
            pendingDrafts.length === 0 ||
            detail?.strategy.status !== "READY_REVIEW"
          }
          onClick={() => void commitPending()}
        >
          {committing
            ? "Creating…"
            : `Create ${pendingDrafts.length} campaign${pendingDrafts.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
