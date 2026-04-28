import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET /api/orders/[id]/rfq — list GroupedRFQs for this order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rfqs = await prisma.groupedRFQ.findMany({
    where: { orderId: id },
    include: {
      vendors: { include: { vendor: true } },
      parts: { include: { part: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rfqs });
}

// POST /api/orders/[id]/rfq — create a new GroupedRFQ
// Body: { partIds: string[], vendorIds: string[], dueDate: string, coverNote?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { partIds, vendorIds, dueDate, coverNote } = body;

  if (!partIds?.length) return NextResponse.json({ error: "partIds required" }, { status: 400 });
  if (!vendorIds?.length) return NextResponse.json({ error: "vendorIds required" }, { status: 400 });
  if (!dueDate) return NextResponse.json({ error: "dueDate required" }, { status: 400 });

  const rfq = await prisma.groupedRFQ.create({
    data: {
      publicId: generatePublicId("RFQ"),
      orderId: id,
      dueDate: new Date(dueDate),
      coverNote: coverNote || null,
      parts: {
        create: partIds.map((partId: string) => ({ partId })),
      },
      vendors: {
        create: vendorIds.map((vendorId: string) => ({
          vendorId,
          accessToken: crypto.randomBytes(24).toString("hex"),
        })),
      },
    },
    include: {
      vendors: { include: { vendor: true } },
      parts: { include: { part: true } },
    },
  });

  // Update order status to RFQ_SENT if still in earlier stage
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  const preSalesUpgrade = ["LEAD", "QUOTATION_IN_PROGRESS"];
  if (order && preSalesUpgrade.includes(order.status)) {
    await prisma.order.update({ where: { id }, data: { status: "RFQ_SENT" } });
  }

  return NextResponse.json({ rfq }, { status: 201 });
}
