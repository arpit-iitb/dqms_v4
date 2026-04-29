import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSalesOrderDisplayId, generatePublicId } from "@/lib/id-generator";
import { buildUpdateSchedule } from "@/lib/order-utils";

const PRODUCTION_STATUSES = [
  "ORDER_CONFIRMED", "IN_PRODUCTION", "INSPECTION",
  "READY_FOR_DISPATCH", "DISPATCHED",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  const clientId = searchParams.get("client");
  const search = searchParams.get("search") ?? "";
  const statusParam = searchParams.get("status");

  const now = new Date();

  let whereStatus: any = {};
  if (statusParam) {
    whereStatus = { status: statusParam };
  } else if (filter === "overdue") {
    whereStatus = {
      status: { in: PRODUCTION_STATUSES },
      deliveryDate: { lt: now },
    };
  } else if (filter === "completed") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    whereStatus = { status: "COMPLETED", updatedAt: { gte: startOfMonth } };
  }

  const orders = await prisma.salesOrder.findMany({
    where: {
      ...whereStatus,
      ...(clientId ? { clientId } : {}),
      ...(search
        ? {
            OR: [
              { displayId: { contains: search, mode: "insensitive" } },
              { client: { name: { contains: search, mode: "insensitive" } } },
              { clientPoNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, displayId: true } },
      _count: { select: { parts: true } },
    },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    clientId, orderDate, deliveryDate, deliveryDatePO,
    clientPoNumber, notes, status,
  } = body;

  if (!clientId) {
    return NextResponse.json({ error: "Client is required" }, { status: 400 });
  }

  const displayId = await generateSalesOrderDisplayId();

  const effectiveOrderDate = orderDate ? new Date(orderDate) : new Date();
  const effectiveDeliveryDate = deliveryDate ? new Date(deliveryDate) : null;

  const updateSchedule =
    effectiveDeliveryDate
      ? buildUpdateSchedule(effectiveOrderDate.toISOString(), effectiveDeliveryDate.toISOString())
      : [];

  const order = await prisma.salesOrder.create({
    data: {
      publicId: generatePublicId("ORD"),
      displayId,
      clientId,
      status: status ?? "ORDER_CONFIRMED",
      orderDate: effectiveOrderDate,
      deliveryDate: effectiveDeliveryDate,
      deliveryDatePO: deliveryDatePO ? new Date(deliveryDatePO) : null,
      clientPoNumber: clientPoNumber || null,
      notes: notes || null,
      updateSchedule,
      updatesDone: updateSchedule.map(() => false),
    },
    include: { client: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
