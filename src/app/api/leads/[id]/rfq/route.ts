import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rfqs = await prisma.groupedRFQ.findMany({
    where: { leadId: id },
    include: {
      vendors: { include: { vendor: true } },
      parts: { include: { part: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rfqs });
}

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
      leadId: id,
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

  // Update lead status to RFQ_SENT if still in earlier stage
  const lead = await prisma.lead.findUnique({ where: { id }, select: { status: true } });
  const earlyStatuses = ["LEAD", "QUOTATION_IN_PROGRESS"];
  if (lead && earlyStatuses.includes(lead.status)) {
    await prisma.lead.update({ where: { id }, data: { status: "RFQ_SENT" } });
  }

  return NextResponse.json({ rfq }, { status: 201 });
}
