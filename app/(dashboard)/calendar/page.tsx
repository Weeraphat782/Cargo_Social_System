import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PostStatus } from "@prisma/client";
import CalendarClient from "./calendar-client";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rows = await prisma.post.findMany({
    where: { status: PostStatus.SCHEDULED },
    orderBy: { scheduledAt: "asc" },
    take: 100,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      topic: { select: { name: true } },
      variants: { select: { platform: true } },
    },
  });

  const initialPosts = rows.map((p) => ({
    ...p,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
  }));

  return <CalendarClient initialPosts={initialPosts} />;
}
