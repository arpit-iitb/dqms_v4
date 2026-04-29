import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      client: true,
      salesOrder: { select: { id: true, displayId: true, status: true } },
      parts: {
        orderBy: { createdAt: "asc" },
        include: {
          pricingModel: { select: { locked: true, clientUnitPriceUsd: true, totalPriceUsd: true } },
          files: { where: { isLatest: true }, select: { id: true, fileType: true, fileName: true } },
        },
      },
      emailLogs: { orderBy: { sentAt: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const {
    status, orderDate, deliveryDate,
    zohoQuotationId, notes,
  } = body;

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(orderDate !== undefined && { orderDate: orderDate ? new Date(orderDate) : null }),
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
      ...(zohoQuotationId !== undefined && { zohoQuotationId }),
      ...(notes !== undefined && { notes }),
    },
    include: { client: true, _count: { select: { parts: true } } },
  });

  return NextResponse.json({ lead });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
