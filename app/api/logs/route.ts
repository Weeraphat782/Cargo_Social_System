import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.publishLog.findMany({
    orderBy: { attemptAt: "desc" },
    take: 100,
    include: {
      post: {
        include: { topic: true },
      },
    },
  });

  return NextResponse.json(logs);
}
