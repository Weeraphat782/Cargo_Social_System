import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBrandTemplatesForApi } from "@/lib/brands/registry";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brands = await listBrandTemplatesForApi();
  return NextResponse.json({ brands });
}
