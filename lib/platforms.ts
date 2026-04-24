export const PLATFORM_ORDER = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as const;
export type KnownPlatform = (typeof PLATFORM_ORDER)[number];

export const platformMeta: Record<string, { label: string; cls: string }> = {
  FACEBOOK: { label: "Facebook", cls: "platform-fb" },
  INSTAGRAM: { label: "Instagram", cls: "platform-ig" },
  LINKEDIN: { label: "LinkedIn", cls: "platform-li" },
  OMG: { label: "OMG Cargo", cls: "platform-omg" },
};

export function sortByPlatform<T extends { platform: string }>(variants: T[]): T[] {
  return [...variants].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a.platform as KnownPlatform);
    const ib = PLATFORM_ORDER.indexOf(b.platform as KnownPlatform);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/** Shorter labels for tight spaces (dashboard pills, etc.). */
export const platformPill: Record<string, { label: string; cls: string }> = {
  FACEBOOK: { label: "FB", cls: "platform-fb" },
  INSTAGRAM: { label: "IG", cls: "platform-ig" },
  LINKEDIN: { label: "LI", cls: "platform-li" },
  OMG: { label: "OMG", cls: "platform-omg" },
};
