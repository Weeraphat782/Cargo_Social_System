import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { previewNextRuns } from "@/lib/campaigns/scheduler";
import type { CampaignCadence, Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    cadence: CampaignCadence;
    dayOfWeek?: number | null;
    hourOfDay?: number | null;
    timezone?: string;
    startAt?: string;
    lastRunAt?: string | null;
    customCron?: string | null;
    scheduleConfig?: Prisma.JsonValue | null;
  };

  if (!body.cadence) {
    return NextResponse.json({ error: "cadence required" }, { status: 400 });
  }

  const startAt = body.startAt ? new Date(body.startAt) : new Date();
  const lastRunAt = body.lastRunAt ? new Date(body.lastRunAt) : null;

  const dates = previewNextRuns(
    {
      cadence: body.cadence,
      dayOfWeek: body.dayOfWeek ?? 1,
      hourOfDay: body.hourOfDay ?? 9,
      timezone: (body.timezone ?? "Asia/Bangkok").trim() || "Asia/Bangkok",
      lastRunAt,
      startAt,
      customCron: body.customCron ?? null,
      scheduleConfig: body.scheduleConfig ?? null,
    },
    6
  );

  return NextResponse.json({ dates: dates.map((d) => d.toISOString()) });
}
