import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet, zohoPost } from "@/lib/zoho";
import type { ZohoSalesOrderRef } from "@/lib/zoho-types";

export const dynamic = "force-dynamic";

interface ZohoSalesOrderRaw {
  salesorder_id: string;
  salesorder_number: string;
  customer_name: string;
  date?: string;
  delivery_date?: string;
  reference_number?: string;
}

interface ZohoSalesOrdersResponse {
  salesorders: ZohoSalesOrderRaw[];
}

function mapSalesOrder(so: ZohoSalesOrderRaw): ZohoSalesOrderRef {
  return {
    id: so.salesorder_id,
    display: so.salesorder_number,
    subject: so.customer_name,
    date: so.date || undefined,
    deliveryDate: so.delivery_date || undefined,
    referenceNumber: so.reference_number || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json(
        { error: "Zoho Books is not configured" },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const params: Record<string, string> = {};

    const searchText = searchParams.get("search_text");
    if (searchText) params.search_text = searchText;

    const data = await zohoGet<ZohoSalesOrdersResponse>("/salesorders", params);
    const salesOrders: ZohoSalesOrderRef[] = (data.salesorders || []).map(mapSalesOrder);

    return NextResponse.json(salesOrders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json(
        { error: "Zoho Books is not configured. Set environment variables to enable." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const data = await zohoPost<{ salesorder: ZohoSalesOrderRaw }>("/salesorders", body);
    const salesOrder = mapSalesOrder(data.salesorder);

    return NextResponse.json(salesOrder, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sales order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
