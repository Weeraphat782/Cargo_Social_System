import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listReferenceCategories } from "@/lib/imagegen/references";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await listReferenceCategories();
  return NextResponse.json({ categories });
}
