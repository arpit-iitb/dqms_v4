import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSalesOrderDisplayId, generatePublicId } from "@/lib/id-generator";
import { buildUpdateSchedule } from "@/lib/order-utils";

// POST /api/leads/[id]/convert — Convert a lead to a sales order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { deliveryDate: bodyDeliveryDate, deliveryDatePO, clientPoNumber } = body;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { client: true, _count: { select: { parts: true } } },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.salesOrderId) {
    return NextResponse.json({ error: "Lead already converted", salesOrderId: lead.salesOrderId }, { status: 409 });
  }

  const convertibleStatuses = ["CLIENT_PROPOSAL_SENT", "QUOTED", "WON"];
  if (!convertibleStatuses.includes(lead.status)) {
    return NextResponse.json(
      { error: `Cannot convert lead with status "${lead.status}". Must be Quoted, Proposal Sent, or Won.` },
      { status: 400 }
    );
  }

  // Fall back to lead's delivery date if not provided
  const deliveryDate = bodyDeliveryDate || (lead.deliveryDate ? lead.deliveryDate.toISOString() : null);

  const displayId = await generateSalesOrderDisplayId();
  const orderDate = lead.orderDate ?? new Date();

  const updateSchedule = deliveryDate
    ? buildUpdateSchedule(orderDate.toISOString(), deliveryDate)
    : [];

  const result = await prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.create({
      data: {
        publicId: generatePublicId("SO"),
        displayId,
        clientId: lead.clientId,
        status: "ORDER_CONFIRMED",
        orderDate,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        deliveryDatePO: deliveryDatePO ? new Date(deliveryDatePO) : null,
        clientPoNumber: clientPoNumber || null,
        notes: lead.notes,
        updateSchedule,
        updatesDone: updateSchedule.map(() => false),
      },
    });

    // Link parts to sales order
    await tx.part.updateMany({
      where: { leadId: lead.id },
      data: { salesOrderId: so.id },
    });

    // Mark lead as WON and link to SO
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "WON", salesOrderId: so.id },
    });

    return so;
  });

  return NextResponse.json({ salesOrder: result }, { status: 201 });
}
