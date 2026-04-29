import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isConfigured, zohoGet, zohoPost } from "@/lib/zoho";

// POST /api/leads/[id]/convert-to-zoho-salesorder
// Converts a Zoho Estimate (linked to the lead) into a Zoho Sales Order.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Zoho Books is not configured" },
      { status: 503 }
    );
  }

  // 1. Find the lead and its zohoQuotationId
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      displayId: true,
      zohoQuotationId: true,
      salesOrderId: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // 2. If no zohoQuotationId, return error
  if (!lead.zohoQuotationId) {
    return NextResponse.json(
      { error: "Lead does not have a linked Zoho Estimate. Generate one first." },
      { status: 400 }
    );
  }

  // 4. Fetch the estimate details from Zoho
  let estimate: {
    estimate_id: string;
    customer_id: string;
    customer_name: string;
    line_items: Array<{
      item_id?: string;
      name: string;
      description?: string;
      quantity: number;
      rate: number;
      tax_id?: string;
      hsn_or_sac?: string;
    }>;
  };

  try {
    const data = await zohoGet<{ estimate: typeof estimate }>(
      `/estimates/${lead.zohoQuotationId}`
    );
    estimate = data.estimate;
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to fetch Zoho Estimate: ${err.message}` },
      { status: 502 }
    );
  }

  // 5. Create a Zoho Sales Order using the estimate's customer and line items
  const soPayload: Record<string, unknown> = {
    customer_id: estimate.customer_id,
    date: new Date().toISOString().slice(0, 10),
    reference_number: lead.displayId,
    line_items: estimate.line_items.map((li) => ({
      ...(li.item_id ? { item_id: li.item_id } : {}),
      name: li.name,
      description: li.description || "",
      quantity: li.quantity,
      rate: li.rate,
      ...(li.tax_id ? { tax_id: li.tax_id } : {}),
      ...(li.hsn_or_sac ? { hsn_or_sac: li.hsn_or_sac } : {}),
    })),
  };

  let salesOrder: {
    salesorder_id: string;
    salesorder_number: string;
    status: string;
    total: number;
  };

  try {
    const data = await zohoPost<{ salesorder: typeof salesOrder }>(
      "/salesorders",
      soPayload
    );
    salesOrder = data.salesorder;
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to create Zoho Sales Order: ${err.message}` },
      { status: 502 }
    );
  }

  // 6. If the lead has been converted to a SalesOrder, update the SO's zohoSalesOrderId
  if (lead.salesOrderId) {
    await prisma.salesOrder.update({
      where: { id: lead.salesOrderId },
      data: { zohoSalesOrderId: salesOrder.salesorder_id },
    });
  }

  // 7. Return the new Zoho sales order ID
  return NextResponse.json({
    zohoSalesOrderId: salesOrder.salesorder_id,
    zohoSalesOrderNumber: salesOrder.salesorder_number,
    status: salesOrder.status,
    total: salesOrder.total,
  });
}
