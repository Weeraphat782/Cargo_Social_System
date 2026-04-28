"use client";

import { useCallback, useMemo } from "react";
import type { z } from "zod";
import type { CampaignTheme } from "@prisma/client";
import { brandPromptTemplatePayloadZ } from "@/lib/brands/payload-schema";

type Payload = z.infer<typeof brandPromptTemplatePayloadZ>;

type Props = {
  jsonText: string;
  onJsonTextChange: (next: string) => void;
};

const THEME_ORDER: CampaignTheme[] = ["RELIABILITY_PRO", "INNOVATION_TECH", "SPEED_URGENCY"];

const sectionStyle: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid var(--border)",
};

const lockedHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  margin: "0 0 8px",
  userSelect: "none",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  lineHeight: 1.45,
};

function parseCommaList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function commaJoin(arr: string[]): string {
  return arr.join(", ");
}

export function BrandMasterPayloadForm({ jsonText, onJsonTextChange }: Props) {
  const commit = useCallback(
    (updater: (prev: Payload) => Payload) => {
      const trimmed = jsonText.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return;
      }
      const z = brandPromptTemplatePayloadZ.safeParse(parsed);
      if (!z.success) return;
      try {
        const next = updater(z.data);
        const validated = brandPromptTemplatePayloadZ.parse(next);
        onJsonTextChange(JSON.stringify(validated, null, 2));
      } catch {
        /* ignore invalid intermediate states if parse fails */
      }
    },
    [jsonText, onJsonTextChange],
  );

  const result = useMemo(() => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      return { kind: "empty" as const };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { kind: "json_error" as const };
    }
    const z = brandPromptTemplatePayloadZ.safeParse(parsed);
    if (!z.success) {
      return { kind: "schema_error" as const, issues: z.error.issues };
    }
    return { kind: "ok" as const, data: z.data };
  }, [jsonText]);

  if (result.kind === "empty") {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Form unlocks when JSON has valid content.
      </div>
    );
  }

  if (result.kind === "json_error") {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          fontSize: 13,
          color: "var(--danger)",
        }}
      >
        Plain editor: fix JSON syntax on the left first.
      </div>
    );
  }

  if (result.kind === "schema_error") {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", marginBottom: 8 }}>
          Template schema incomplete or invalid — fix JSON or fields below once valid.
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {result.issues.slice(0, 12).map((issue, i) => (
            <li key={i}>
              <code style={{ fontSize: 11 }}>{issue.path.join(".") || "(root)"}</code>: {issue.message}
            </li>
          ))}
          {result.issues.length > 12 ? <li>…and {result.issues.length - 12} more</li> : null}
        </ul>
      </div>
    );
  }

  const d = result.data;

  return (
    <div
      className="omg-card"
      style={{
        padding: 16,
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
        Readable editor
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.45 }}>
        Section titles are fixed; values sync to JSON on the left.
      </p>

      <div style={sectionStyle}>
        <h4 style={lockedHeaderStyle}>Brand</h4>
        <label style={fieldLabelStyle}>id (optional)</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.id ?? ""}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              id: e.target.value.trim() || undefined,
            }))
          }
        />
        <label style={fieldLabelStyle}>displayName (optional)</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.displayName ?? ""}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              displayName: e.target.value.trim() || undefined,
            }))
          }
        />
        <label style={fieldLabelStyle}>orgDisplayName</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.orgDisplayName}
          onChange={(e) => commit((p) => ({ ...p, orgDisplayName: e.target.value }))}
        />
        <label style={fieldLabelStyle}>orgShort</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.orgShort}
          onChange={(e) => commit((p) => ({ ...p, orgShort: e.target.value }))}
        />
        <label style={fieldLabelStyle}>industryContext</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 72, marginBottom: 10, resize: "vertical" }}
          value={d.industryContext}
          onChange={(e) => commit((p) => ({ ...p, industryContext: e.target.value }))}
        />
        <label style={fieldLabelStyle}>strategistTagline</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 80, resize: "vertical" }}
          value={d.strategistTagline}
          onChange={(e) => commit((p) => ({ ...p, strategistTagline: e.target.value }))}
        />
      </div>

      <div style={sectionStyle}>
        <h4 style={lockedHeaderStyle}>Newsroom / site labels</h4>
        <label style={fieldLabelStyle}>sourceArticleSiteLabel</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.sourceArticleSiteLabel}
          onChange={(e) => commit((p) => ({ ...p, sourceArticleSiteLabel: e.target.value }))}
        />
        <label style={fieldLabelStyle}>servicesCatalogHeading</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 56, marginBottom: 10, resize: "vertical" }}
          value={d.servicesCatalogHeading}
          onChange={(e) => commit((p) => ({ ...p, servicesCatalogHeading: e.target.value }))}
        />
        <label style={fieldLabelStyle}>newsroomRequirementsHeading</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 56, resize: "vertical" }}
          value={d.newsroomRequirementsHeading}
          onChange={(e) => commit((p) => ({ ...p, newsroomRequirementsHeading: e.target.value }))}
        />
      </div>

      <div style={sectionStyle}>
        <h4 style={lockedHeaderStyle}>Services ({d.services.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {d.services.map((s, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-base)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Service {i + 1}</span>
                <button
                  type="button"
                  className="omg-btn-ghost"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() =>
                    commit((p) => ({
                      ...p,
                      services: p.services.filter((_, j) => j !== i),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
              <label style={fieldLabelStyle}>name</label>
              <input
                className="omg-input"
                style={{ ...inputBase, marginBottom: 8 }}
                value={s.name}
                onChange={(e) =>
                  commit((p) => ({
                    ...p,
                    services: p.services.map((svc, j) => (j === i ? { ...svc, name: e.target.value } : svc)),
                  }))
                }
              />
              <label style={fieldLabelStyle}>tags (comma-separated)</label>
              <input
                className="omg-input"
                style={{ ...inputBase, marginBottom: 8 }}
                value={commaJoin(s.tags)}
                onChange={(e) =>
                  commit((p) => ({
                    ...p,
                    services: p.services.map((svc, j) =>
                      j === i ? { ...svc, tags: parseCommaList(e.target.value) } : svc,
                    ),
                  }))
                }
              />
              <label style={fieldLabelStyle}>pitch</label>
              <textarea
                className="omg-input"
                spellCheck={false}
                style={{ ...inputBase, minHeight: 72, resize: "vertical" }}
                value={s.pitch}
                onChange={(e) =>
                  commit((p) => ({
                    ...p,
                    services: p.services.map((svc, j) => (j === i ? { ...svc, pitch: e.target.value } : svc)),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="omg-btn-ghost"
          style={{ marginTop: 12, fontSize: 12 }}
          onClick={() =>
            commit((p) => ({
              ...p,
              services: [...p.services, { name: "", tags: [], pitch: "" }],
            }))
          }
        >
          Add service
        </button>
      </div>

      <div style={sectionStyle}>
        <h4 style={lockedHeaderStyle}>Promo guidance</h4>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 96, marginBottom: 12, resize: "vertical" }}
          value={d.promoGuidance}
          onChange={(e) => commit((p) => ({ ...p, promoGuidance: e.target.value }))}
        />
        <label style={fieldLabelStyle}>mandatoryCtaUrl</label>
        <input
          className="omg-input"
          style={{ ...inputBase }}
          value={d.mandatoryCtaUrl}
          onChange={(e) => commit((p) => ({ ...p, mandatoryCtaUrl: e.target.value }))}
        />
      </div>

      <div style={sectionStyle}>
        <h4 style={lockedHeaderStyle}>Self-promo block</h4>
        <label style={fieldLabelStyle}>defaultSourceTitle</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.selfPromo.defaultSourceTitle}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              selfPromo: { ...p.selfPromo, defaultSourceTitle: e.target.value },
            }))
          }
        />
        <label style={fieldLabelStyle}>contentMarker</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={d.selfPromo.contentMarker}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              selfPromo: { ...p.selfPromo, contentMarker: e.target.value },
            }))
          }
        />
        <label style={fieldLabelStyle}>citationLine</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 56, marginBottom: 10, resize: "vertical" }}
          value={d.selfPromo.citationLine}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              selfPromo: { ...p.selfPromo, citationLine: e.target.value },
            }))
          }
        />
        <label style={fieldLabelStyle}>fallbackPublicUrl</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 12 }}
          value={d.selfPromo.fallbackPublicUrl}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              selfPromo: { ...p.selfPromo, fallbackPublicUrl: e.target.value },
            }))
          }
        />
        <label style={fieldLabelStyle}>selfPromoEditorialNoExternalSource</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 72, marginBottom: 10, resize: "vertical" }}
          value={d.selfPromoEditorialNoExternalSource}
          onChange={(e) => commit((p) => ({ ...p, selfPromoEditorialNoExternalSource: e.target.value }))}
        />
        <label style={fieldLabelStyle}>selfPromoGeneralValueProposition</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 96, resize: "vertical" }}
          value={d.selfPromoGeneralValueProposition}
          onChange={(e) => commit((p) => ({ ...p, selfPromoGeneralValueProposition: e.target.value }))}
        />
      </div>

      <div style={sectionStyle}>
        <h4 style={lockedHeaderStyle}>Campaign suggest (AI planner)</h4>
        <label style={fieldLabelStyle}>plannerRoleLine</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 56, marginBottom: 10, resize: "vertical" }}
          value={d.suggestCampaign.plannerRoleLine}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              suggestCampaign: { ...p.suggestCampaign, plannerRoleLine: e.target.value },
            }))
          }
        />
        <label style={fieldLabelStyle}>plannerBrief</label>
        <textarea
          className="omg-input"
          spellCheck={false}
          style={{ ...inputBase, minHeight: 96, marginBottom: 10, resize: "vertical" }}
          value={d.suggestCampaign.plannerBrief}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              suggestCampaign: { ...p.suggestCampaign, plannerBrief: e.target.value },
            }))
          }
        />
        <label style={fieldLabelStyle}>forbiddenNameSubstrings (comma-separated)</label>
        <input
          className="omg-input"
          style={{ ...inputBase, marginBottom: 10 }}
          value={commaJoin(d.suggestCampaign.forbiddenNameSubstrings)}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              suggestCampaign: {
                ...p.suggestCampaign,
                forbiddenNameSubstrings: parseCommaList(e.target.value),
              },
            }))
          }
        />
        <label style={fieldLabelStyle}>suggestCampaign.orgShort</label>
        <input
          className="omg-input"
          style={{ ...inputBase }}
          value={d.suggestCampaign.orgShort}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              suggestCampaign: { ...p.suggestCampaign, orgShort: e.target.value },
            }))
          }
        />
      </div>

      <div style={{ ...sectionStyle, borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}>
        <h4 style={lockedHeaderStyle}>Theme lanes</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {THEME_ORDER.map((themeKey) => {
            const b = d.themeBundles[themeKey];
            return (
              <div
                key={themeKey}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-base)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
                  {themeKey}{" "}
                  <span style={{ fontWeight: 500, color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)" }}>
                    · id locked: {b.id}
                  </span>
                </div>
                <label style={fieldLabelStyle}>label</label>
                <input
                  className="omg-input"
                  style={{ ...inputBase, marginBottom: 8 }}
                  value={b.label}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: { ...p.themeBundles[themeKey], label: e.target.value },
                      },
                    }))
                  }
                />
                <label style={fieldLabelStyle}>leadServiceName</label>
                <input
                  className="omg-input"
                  style={{ ...inputBase, marginBottom: 8 }}
                  value={b.leadServiceName}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: { ...p.themeBundles[themeKey], leadServiceName: e.target.value },
                      },
                    }))
                  }
                />
                <label style={fieldLabelStyle}>referenceCategory (optional)</label>
                <input
                  className="omg-input"
                  style={{ ...inputBase, marginBottom: 8 }}
                  value={b.referenceCategory ?? ""}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: {
                          ...p.themeBundles[themeKey],
                          referenceCategory: e.target.value.trim() || undefined,
                        },
                      },
                    }))
                  }
                />
                <label style={fieldLabelStyle}>thumbnailPath</label>
                <input
                  className="omg-input"
                  style={{ ...inputBase, marginBottom: 8 }}
                  value={b.thumbnailPath}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: { ...p.themeBundles[themeKey], thumbnailPath: e.target.value },
                      },
                    }))
                  }
                />
                <label style={fieldLabelStyle}>tone</label>
                <textarea
                  className="omg-input"
                  spellCheck={false}
                  style={{ ...inputBase, minHeight: 56, marginBottom: 8, resize: "vertical" }}
                  value={b.tone}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: { ...p.themeBundles[themeKey], tone: e.target.value },
                      },
                    }))
                  }
                />
                <label style={fieldLabelStyle}>angle</label>
                <textarea
                  className="omg-input"
                  spellCheck={false}
                  style={{ ...inputBase, minHeight: 56, marginBottom: 8, resize: "vertical" }}
                  value={b.angle}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: { ...p.themeBundles[themeKey], angle: e.target.value },
                      },
                    }))
                  }
                />
                <label style={fieldLabelStyle}>visualStyleNotes</label>
                <textarea
                  className="omg-input"
                  spellCheck={false}
                  style={{ ...inputBase, minHeight: 72, resize: "vertical" }}
                  value={b.visualStyleNotes}
                  onChange={(e) =>
                    commit((p) => ({
                      ...p,
                      themeBundles: {
                        ...p.themeBundles,
                        [themeKey]: { ...p.themeBundles[themeKey], visualStyleNotes: e.target.value },
                      },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
