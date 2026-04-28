import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderDisplayId, generatePublicId } from "@/lib/id-generator";

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

  const PRE_SALES_STATUSES = [
    "LEAD", "QUOTATION_IN_PROGRESS", "RFQ_SENT", "QUOTED", "CLIENT_PROPOSAL_SENT",
  ];

  const pipeline = searchParams.get("pipeline");

  let whereStatus: any = {};
  if (statusParam) {
    whereStatus = { status: statusParam };
  } else if (pipeline === "pre_sales") {
    whereStatus = { status: { in: PRE_SALES_STATUSES } };
  } else if (filter === "overdue") {
    whereStatus = {
      status: { in: PRODUCTION_STATUSES },
      deliveryDate: { lt: now },
    };
  } else if (filter === "completed") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    whereStatus = { status: "COMPLETED", updatedAt: { gte: startOfMonth } };
  }

  const orders = await prisma.order.findMany({
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

  const displayId = await generateOrderDisplayId();
  const order = await prisma.order.create({
    data: {
      publicId: generatePublicId("ORD"),
      displayId,
      clientId,
      status: status ?? "ORDER_CONFIRMED",
      orderDate: orderDate ? new Date(orderDate) : new Date(),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      deliveryDatePO: deliveryDatePO ? new Date(deliveryDatePO) : null,
      clientPoNumber: clientPoNumber || null,
      notes: notes || null,
    },
    include: { client: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
