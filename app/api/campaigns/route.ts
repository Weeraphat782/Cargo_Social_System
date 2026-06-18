import { NextResponse } from "next/server";
import type {
  CampaignContentMode,
  CampaignStatus,
  CampaignCadence,
  CampaignTheme,
  Platform,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fetchCampaignsListForPage } from "@/lib/campaigns-list-payload";
import { createCampaignFromPayload } from "@/lib/campaigns/create-from-payload";
import { revalidateTag } from "next/cache";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await fetchCampaignsListForPage();
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name: string;
    description?: string | null;
    keywords?: string;
    brandVoice?: string | null;
    theme: CampaignTheme;
    contentMode?: CampaignContentMode;
    cadence: CampaignCadence;
    dayOfWeek?: number | null;
    hourOfDay?: number | null;
    timezone?: string;
    customCron?: string | null;
    platforms?: Platform[];
    postsPerRun?: number;
    imagesPerPost?: number;
    totalPostsCap?: number | null;
    autoApprove?: boolean;
    publishHourOfDay?: number | null;
    publishMinuteOfHour?: number | null;
    publishSpacingMinutes?: number | null;
    publishTimes?: string[] | null;
    startAt?: string;
    endAt?: string | null;
    status?: CampaignStatus;
    daysOfWeekMulti?: number[];
    specificDates?: string[];
    testDatetimes?: string[];
    scheduledDatetimes?: string[];
    brandTemplateId?: string;
    contentLanguage?: string;
    campaignGoal?: string | null;
    targetPersona?: string | null;
    contentPillars?: string | null;
    platformStrategies?: Record<string, string> | null;
  };

  const result = await createCampaignFromPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidateTag("campaigns");
  return NextResponse.json(result.campaign);
}
