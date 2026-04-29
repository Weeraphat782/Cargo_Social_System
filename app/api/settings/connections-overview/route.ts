import { NextResponse } from "next/server";
import { CredentialType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { decryptPayload } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import type { LinkedInTokens, MetaTokens } from "@/lib/publishers/types";

function previewNumericId(id: string): string | undefined {
  const t = id.trim();
  if (!t) return undefined;
  return t.length <= 8 ? t : `···${t.slice(-6)}`;
}

function previewLinkedInUrn(urn: string): string | undefined {
  const t = urn.trim();
  if (!t) return undefined;
  const seg = t.split(":").pop() ?? t;
  return seg.length > 14 ? `···${seg.slice(-12)}` : seg;
}

/** ISO date prefix or null — OAuth user token expiry is approximate (~60 days). */
function oauthExpiryApprox(isoOrDate: string | Date | null | undefined): string | null {
  if (!isoOrDate) return null;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(String(isoOrDate));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** True when expiry within 14 days (prompt reconnect). */
function oauthExpirySoon(isoOrDate: string | Date | null | undefined): boolean {
  if (!isoOrDate) return false;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(String(isoOrDate));
  if (Number.isNaN(d.getTime())) return false;
  const daysLeft = (d.getTime() - Date.now()) / (86400 * 1000);
  return daysLeft <= 14 && daysLeft >= 0;
}

function hostFromBaseUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metaRow = await prisma.platformCredential.findUnique({
    where: { type: CredentialType.META },
  });
  let meta: {
    connected: boolean;
    pageIdPreview?: string;
    igUserIdPreview?: string;
    oauthExpiryApprox?: string | null;
    oauthExpirySoon?: boolean;
  };
  if (!metaRow) {
    meta = { connected: false };
  } else {
    try {
      const tokens = decryptPayload<MetaTokens>(metaRow.encryptedPayload);
      meta = {
        connected: true,
        pageIdPreview: previewNumericId(tokens.pageId),
        igUserIdPreview: previewNumericId(tokens.igUserId),
        oauthExpiryApprox: oauthExpiryApprox(tokens.userAccessTokenExpiresAt ?? metaRow.expiresAt),
        oauthExpirySoon: oauthExpirySoon(tokens.userAccessTokenExpiresAt ?? metaRow.expiresAt),
      };
    } catch {
      meta = { connected: true };
    }
  }

  const liRow = await prisma.platformCredential.findUnique({
    where: { type: CredentialType.LINKEDIN },
  });
  let linkedin: { connected: boolean; personUrnPreview?: string };
  if (!liRow) {
    linkedin = { connected: false };
  } else {
    try {
      const tokens = decryptPayload<LinkedInTokens>(liRow.encryptedPayload);
      linkedin = {
        connected: true,
        personUrnPreview: previewLinkedInUrn(tokens.personUrn),
      };
    } catch {
      linkedin = { connected: true };
    }
  }

  const env = getServerEnv();
  const base = env.OMG_API_BASE?.trim();
  const token = env.OMG_AGENT_TOKEN?.trim();
  const configured = Boolean(base && token);

  return NextResponse.json({
    meta,
    linkedin,
    omg: {
      configured,
      baseHost: hostFromBaseUrl(base ?? ""),
    },
  });
}
