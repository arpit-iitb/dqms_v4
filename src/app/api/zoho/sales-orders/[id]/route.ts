import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet } from "@/lib/zoho";
import type { ZohoSalesOrderDetail, ZohoDocLineItem } from "@/lib/zoho-types";

export const dynamic = "force-dynamic";

interface ZohoLineItemRaw {
  line_item_id: string;
  item_id: string;
  name: string;
  sku?: string;
  description?: string;
  rate: number;
  quantity: number;
  discount?: number;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  hsn_or_sac?: string;
  item_total?: number;
}

interface ZohoSalesOrderResponse {
  salesorder: {
    salesorder_id: string;
    salesorder_number: string;
    customer_id: string;
    customer_name: string;
    date: string;
    reference_number?: string;
    line_items: ZohoLineItemRaw[];
  };
}

function mapLineItem(item: ZohoLineItemRaw): ZohoDocLineItem {
  return {
    lineItemId: item.line_item_id,
    itemId: item.item_id,
    name: item.name,
    sku: item.sku || "",
    description: item.description || "",
    rate: item.rate,
    quantity: item.quantity,
    discount: item.discount || 0,
    taxId: item.tax_id || "",
    taxName: item.tax_name || "",
    taxPercentage: item.tax_percentage || 0,
    hsnOrSac: item.hsn_or_sac || "",
    itemTotal: item.item_total || item.rate * item.quantity,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isConfigured()) {
      return NextResponse.json({ error: "Zoho not configured" }, { status: 503 });
    }

    const data = await zohoGet<ZohoSalesOrderResponse>(`/salesorders/${id}`);
    const so = data.salesorder;

    const result: ZohoSalesOrderDetail = {
      salesorderId: so.salesorder_id,
      salesorderNumber: so.salesorder_number,
      customerId: so.customer_id,
      customerName: so.customer_name,
      date: so.date,
      referenceNumber: so.reference_number || "",
      lineItems: (so.line_items || []).map(mapLineItem),
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
