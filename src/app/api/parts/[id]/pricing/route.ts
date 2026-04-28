import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/parts/[id]/pricing — get existing pricing model
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pricing = await prisma.pricingModel.findUnique({
    where: { partId: id },
    include: { clientQuote: true },
  });
  return NextResponse.json({ pricing: pricing ?? null });
}

// POST /api/parts/[id]/pricing — create or update pricing model
// Body: { groupedPartQuoteId, vendorName, unitPriceUsd, leadTimeDays, marginPercent }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { groupedPartQuoteId, vendorName, unitPriceUsd, leadTimeDays, marginPercent } = await req.json();

  if (unitPriceUsd == null || marginPercent == null) {
    return NextResponse.json({ error: "unitPriceUsd and marginPercent required" }, { status: 400 });
  }

  const part = await prisma.part.findUnique({ where: { id }, select: { quantity: true } });
  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });

  const qty = part.quantity ?? 1;
  const clientUnitPrice = parseFloat((unitPriceUsd * (1 + marginPercent / 100)).toFixed(2));
  const totalPrice = parseFloat((clientUnitPrice * qty).toFixed(2));

  const existing = await prisma.pricingModel.findUnique({ where: { partId: id } });
  if (existing?.locked) {
    return NextResponse.json({ error: "Pricing is locked and cannot be modified" }, { status: 409 });
  }

  const data = {
    selectedGroupedQuoteId: groupedPartQuoteId ?? null,
    selectedVendorName: vendorName ?? null,
    selectedLeadTimeDays: leadTimeDays ?? null,
    vendorUnitPriceUsd: unitPriceUsd,
    marginPercent,
    clientUnitPriceUsd: clientUnitPrice,
    quantity: qty,
    totalPriceUsd: totalPrice,
  };

  const pricing = existing
    ? await prisma.pricingModel.update({
        where: { partId: id },
        data,
        include: { clientQuote: true },
      })
    : await prisma.pricingModel.create({
        data: { partId: id, ...data },
        include: { clientQuote: true },
      });

  return NextResponse.json({ pricing });
}
