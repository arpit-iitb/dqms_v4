import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PRE_SALES_STATUSES = [
  "LEAD", "QUOTATION_IN_PROGRESS", "RFQ_SENT", "QUOTED", "CLIENT_PROPOSAL_SENT",
];
const PRODUCTION_STATUSES = [
  "ORDER_CONFIRMED", "IN_PRODUCTION", "INSPECTION", "READY_FOR_DISPATCH",
];

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openLeads, activeOrders, overdueOrders, completedThisMonth,
    pendingClientQuotes, recentLeadRows, recentOrderRows,
  ] = await Promise.all([
      prisma.order.count({ where: { status: { in: PRE_SALES_STATUSES as any[] } } }),
      prisma.order.count({ where: { status: { in: PRODUCTION_STATUSES as any[] } } }),
      prisma.order.count({
        where: { status: { in: PRODUCTION_STATUSES as any[] }, deliveryDate: { lt: now } },
      }),
      prisma.order.count({ where: { status: "COMPLETED", updatedAt: { gte: startOfMonth } } }),
      prisma.clientQuote.count({ where: { status: "SENT" } }),
      prisma.order.findMany({
        where: { status: { in: PRE_SALES_STATUSES as any[] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      prisma.order.findMany({
        where: { status: { in: PRODUCTION_STATUSES as any[] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          client: { select: { name: true } },
          parts: { select: { state: true } },
        },
      }),
    ]);

  return NextResponse.json({
    stats: {
      openLeads,
      activeOrders,
      overdueOrders,
      completedThisMonth,
      pendingClientQuotes,
      recentLeads: recentLeadRows.map((o) => ({
        id: o.id,
        displayId: o.displayId,
        clientName: o.client.name,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      recentOrders: recentOrderRows.map((o) => ({
        id: o.id,
        displayId: o.displayId,
        clientName: o.client.name,
        status: o.status,
        deliveryDate: o.deliveryDate?.toISOString() ?? null,
        updatedAt: o.updatedAt.toISOString(),
        partCount: o.parts.length,
        completedParts: o.parts.filter((p) => ["COMPLETED", "SHIPPED", "CLOSED"].includes(p.state)).length,
      })),
    },
  });
}
