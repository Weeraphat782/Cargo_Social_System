import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import TopicsClient from "./topics-client";

export default async function TopicsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const initialTopics = await prisma.topic.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <TopicsClient initialTopics={initialTopics} />;
}
