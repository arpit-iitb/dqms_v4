import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/parts/[id]/quotes — all vendor quotes received for this part across all grouped RFQs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rfqParts = await prisma.groupedRFQPart.findMany({
    where: { partId: id },
    include: {
      groupedRfq: { select: { id: true, publicId: true, status: true, dueDate: true } },
      partQuotes: {
        include: {
          groupedRfqVendor: {
            include: { vendor: { select: { id: true, name: true, vendorCode: true } } },
          },
        },
      },
    },
  });

  // Flatten into a list of quotes with vendor info
  const quotes = rfqParts.flatMap((rfqPart) =>
    rfqPart.partQuotes
      .filter((q) => q.unitPriceUsd != null)
      .map((q) => ({
        id: q.id,
        rfqId: rfqPart.groupedRfqId,
        rfqPublicId: rfqPart.groupedRfq.publicId,
        vendorId: q.groupedRfqVendor.vendor.id,
        vendorName: q.groupedRfqVendor.vendor.name,
        vendorCode: q.groupedRfqVendor.vendor.vendorCode,
        unitPriceUsd: q.unitPriceUsd,
        leadTimeDays: q.leadTimeDays,
        notes: q.notes,
        submittedAt: q.groupedRfqVendor.submittedAt,
      }))
  );

  return NextResponse.json({ quotes });
}
