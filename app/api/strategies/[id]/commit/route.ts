import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  createCampaignFromPayload,
  type CampaignCreateDb,
  type CreateCampaignPayload,
} from "@/lib/campaigns/create-from-payload";
import { ensureBrandTemplatesLoaded, isBrandTemplateId } from "@/lib/brands/registry";
import { revalidateTag } from "next/cache";

const INTERACTIVE_TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

function formatCommitError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.includes("Transaction not found") ||
    msg.includes("Transaction API error") ||
    /timed?\s*out/i.test(msg) ||
    /timeout/i.test(msg)
  ) {
    return "Commit took too long or the database connection was interrupted. Please try again.";
  }
  return msg;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const strategy = await prisma.marketingStrategy.findUnique({
    where: { id },
    select: {
      id: true,
      brandTemplateId: true,
      status: true,
    },
  });

  if (!strategy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (strategy.status === "COMPLETED") {
    return NextResponse.json(
      { error: "This strategy is already completed" },
      { status: 400 }
    );
  }

  if (strategy.status !== "READY_REVIEW") {
    return NextResponse.json(
      { error: "Commit is only available when analysis finished (Ready for review)" },
      { status: 400 }
    );
  }

  await ensureBrandTemplatesLoaded();
  if (!(await isBrandTemplateId(strategy.brandTemplateId))) {
    return NextResponse.json(
      { error: `Invalid brand template: ${strategy.brandTemplateId}` },
      { status: 400 }
    );
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const pending = await tx.strategyCampaignDraft.findMany({
        where: { strategyId: id, status: "PENDING" },
        orderBy: { orderIndex: "asc" },
      });

      if (pending.length === 0) {
        return { createdCount: 0 as number, campaignIds: [] as string[] };
      }

      const db = tx as unknown as CampaignCreateDb;
      const campaignIds: string[] = [];

      for (const d of pending) {
        const payload = d.payload as CreateCampaignPayload;
        const result = await createCampaignFromPayload(
          { ...payload, brandTemplateId: strategy.brandTemplateId },
          { strategyId: strategy.id },
          db
        );

        if (!result.ok) {
          throw new Error(result.error);
        }

        await tx.strategyCampaignDraft.update({
          where: { id: d.id },
          data: {
            status: "CREATED",
            createdCampaignId: result.campaign.id,
          },
        });
        campaignIds.push(result.campaign.id);
      }

      const pendingLeft = await tx.strategyCampaignDraft.count({
        where: { strategyId: id, status: "PENDING" },
      });

      if (pendingLeft === 0) {
        await tx.marketingStrategy.update({
          where: { id },
          data: { status: "COMPLETED" },
        });
      }

      return { createdCount: campaignIds.length, campaignIds };
    }, INTERACTIVE_TX_OPTIONS);

    revalidateTag("campaigns");
    return NextResponse.json(outcome);
  } catch (e) {
    console.error("[strategy commit]", e);
    return NextResponse.json({ error: formatCommitError(e) }, { status: 400 });
  }
}
