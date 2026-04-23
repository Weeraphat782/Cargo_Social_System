import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PostStatus } from "@prisma/client";
import { fetchPostsByStatuses } from "@/lib/post-list-payload";
import QueueClient from "./queue-client";

const PUBLISHED_FEED_MAX = 30;

export default async function QueuePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [initialPending, initialPublishedAll] = await Promise.all([
    fetchPostsByStatuses(
      [PostStatus.PENDING_APPROVAL, PostStatus.APPROVED, PostStatus.SCHEDULED],
      50
    ),
    fetchPostsByStatuses([PostStatus.PUBLISHED], 50),
  ]);
  const initialPublished = initialPublishedAll.slice(0, PUBLISHED_FEED_MAX);

  return (
    <QueueClient initialPending={initialPending} initialPublished={initialPublished} />
  );
}
