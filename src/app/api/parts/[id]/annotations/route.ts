import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/parts/[id]/annotations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const annotations = await prisma.annotation.findMany({
    where: { partId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ annotations });
}

// POST /api/parts/[id]/annotations
// Body: { type: "MASK" | "NOTE" | "CRITICAL_DIM", coordinates: { x, y, w, h, page }, content? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { type, coordinates, content } = await req.json();

  if (!type || !coordinates) {
    return NextResponse.json({ error: "type and coordinates required" }, { status: 400 });
  }

  const annotation = await prisma.annotation.create({
    data: {
      partId: id,
      type,
      coordinates,
      content: content ?? null,
    },
  });

  return NextResponse.json({ annotation }, { status: 201 });
}
