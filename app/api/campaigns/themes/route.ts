import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listThemesForApi } from "@/lib/agent/themes";
import { isBrandTemplateId } from "@/lib/brands/registry";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("brandTemplateId")?.trim() || "omg";
  const brandTemplateId = (await isBrandTemplateId(raw)) ? raw : "omg";
  const themes = await listThemesForApi(brandTemplateId);
  return NextResponse.json({ themes });
}
