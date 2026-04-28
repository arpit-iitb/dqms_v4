import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isConfigured, zohoPost } from "@/lib/zoho";

// GET /api/orders/[id]/zoho-estimate
// Returns parts that have locked pricing, ready for inclusion in a Zoho estimate.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parts = await prisma.part.findMany({
    where: { orderId: id, active: true },
    include: {
      pricingModel: true,
      files: {
        where: { fileType: "DRAWING_PDF", isLatest: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    parts.map((p) => ({
      id: p.id,
      publicId: p.publicId,
      partName: p.partName ?? null,
      quantity: p.quantity,
      pricingLocked: p.pricingModel?.locked ?? false,
      clientUnitPriceUsd: p.pricingModel?.clientUnitPriceUsd ?? null,
      totalPriceUsd: p.pricingModel?.totalPriceUsd ?? null,
      drawingId: (p.files[0] as any)?.clientDrawingId ?? null,
    }))
  );
}

// POST /api/orders/[id]/zoho-estimate
// Body: { customerId, partIds: string[], referenceNumber? }
// Creates a Zoho estimate with one line item per selected part, saves estimate ID to order.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isConfigured()) {
    return NextResponse.json({ error: "Zoho Books is not configured" }, { status: 503 });
  }

  const { customerId, partIds, referenceNumber } = await req.json();

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }
  if (!Array.isArray(partIds) || partIds.length === 0) {
    return NextResponse.json({ error: "partIds must be a non-empty array" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, displayId: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const parts = await prisma.part.findMany({
    where: { id: { in: partIds }, orderId: id, active: true },
    include: {
      pricingModel: true,
      files: {
        where: { fileType: "DRAWING_PDF", isLatest: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const lineItems = parts
    .filter((p) => p.pricingModel?.locked)
    .map((p) => {
      const pm = p.pricingModel!;
      const drawingId = (p.files[0] as any)?.clientDrawingId ?? null;
      return {
        name: drawingId || p.publicId,
        description: p.partName ? `${p.publicId} — ${p.partName}` : `Part ${p.publicId}`,
        quantity: pm.quantity,
        rate: Number(pm.clientUnitPriceUsd),
      };
    });

  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: "None of the selected parts have locked pricing. Lock pricing first." },
      { status: 400 }
    );
  }

  const payload = {
    customer_id: customerId,
    date: new Date().toISOString().slice(0, 10),
    reference_number: referenceNumber || order.displayId,
    line_items: lineItems,
  };

  let estimate: { estimate_id: string; estimate_number: string; status: string; total: number };
  try {
    const data = await zohoPost<{ estimate: typeof estimate }>("/estimates", payload);
    estimate = data.estimate;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Zoho API error" }, { status: 502 });
  }

  // Save estimate ID back to order
  await prisma.order.update({
    where: { id },
    data: { zohoQuotationId: estimate.estimate_id },
  });

  return NextResponse.json({
    estimateId: estimate.estimate_id,
    estimateNumber: estimate.estimate_number,
    status: estimate.status,
    total: estimate.total,
    lineItemCount: lineItems.length,
  });
}
