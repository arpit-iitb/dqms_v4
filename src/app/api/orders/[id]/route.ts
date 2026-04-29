import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      client: true,
      lead: { select: { id: true, displayId: true } },
      parts: { orderBy: { createdAt: "asc" } },
      emailLogs: { orderBy: { sentAt: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const {
    status, orderDate, deliveryDate, deliveryDatePO,
    clientPoNumber, clientDcNumber, mechximizeDcNumber,
    zohoSalesOrderId, dispatchModule,
    updateSchedule, updatesDone, notes,
  } = body;

  const order = await prisma.salesOrder.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(orderDate !== undefined && { orderDate: orderDate ? new Date(orderDate) : null }),
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
      ...(deliveryDatePO !== undefined && { deliveryDatePO: deliveryDatePO ? new Date(deliveryDatePO) : null }),
      ...(clientPoNumber !== undefined && { clientPoNumber }),
      ...(clientDcNumber !== undefined && { clientDcNumber }),
      ...(mechximizeDcNumber !== undefined && { mechximizeDcNumber }),
      ...(zohoSalesOrderId !== undefined && { zohoSalesOrderId }),
      ...(dispatchModule !== undefined && { dispatchModule }),
      ...(updateSchedule !== undefined && { updateSchedule }),
      ...(updatesDone !== undefined && { updatesDone }),
      ...(notes !== undefined && { notes }),
    },
    include: { client: true, _count: { select: { parts: true } } },
  });

  return NextResponse.json({ order });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.salesOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
