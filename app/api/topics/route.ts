import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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
  };

  if (!body.name || !body.keywords) {
    return NextResponse.json({ error: "name and keywords required" }, { status: 400 });
  }

  const t = await prisma.topic.create({
    data: {
      name: body.name,
      keywords: body.keywords,
      brandVoice: body.brandVoice,
      active: body.active ?? true,
    },
  });

  return NextResponse.json(t);
}
