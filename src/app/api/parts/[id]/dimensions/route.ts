import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/parts/[id]/dimensions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dimensions = await prisma.dimension.findMany({
    where: { partId: id },
    orderBy: { dimOrder: "asc" },
  });
  return NextResponse.json({ dimensions });
}

// POST /api/parts/[id]/dimensions — add a dimension
// Body: { name, rawText }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, rawText } = await req.json();
  if (!name || !rawText) {
    return NextResponse.json({ error: "name and rawText required" }, { status: 400 });
  }
  const count = await prisma.dimension.count({ where: { partId: id } });
  const dimension = await prisma.dimension.create({
    data: {
      partId: id,
      name,
      rawText,
      page: 1,
      rectX: 0, rectY: 0, rectW: 0, rectH: 0,
      dimOrder: count,
    },
  });
  return NextResponse.json({ dimension }, { status: 201 });
}
