import type { Dispatch, SetStateAction } from "react";
import type { PostListRowJson as Post } from "@/lib/post-list-payload";
export { platformMeta } from "@/lib/platforms";

export type RefCategory = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
};

export const statusBadge: Record<string, string> = {
  PENDING_APPROVAL: "omg-badge-pending",
  APPROVED: "omg-badge-approved",
  PUBLISHED: "omg-badge-published",
  FAILED: "omg-badge-failed",
  REJECTED: "omg-badge-rejected",
  SCHEDULED: "omg-badge-scheduled",
};

const PLATFORM_ORDER = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "OMG"] as const;

export function sortByPlatform<T extends { platform: string }>(variants: T[]): T[] {
  return [...variants].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a.platform as (typeof PLATFORM_ORDER)[number]);
    const ib = PLATFORM_ORDER.indexOf(b.platform as (typeof PLATFORM_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export const PUBLISHED_FEED_MAX = 30;

export type SetPending = Dispatch<SetStateAction<Post[]>>;
