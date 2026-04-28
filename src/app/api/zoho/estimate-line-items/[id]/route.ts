import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet } from "@/lib/zoho";

export const dynamic = "force-dynamic";

interface ZohoLineItemRaw {
  line_item_id: string;
  item_id: string;
  name: string;
  sku?: string;
  description?: string;
  quantity: number;
}

interface ZohoEstimateDetailResponse {
  estimate: {
    line_items: ZohoLineItemRaw[];
  };
}

interface EstimateLineItem {
  id: string;
  partId: string;
  partName: string;
  description: string;
  qty: number;
}

function mapLineItem(item: ZohoLineItemRaw): EstimateLineItem {
  return {
    id: item.line_item_id,
    partId: item.sku || item.item_id,
    partName: item.name,
    description: item.description ?? "",
    qty: item.quantity,
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

    const data = await zohoGet<ZohoEstimateDetailResponse>(`/estimates/${id}`);
    const lineItems = (data.estimate?.line_items || []).map(mapLineItem);

    return NextResponse.json(lineItems);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch line items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
