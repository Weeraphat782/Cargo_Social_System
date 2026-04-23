import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PostStatus } from "@prisma/client";
import { fetchPostsByStatuses } from "@/lib/post-list-payload";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const statuses = statusParam
    ? (statusParam.split(",").filter(Boolean) as PostStatus[])
    : null;

  const posts = await fetchPostsByStatuses(statuses, 50);
  return NextResponse.json(posts);
}
