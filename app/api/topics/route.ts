import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isBrandTemplateId } from "@/lib/brands/registry";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topics = await prisma.topic.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(topics);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name: string;
    keywords: string;
    brandVoice?: string;
    active?: boolean;
    brandTemplateId?: string;
  };

  if (!body.name || !body.keywords) {
    return NextResponse.json({ error: "name and keywords required" }, { status: 400 });
  }
  let brandTemplateId = "omg";
  if (body.brandTemplateId != null && body.brandTemplateId !== "") {
    const tid = body.brandTemplateId.trim();
    if (!(await isBrandTemplateId(tid))) {
      return NextResponse.json({ error: "invalid brandTemplateId" }, { status: 400 });
    }
    brandTemplateId = tid;
  }

  const t = await prisma.topic.create({
    data: {
      name: body.name,
      keywords: body.keywords,
      brandVoice: body.brandVoice,
      brandTemplateId,
      active: body.active ?? true,
    },
  });

  return NextResponse.json(t);
}
