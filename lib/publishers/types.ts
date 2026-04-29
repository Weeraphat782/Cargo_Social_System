import type { Platform } from "@prisma/client";

export type PublishInput = {
  caption: string;
  imageUrl: string;
  /** OMG-only */
  title?: string;
  bodyMd?: string;
  slug?: string;
};

export type PublishResult = { remoteId: string; raw?: unknown };

export type Publisher = (input: PublishInput) => Promise<PublishResult>;

export type MetaTokens = {
  pageAccessToken: string;
  pageId: string;
  igUserId: string;
  /** Long-lived user token from OAuth — optional; enables future refresh flows. */
  userAccessToken?: string;
  /** ISO timestamp when `userAccessToken` expires (approximate). */
  userAccessTokenExpiresAt?: string;
};

export type LinkedInTokens = {
  accessToken: string;
  personUrn: string;
};

export { Platform };
