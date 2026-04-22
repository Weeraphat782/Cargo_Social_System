import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listThemesForApi } from "@/lib/agent/themes";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ themes: listThemesForApi() });
}
