import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personas = await prisma.persona.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, role: true, description: true, createdAt: true },
  });
  return NextResponse.json({ personas });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name: string;
    role?: string;
    demographics?: string;
    painPoints?: string;
    goals?: string;
    description: string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!body.description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });

  const persona = await prisma.persona.create({
    data: {
      name: body.name.trim(),
      role: body.role?.trim() || null,
      demographics: body.demographics?.trim() || null,
      painPoints: body.painPoints?.trim() || null,
      goals: body.goals?.trim() || null,
      description: body.description.trim(),
    },
  });
  return NextResponse.json(persona);
}
