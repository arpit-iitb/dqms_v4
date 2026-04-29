import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/orders/[id]/rfq — list GroupedRFQs whose parts belong to this sales order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Find GroupedRFQs that contain at least one part linked to this sales order
  const rfqs = await prisma.groupedRFQ.findMany({
    where: {
      parts: {
        some: {
          part: { salesOrderId: id },
        },
      },
    },
    include: {
      vendors: { include: { vendor: true } },
      parts: { include: { part: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rfqs });
}

// POST /api/orders/[id]/rfq — RFQs are created from leads, not sales orders
export async function POST() {
  return NextResponse.json(
    { error: "RFQs must be created from the lead, not from a sales order" },
    { status: 405 },
  );
}
