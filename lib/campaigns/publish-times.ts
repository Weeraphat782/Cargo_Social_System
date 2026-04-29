import type { Prisma } from "@prisma/client";

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse stored JSON / API payload into ordered HH:mm strings. */
export function parsePublishTimesJson(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null || !Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (HM_RE.test(t)) out.push(t);
  }
  return out;
}

/** Split UI textarea / comma-separated input into valid HH:mm tokens (max `max`). */
export function parsePublishTimesFromText(raw: string, max: number): string[] {
  const parts = raw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const t of parts) {
    if (!HM_RE.test(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export const MAX_PUBLISH_TIME_SLOTS = 48;

/** Parse API / JSON body (string array) into ordered HH:mm. */
export function normalizePublishTimesFromApi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (HM_RE.test(t)) out.push(t);
    if (out.length >= MAX_PUBLISH_TIME_SLOTS) break;
  }
  return out;
}
