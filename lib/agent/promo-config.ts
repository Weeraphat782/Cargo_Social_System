export type OmgService = {
  name: string;
  tags: string[];
  pitch: string;
};

export const OMG_SERVICES: OmgService[] = [
  {
    name: "Specialized Air Freight",
    tags: ["air freight", "aircargo", "charter", "time-critical"],
    pitch:
      "End-to-end managed air freight for time-critical and oversized cargo, with proactive milestone tracking and 24/7 ops control.",
  },
  {
    name: "Pharmaceutical Cold Chain",
    tags: ["pharma", "cold chain", "gdp", "temperature-controlled"],
    pitch:
      "GDP-compliant temperature-controlled movements with documented handling, validated packaging, and full chain-of-custody evidence.",
  },
  {
    name: "AI-Powered Logistics Visibility",
    tags: ["ai", "visibility", "predictive", "analytics"],
    pitch:
      "AI-assisted shipment monitoring that predicts delays, flags anomalies, and keeps stakeholders aligned in real time.",
  },
  {
    name: "Time-Critical & Emergency Cargo",
    tags: ["emergency", "next-flight-out", "on-board courier"],
    pitch:
      "Rapid-response logistics for shipments where every hour matters — NFO, on-board couriers, and chartered lift.",
  },
];

export const PROMO_GUIDANCE = `OMG self-promotion rules for Facebook / Instagram / LinkedIn:
- Do NOT rewrite or summarize the news article. Use the news only as a contextual hook (industry trend) and pivot quickly to OMG's capability.
- Pick the ONE service from OMG_SERVICES whose tags best match the news topic and lead with it. If none clearly match, default to "Specialized Air Freight".
- Highlight a concrete benefit (reliability, compliance, speed, visibility) and end with a soft CTA ("Talk to our team", "Learn more", etc.).
- Never quote long passages from the source. No citations needed on social.`;
