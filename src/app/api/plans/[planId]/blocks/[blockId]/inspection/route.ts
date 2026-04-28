import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/plans/[planId]/blocks/[blockId]/inspection
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; blockId: string }> }
) {
  const { blockId } = await params;
  const result = await prisma.inspectionResult.findUnique({
    where: { blockId },
    include: { photos: true },
  });
  return NextResponse.json({ result: result ?? null });
}

// POST /api/plans/[planId]/blocks/[blockId]/inspection — create or update
// Body: { inspectorType, result, notes }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; blockId: string }> }
) {
  const { blockId } = await params;
  const { inspectorType, result, notes } = await req.json();

  if (!inspectorType || !result) {
    return NextResponse.json({ error: "inspectorType and result required" }, { status: 400 });
  }

  const existing = await prisma.inspectionResult.findUnique({ where: { blockId } });

  const inspectionResult = existing
    ? await prisma.inspectionResult.update({
        where: { blockId },
        data: {
          inspectorType,
          result,
          notes: notes ?? null,
          inspectedAt: new Date(),
        },
        include: { photos: true },
      })
    : await prisma.inspectionResult.create({
        data: { blockId, inspectorType, result, notes: notes ?? null },
        include: { photos: true },
      });

  // Auto-set block status if inspection passed
  if (result === "PASS") {
    await prisma.planBlock.update({
      where: { id: blockId },
      data: { status: "DONE", completedAt: new Date() },
    });
  } else if (result === "FAIL") {
    await prisma.planBlock.update({
      where: { id: blockId },
      data: { status: "IN_PROGRESS" },
    });
  }

  return NextResponse.json({ inspectionResult });
}
