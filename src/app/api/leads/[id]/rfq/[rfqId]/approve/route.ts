import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rfqId: string }> }
) {
  const { id: leadId, rfqId } = await params;
  const { selections } = await req.json();

  if (!Array.isArray(selections) || selections.length === 0) {
    return NextResponse.json(
      { error: "selections array is required" },
      { status: 400 }
    );
  }

  // Validate the RFQ exists and belongs to this lead
  const rfq = await prisma.groupedRFQ.findFirst({
    where: { id: rfqId, leadId },
    include: {
      parts: { include: { part: true } },
    },
  });

  if (!rfq) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  if (rfq.locked) {
    return NextResponse.json(
      { error: "RFQ is already locked" },
      { status: 409 }
    );
  }

  // Build all operations inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    let lockedParts = 0;
    let totalValue = 0;

    for (const sel of selections) {
      const { partId, groupedPartQuoteId, marginPercent } = sel;

      if (!partId || !groupedPartQuoteId || marginPercent == null) {
        throw new Error(
          `Invalid selection: partId, groupedPartQuoteId, and marginPercent are all required`
        );
      }

      // Get the quote to find vendor price and lead time
      const quote = await tx.groupedPartQuote.findUnique({
        where: { id: groupedPartQuoteId },
        include: {
          groupedRfqVendor: {
            include: { vendor: true },
          },
        },
      });

      if (!quote) {
        throw new Error(`GroupedPartQuote ${groupedPartQuoteId} not found`);
      }

      if (quote.unitPriceUsd == null) {
        throw new Error(
          `Quote ${groupedPartQuoteId} has no unit price`
        );
      }

      const vendorPrice = quote.unitPriceUsd;
      const leadTimeDays = quote.leadTimeDays;
      const vendorName = quote.groupedRfqVendor.vendor.name;

      // Get the part for quantity
      const part = await tx.part.findUnique({
        where: { id: partId },
        select: { quantity: true },
      });

      if (!part) {
        throw new Error(`Part ${partId} not found`);
      }

      const qty = part.quantity ?? 1;
      const clientUnitPrice = parseFloat(
        (vendorPrice * (1 + marginPercent / 100)).toFixed(2)
      );
      const totalPrice = parseFloat((clientUnitPrice * qty).toFixed(2));

      // Upsert PricingModel
      const existingPricing = await tx.pricingModel.findUnique({
        where: { partId },
      });

      if (existingPricing) {
        await tx.pricingModel.update({
          where: { partId },
          data: {
            selectedGroupedQuoteId: groupedPartQuoteId,
            selectedVendorName: vendorName,
            selectedLeadTimeDays: leadTimeDays,
            vendorUnitPriceUsd: vendorPrice,
            marginPercent,
            clientUnitPriceUsd: clientUnitPrice,
            quantity: qty,
            totalPriceUsd: totalPrice,
            locked: true,
          },
        });
      } else {
        await tx.pricingModel.create({
          data: {
            partId,
            selectedGroupedQuoteId: groupedPartQuoteId,
            selectedVendorName: vendorName,
            selectedLeadTimeDays: leadTimeDays,
            vendorUnitPriceUsd: vendorPrice,
            marginPercent,
            clientUnitPriceUsd: clientUnitPrice,
            quantity: qty,
            totalPriceUsd: totalPrice,
            locked: true,
          },
        });
      }

      // Update part state to PRICED
      await tx.part.update({
        where: { id: partId },
        data: { state: "PRICED" },
      });

      // Mark this GroupedPartQuote as selected
      await tx.groupedPartQuote.update({
        where: { id: groupedPartQuoteId },
        data: { selected: true },
      });

      lockedParts++;
      totalValue += totalPrice;
    }

    // Lock the GroupedRFQ
    await tx.groupedRFQ.update({
      where: { id: rfqId },
      data: { locked: true, status: "CLOSED" },
    });

    return { lockedParts, totalValue: parseFloat(totalValue.toFixed(2)) };
  });

  return NextResponse.json(result);
}
