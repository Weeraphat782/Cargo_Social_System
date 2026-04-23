import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import LogsClient, { type LogRow } from "./logs-client";

export default async function LogsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const raw = await prisma.publishLog.findMany({
    orderBy: { attemptAt: "desc" },
    take: 30,
    select: {
      id: true,
      postId: true,
      platform: true,
      attemptAt: true,
      success: true,
      remoteId: true,
      errorMessage: true,
      post: {
        select: {
          id: true,
          status: true,
          topic: { select: { name: true } },
        },
      },
    },
  });

  const initialLogs: LogRow[] = raw.map((l) => ({
    ...l,
    attemptAt: l.attemptAt.toISOString(),
  }));

  return <LogsClient initialLogs={initialLogs} />;
}
