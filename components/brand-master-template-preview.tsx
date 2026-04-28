"use client";

import { useMemo } from "react";
import { brandPromptTemplatePayloadZ } from "@/lib/brands/payload-schema";

type Props = {
  jsonText: string;
};

const sectionStyle: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid var(--border)",
};

const hStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  margin: "0 0 8px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  margin: 0,
};

export function BrandMasterTemplatePreview({ jsonText }: Props) {
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
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
        Preview appears here when JSON is valid.
      </div>
    );
  }

  if (result.kind === "json_error") {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          fontSize: 13,
          color: "var(--danger)",
        }}
      >
        Preview: invalid JSON — fix syntax before saving.
      </div>
    );
  }

  if (result.kind === "schema_error") {
    return (
      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", marginBottom: 8 }}>
          Preview: template schema incomplete or invalid
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
  const themes = ["RELIABILITY_PRO", "INNOVATION_TECH", "SPEED_URGENCY"] as const;

  return (
    <div
      className="omg-card"
      style={{
        marginTop: 16,
        padding: 16,
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
        Readable preview
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.45 }}>
        Same fields as stored JSON — useful for checking tone and coverage before save.
      </p>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Brand</h4>
        <p style={bodyStyle}>
          {(d.id ?? "—") + " · " + (d.displayName ?? "—")}
          {"\n"}
          <strong>{d.orgDisplayName}</strong> ({d.orgShort}) · {d.industryContext}
        </p>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Strategist line</h4>
        <p style={bodyStyle}>{d.strategistTagline}</p>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Newsroom / site labels</h4>
        <p style={bodyStyle}>
          Source article: {d.sourceArticleSiteLabel}
          {"\n\n"}
          {d.servicesCatalogHeading}
          {"\n\n"}
          {d.newsroomRequirementsHeading}
        </p>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Services ({d.services.length})</h4>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {d.services.map((s, i) => (
            <li key={i} style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--text-primary)" }}>{s.name}</strong>
              {" · "}
              <span style={{ fontSize: 11 }}>{s.tags.join(", ")}</span>
              {"\n"}
              {s.pitch}
            </li>
          ))}
        </ul>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Promo guidance</h4>
        <p style={bodyStyle}>{d.promoGuidance}</p>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Mandatory CTA</h4>
        <p style={{ ...bodyStyle, wordBreak: "break-all" }}>
          <a href={d.mandatoryCtaUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
            {d.mandatoryCtaUrl}
          </a>
        </p>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Self-promo block</h4>
        <p style={bodyStyle}>
          Title: {d.selfPromo.defaultSourceTitle}
          {"\n"}
          Marker: {d.selfPromo.contentMarker}
          {"\n"}
          Citation: {d.selfPromo.citationLine}
          {"\n"}
          Fallback URL: {d.selfPromo.fallbackPublicUrl}
        </p>
        <p style={{ ...bodyStyle, marginTop: 10 }}>{d.selfPromoEditorialNoExternalSource}</p>
        <p style={{ ...bodyStyle, marginTop: 10 }}>{d.selfPromoGeneralValueProposition}</p>
      </div>

      <div style={sectionStyle}>
        <h4 style={hStyle}>Campaign suggest (AI planner)</h4>
        <p style={bodyStyle}>
          Role: {d.suggestCampaign.plannerRoleLine}
          {"\n\n"}
          Brief: {d.suggestCampaign.plannerBrief}
          {"\n\n"}
          Forbidden name fragments: {d.suggestCampaign.forbiddenNameSubstrings.join(", ")}
        </p>
      </div>

      <div style={{ ...sectionStyle, borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}>
        <h4 style={hStyle}>Theme lanes</h4>
        <div style={{ display: "grid", gap: 12 }}>
          {themes.map((key) => {
            const b = d.themeBundles[key];
            return (
              <div
                key={key}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-base)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
                  {b.label}{" "}
                  <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>({key})</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                  Lead service: <strong>{b.leadServiceName}</strong>
                  {b.referenceCategory ? ` · Ref: ${b.referenceCategory}` : null}
                </div>
                <p style={{ ...bodyStyle, fontSize: 12 }}>
                  <em>Tone:</em> {b.tone}
                  {"\n\n"}
                  <em>Angle:</em> {b.angle}
                  {"\n\n"}
                  <em>Visual:</em> {b.visualStyleNotes}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
