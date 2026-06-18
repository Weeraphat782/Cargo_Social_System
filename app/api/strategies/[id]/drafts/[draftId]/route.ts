import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; draftId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, draftId } = await ctx.params;

  let body: {
    status?: "PENDING" | "REJECTED";
    payload?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = await prisma.strategyCampaignDraft.findFirst({
    where: { id: draftId, strategyId: id },
  });

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (draft.status === "CREATED") {
    return NextResponse.json(
      { error: "Cannot edit a draft that already became a campaign" },
      { status: 400 }
    );
  }

  const data: Prisma.StrategyCampaignDraftUpdateInput = {};

  if (body.status === "PENDING" || body.status === "REJECTED") {
    data.status = body.status;
  }

  if (body.payload != null && typeof body.payload === "object") {
    const prev = (draft.payload ?? {}) as Record<string, unknown>;
    data.payload = { ...prev, ...body.payload } as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.strategyCampaignDraft.update({
    where: { id: draftId },
    data,
  });

  return NextResponse.json({
    draft: {
      id: updated.id,
      orderIndex: updated.orderIndex,
      status: updated.status,
      rationale: updated.rationale,
      sourceQuote: updated.sourceQuote,
      payload: updated.payload,
      createdCampaignId: updated.createdCampaignId,
    },
  });
}
