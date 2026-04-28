import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/plans/[planId]/blocks/[blockId]/dimensions — get block dimension measurements
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; blockId: string }> }
) {
  const { blockId } = await params;
  const blockDimensions = await prisma.blockDimension.findMany({
    where: { blockId },
    include: { dimension: true },
    orderBy: { dimension: { dimOrder: "asc" } },
  });
  return NextResponse.json({ blockDimensions });
}

// POST /api/plans/[planId]/blocks/[blockId]/dimensions — upsert a measurement
// Body: { dimensionId, measuredValue, result }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; blockId: string }> }
) {
  const { blockId } = await params;
  const { dimensionId, measuredValue, result } = await req.json();

  if (!dimensionId) {
    return NextResponse.json({ error: "dimensionId required" }, { status: 400 });
  }

  const blockDimension = await prisma.blockDimension.upsert({
    where: { blockId_dimensionId: { blockId, dimensionId } },
    update: {
      measuredValue: measuredValue ?? null,
      result: result ?? null,
    },
    create: {
      blockId,
      dimensionId,
      measuredValue: measuredValue ?? null,
      result: result ?? null,
    },
    include: { dimension: true },
  });

  return NextResponse.json({ blockDimension });
}
