import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** PATCH /api/planner/plans/[id] — update an existing plan */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    pillar?: string | null;
    brief?: string | null;
    keywordHint?: string | null;
    status?: "PENDING" | "SKIPPED";
  };

  const existing = await prisma.postPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "EXECUTED") {
    return NextResponse.json({ error: "Cannot edit an executed plan" }, { status: 400 });
  }

  const plan = await prisma.postPlan.update({
    where: { id },
    data: {
      ...(body.pillar !== undefined ? { pillar: body.pillar } : {}),
      ...(body.brief !== undefined ? { brief: body.brief } : {}),
      ...(body.keywordHint !== undefined ? { keywordHint: body.keywordHint } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  });

  return NextResponse.json(plan);
}

/** DELETE /api/planner/plans/[id] — remove a plan (revert slot to unplanned) */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await prisma.postPlan.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
