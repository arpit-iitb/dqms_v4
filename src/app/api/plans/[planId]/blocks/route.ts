import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { type, processName, stepData, blockOrder, notes, vendorId, deadline } = body;

  const block = await prisma.planBlock.create({
    data: {
      planId,
      type,
      processName: processName ?? null,
      stepData: stepData ?? undefined,
      blockOrder: blockOrder ?? 1,
      status: "PENDING",
      notes: notes ?? null,
      vendorId: vendorId ?? null,
      deadline: deadline ? new Date(deadline) : null,
    },
    include: { vendor: true },
  });

  // Update plan totals
  await recalcPlanTotals(planId);

  return NextResponse.json({ block }, { status: 201 });
}

export async function recalcPlanTotals(planId: string) {
  const blocks = await prisma.planBlock.findMany({ where: { planId } });
  await prisma.manufacturingPlan.update({
    where: { id: planId },
    data: {
      totalBlocks: blocks.length,
      completedBlocks: blocks.filter((b) => b.status === "DONE").length,
    },
  });
}
