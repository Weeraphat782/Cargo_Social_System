import { CredentialType, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptPayload } from "@/lib/crypto";
import type { MetaTokens, LinkedInTokens } from "./types";
import { publishFacebookPage } from "./facebook";
import { publishInstagram } from "./instagram";
import { publishLinkedInUgc } from "./linkedin";
import { publishOmgNewsroom } from "./omg";
import type { PublishInput } from "./types";

export async function publishPostVariant(
  platform: Platform,
  input: PublishInput
): Promise<{ remoteId: string }> {
  switch (platform) {
    case "FACEBOOK": {
      const meta = await getMetaTokens();
      const r = await publishFacebookPage(meta.pageId, meta.pageAccessToken, input);
      return { remoteId: r.remoteId };
    }
    case "INSTAGRAM": {
      const meta = await getMetaTokens();
      const r = await publishInstagram(meta.igUserId, meta.pageAccessToken, input, meta.userAccessToken);
      return { remoteId: r.remoteId };
    }
    case "LINKEDIN": {
      const li = await getLinkedInTokens();
      const r = await publishLinkedInUgc(li.accessToken, li.personUrn, input);
      return { remoteId: r.remoteId };
    }
    case "OMG": {
      const r = await publishOmgNewsroom(input);
      return { remoteId: r.remoteId };
    }
    default:
      throw new Error(`Unknown platform ${platform}`);
  }
}

async function getMetaTokens(): Promise<MetaTokens> {
  const row = await prisma.platformCredential.findUnique({
    where: { type: CredentialType.META },
  });
  if (!row) throw new Error("Meta not connected — add credentials in Settings");
  return decryptPayload<MetaTokens>(row.encryptedPayload);
}

export async function getLinkedInTokens(): Promise<LinkedInTokens> {
  const row = await prisma.platformCredential.findUnique({
    where: { type: CredentialType.LINKEDIN },
  });
  if (!row) throw new Error("LinkedIn not connected — add credentials in Settings");
  return decryptPayload<LinkedInTokens>(row.encryptedPayload);
}

export { publishFacebookPage, publishInstagram, publishLinkedInUgc, publishOmgNewsroom };
