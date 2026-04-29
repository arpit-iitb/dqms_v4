import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isConfigured, zohoPost } from "@/lib/zoho";

// POST /api/parts/[id]/pricing/zoho-estimate
// Body: { customerId, referenceNumber? }
// Creates a Zoho estimate for this part's locked pricing and saves the estimate ID to the lead.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isConfigured()) {
    return NextResponse.json({ error: "Zoho Books is not configured" }, { status: 503 });
  }

  const { customerId, referenceNumber } = await req.json();
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      pricingModel: true,
      lead: { select: { id: true, publicId: true, displayId: true } },
      files: {
        where: { fileType: "DRAWING_PDF", isLatest: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });
  if (!part.pricingModel) return NextResponse.json({ error: "No pricing model for this part" }, { status: 400 });
  if (!part.pricingModel.locked) return NextResponse.json({ error: "Pricing must be locked before generating a Zoho estimate" }, { status: 400 });

  const pm = part.pricingModel;
  const drawingId = (part.files[0] as any)?.clientDrawingId ?? null;
  const itemName = drawingId || part.publicId;
  const description = part.partName ? `${part.publicId} — ${part.partName}` : `Part ${part.publicId}`;

  const payload = {
    customer_id: customerId,
    date: new Date().toISOString().slice(0, 10),
    reference_number: referenceNumber || part.lead?.displayId || part.publicId,
    line_items: [
      {
        name: itemName,
        description,
        quantity: pm.quantity,
        rate: Number(pm.clientUnitPriceUsd),
      },
    ],
  };

  let estimate: { estimate_id: string; estimate_number: string; status: string; total: number };
  try {
    const data = await zohoPost<{ estimate: typeof estimate }>("/estimates", payload);
    estimate = data.estimate;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Zoho API error" }, { status: 502 });
  }

  // Save estimate ID to lead
  if (part.lead) {
    await prisma.lead.update({
      where: { id: part.lead.id },
      data: { zohoQuotationId: estimate.estimate_id },
    });
  }

  return NextResponse.json({
    estimateId: estimate.estimate_id,
    estimateNumber: estimate.estimate_number,
    status: estimate.status,
    total: estimate.total,
  });
}
