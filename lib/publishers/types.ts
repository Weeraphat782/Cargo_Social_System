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
};

export type LinkedInTokens = {
  accessToken: string;
  personUrn: string;
};

export { Platform };
