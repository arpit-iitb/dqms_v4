import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PRE_SALES_STATUSES = [
  "LEAD", "QUOTATION_IN_PROGRESS", "RFQ_SENT", "QUOTED", "CLIENT_PROPOSAL_SENT",
] as const;
const PRODUCTION_STATUSES = [
  "ORDER_CONFIRMED", "IN_PRODUCTION", "INSPECTION", "READY_FOR_DISPATCH",
] as const;

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openLeads, activeOrders, overdueOrders, completedThisMonth,
    wonLeadsThisMonth, totalLeadsThisMonth,
    pendingClientQuotes, recentLeadRows, recentOrderRows,
  ] = await Promise.all([
      prisma.lead.count({ where: { status: { in: [...PRE_SALES_STATUSES] } } }),
      prisma.salesOrder.count({ where: { status: { in: [...PRODUCTION_STATUSES] } } }),
      prisma.salesOrder.count({
        where: { status: { in: [...PRODUCTION_STATUSES] }, deliveryDate: { lt: now } },
      }),
      prisma.salesOrder.count({ where: { status: "COMPLETED", updatedAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { status: "WON", updatedAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.clientQuote.count({ where: { status: "SENT" } }),
      prisma.lead.findMany({
        where: { status: { in: [...PRE_SALES_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
      prisma.salesOrder.findMany({
        where: { status: { in: [...PRODUCTION_STATUSES] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          client: { select: { name: true } },
          parts: { select: { state: true } },
        },
      }),
    ]);

  const conversionRate = totalLeadsThisMonth > 0
    ? Math.round((wonLeadsThisMonth / totalLeadsThisMonth) * 100)
    : 0;

  return NextResponse.json({
    stats: {
      openLeads,
      activeOrders,
      overdueOrders,
      completedThisMonth,
      wonLeadsThisMonth,
      conversionRate,
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
