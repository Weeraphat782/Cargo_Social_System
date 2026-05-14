import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const CODE_BRAND_DEFAULTS: { id: string; displayName: string }[] = [
  { id: "omg", displayName: "OMG" },
  { id: "acme", displayName: "Acme (demo)" },
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const map = new Map<string, string>();
  for (const b of CODE_BRAND_DEFAULTS) map.set(b.id, b.displayName);

  // Query DB directly — bypasses the template cache so newly-added brands always appear
  const rows = await prisma.brandTemplateMaster.findMany({
    select: { slug: true, displayName: true },
    orderBy: { slug: "asc" },
  });
  for (const row of rows) map.set(row.slug, row.displayName);

  const brands = Array.from(map.entries()).map(([id, displayName]) => ({ id, displayName }));
  return NextResponse.json({ brands });
}
