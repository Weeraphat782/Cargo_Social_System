import { NextResponse } from "next/server";
import { CredentialType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { decryptPayload, encryptPayload } from "@/lib/crypto";
import type { LinkedInTokens } from "@/lib/publishers/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as LinkedInTokens;
    if (!body.accessToken || !body.personUrn) {
      return NextResponse.json(
        { error: "accessToken and personUrn required" },
        { status: 400 }
      );
    }

    const encryptedPayload = encryptPayload(body);

    await prisma.platformCredential.upsert({
      where: { type: CredentialType.LINKEDIN },
      create: {
        type: CredentialType.LINKEDIN,
        encryptedPayload,
      },
      update: { encryptedPayload },
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
    where: { type: CredentialType.LINKEDIN },
  });
  if (!row) {
    return NextResponse.json({ connected: false });
  }
  try {
    const { personUrn } = decryptPayload<LinkedInTokens>(row.encryptedPayload);
    return NextResponse.json({ connected: true, personUrn });
  } catch {
    return NextResponse.json({ connected: true });
  }
}
