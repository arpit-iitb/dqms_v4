import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/vendor-portal/[token] — fetch RFQ data for vendor portal (no auth required)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const vendorRfq = await prisma.groupedRFQVendor.findUnique({
    where: { accessToken: token },
    include: {
      vendor: true,
      groupedRfq: {
        include: {
          lead: { select: { displayId: true } },
          parts: {
            include: {
              part: {
                select: {
                  id: true, publicId: true, partName: true,
                  materialName: true, quantity: true,
                },
              },
              partQuotes: {
                where: { vendorRfqId: undefined }, // resolved below
              },
            },
          },
        },
      },
      partQuotes: true,
    },
  });

  if (!vendorRfq) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // Mark as viewed
  if (!vendorRfq.viewedAt) {
    await prisma.groupedRFQVendor.update({
      where: { id: vendorRfq.id },
      data: { viewedAt: new Date() },
    });
  }

  // Build response — attach existing quotes per part
  const quotesByPartId: Record<string, any> = {};
  for (const q of vendorRfq.partQuotes) {
    quotesByPartId[q.groupedRfqPartId] = q;
  }

  // Check which parts have a masked (sanitized) drawing ready
  const partIds = vendorRfq.groupedRfq.parts.map((gp) => gp.part.id);
  const maskedDerivatives = await prisma.fileDerivative.findMany({
    where: {
      file: { partId: { in: partIds }, fileType: "DRAWING_PDF" },
      derivativeType: "MASKED",
      status: "READY",
    },
    include: { file: { select: { partId: true } } },
  });
  const partsWithDrawing = new Set(maskedDerivatives.map((d) => d.file.partId));

  // Check which parts have STEP files
  const stepFiles = await prisma.file.findMany({
    where: {
      partId: { in: partIds },
      fileType: "STEP",
      isLatest: true,
    },
    select: { id: true, partId: true },
  });
  const stepByPartId: Record<string, string> = {};
  for (const sf of stepFiles) {
    stepByPartId[sf.partId] = sf.id;
  }

  return NextResponse.json({
    rfq: {
      id: vendorRfq.groupedRfq.id,
      publicId: vendorRfq.groupedRfq.publicId,
      dueDate: vendorRfq.groupedRfq.dueDate,
      coverNote: vendorRfq.groupedRfq.coverNote,
      leadDisplayId: vendorRfq.groupedRfq.lead.displayId,
      locked: vendorRfq.groupedRfq.locked,
      status: vendorRfq.groupedRfq.status,
    },
    vendor: {
      id: vendorRfq.vendor.id,
      name: vendorRfq.vendor.name,
    },
    vendorRfqId: vendorRfq.id,
    submittedAt: vendorRfq.submittedAt,
    overallNotes: vendorRfq.overallNotes,
    parts: vendorRfq.groupedRfq.parts.map((gp) => ({
      groupedRfqPartId: gp.id,
      part: gp.part,
      existingQuote: quotesByPartId[gp.id] ?? null,
      hasDrawing: partsWithDrawing.has(gp.part.id),
      hasStep: !!stepByPartId[gp.part.id],
      stepFileId: stepByPartId[gp.part.id] ?? null,
    })),
  });
}

// POST /api/vendor-portal/[token] — vendor submits quotes
// Body: { quotes: [{groupedRfqPartId, unitPriceUsd, leadTimeDays, notes, quoteBreakdown?}], overallNotes? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const vendorRfq = await prisma.groupedRFQVendor.findUnique({
    where: { accessToken: token },
    include: { groupedRfq: true },
  });

  if (!vendorRfq) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }
  if (vendorRfq.groupedRfq.locked) {
    return NextResponse.json({ error: "This RFQ is locked and no longer accepting quotes" }, { status: 403 });
  }

  const { quotes, overallNotes } = await req.json();
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return NextResponse.json({ error: "quotes array required" }, { status: 400 });
  }

  // Upsert each part quote
  for (const q of quotes) {
    const { groupedRfqPartId, unitPriceUsd, leadTimeDays, notes, quoteBreakdown } = q;
    await prisma.groupedPartQuote.upsert({
      where: {
        groupedRfqPartId_vendorRfqId: {
          groupedRfqPartId,
          vendorRfqId: vendorRfq.id,
        },
      },
      update: {
        unitPriceUsd: unitPriceUsd ?? null,
        leadTimeDays: leadTimeDays ?? null,
        notes: notes ?? null,
        quoteBreakdown: quoteBreakdown ?? undefined,
      },
      create: {
        groupedRfqPartId,
        vendorRfqId: vendorRfq.id,
        unitPriceUsd: unitPriceUsd ?? null,
        leadTimeDays: leadTimeDays ?? null,
        notes: notes ?? null,
        quoteBreakdown: quoteBreakdown ?? undefined,
      },
    });
  }

  await prisma.groupedRFQVendor.update({
    where: { id: vendorRfq.id },
    data: {
      submittedAt: new Date(),
      overallNotes: overallNotes ?? null,
    },
  });

  // Check if all vendors have submitted — update RFQ status
  const allVendors = await prisma.groupedRFQVendor.findMany({
    where: { groupedRfqId: vendorRfq.groupedRfqId },
  });
  const allSubmitted = allVendors.every((v) => v.submittedAt !== null);
  if (allSubmitted) {
    await prisma.groupedRFQ.update({
      where: { id: vendorRfq.groupedRfqId },
      data: { status: "QUOTED" },
    });
  }

  return NextResponse.json({ ok: true });
}
