import type { CampaignTheme } from "@prisma/client";

export type ThemeBundle = {
  id: CampaignTheme;
  label: string;
  /** Service name from OMG_SERVICES to lean into in copy */
  leadServiceName: string;
  /** Short tone/voice for prompts */
  tone: string;
  /** What to stress in the image + social hooks */
  angle: string;
  /** Palette + lighting mood only; image subject must come from news/content, not this field */
  visualStyleNotes: string;
  /** Optional folder under public/reference-images/ — set only to lock a look */
  referenceCategory?: string;
  /** Optional image under public/ for UI cards */
  thumbnailPath: string;
};

export const THEME_BUNDLES: ThemeBundle[] = [
  {
    id: "RELIABILITY_PRO",
    label: "Reliability & compliance",
    leadServiceName: "Pharmaceutical Cold Chain",
    tone:
      "Authoritative, audit-ready, calm confidence. Emphasize GDP, chain-of-custody, and zero-excursion delivery.",
    angle:
      "Frame every story as proof of operational discipline: validated packaging, documented handoffs, and predictable outcomes for life-science and regulated cargo.",
    visualStyleNotes:
      "Navy, white, and cool grey palette; soft even lighting; calm, premium mood.",
    thumbnailPath: "",
  },
  {
    id: "INNOVATION_TECH",
    label: "Innovation & visibility",
    leadServiceName: "AI-Powered Logistics Visibility",
    tone:
      "Forward-looking, data-informed, product-led. Emphasize prediction, exception handling, and stakeholder alignment.",
    angle:
      "Connect industry headlines to visibility and control: real-time monitoring, AI-assisted foresight, and transparent ops without hype.",
    visualStyleNotes:
      "Teal and electric blue accents; balanced natural light; forward-looking mood.",
    thumbnailPath: "",
  },
  {
    id: "SPEED_URGENCY",
    label: "Speed & time-critical",
    leadServiceName: "Time-Critical & Emergency Cargo",
    tone:
      "Decisive, high-trust, clock-aware. Emphasize NFO, charter, and on-board courier when minutes matter.",
    angle:
      "Tie news to response velocity: same-day execution, 24/7 control, and escalation paths for mission-critical freight.",
    visualStyleNotes:
      "Deep orange and crimson highlights on a neutral base; dramatic but professional lighting; sense of momentum and urgency.",
    thumbnailPath: "",
  },
];

const byId: Record<CampaignTheme, ThemeBundle> = {
  RELIABILITY_PRO: THEME_BUNDLES[0]!,
  INNOVATION_TECH: THEME_BUNDLES[1]!,
  SPEED_URGENCY: THEME_BUNDLES[2]!,
};

export function getThemeBundle(theme: CampaignTheme): ThemeBundle {
  return byId[theme];
}

export function listThemesForApi(): {
  id: CampaignTheme;
  label: string;
  leadServiceName: string;
  tone: string;
  angle: string;
  thumbnailPath: string;
}[] {
  return THEME_BUNDLES.map(
    ({ id, label, leadServiceName, tone, angle, thumbnailPath }) => ({
      id,
      label,
      leadServiceName,
      tone,
      angle,
      thumbnailPath,
    })
  );
}
