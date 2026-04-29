import { NextResponse } from "next/server";
import { CredentialType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { encryptPayload, decryptPayload } from "@/lib/crypto";
import type { MetaTokens } from "@/lib/publishers/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as MetaTokens;
    if (!body.pageAccessToken || !body.pageId || !body.igUserId) {
      return NextResponse.json(
        { error: "pageAccessToken, pageId, igUserId required" },
        { status: 400 }
      );
    }

    const existing = await prisma.platformCredential.findUnique({
      where: { type: CredentialType.META },
    });

    let merged: MetaTokens = body;
    if (existing) {
      try {
        const prev = decryptPayload<MetaTokens>(existing.encryptedPayload);
        merged = {
          ...prev,
          pageAccessToken: body.pageAccessToken,
          pageId: body.pageId,
          igUserId: body.igUserId,
        };
      } catch {
        merged = body;
      }
    }

    const encryptedPayload = encryptPayload(merged);

    await prisma.platformCredential.upsert({
      where: { type: CredentialType.META },
      create: {
        type: CredentialType.META,
        encryptedPayload,
        expiresAt: null,
      },
      update: { encryptedPayload, expiresAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.platformCredential.findUnique({
    where: { type: CredentialType.META },
  });
  return NextResponse.json({ connected: !!row });
}
