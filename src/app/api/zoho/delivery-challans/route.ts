import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet, zohoPost } from "@/lib/zoho";
import type { ZohoDeliveryChallan } from "@/lib/zoho-types";

export const dynamic = "force-dynamic";

interface ZohoDeliveryChallansResponse {
  deliverychallans: ZohoDeliveryChallan[];
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

    const salesorderId = searchParams.get("salesorder_id");
    if (salesorderId) params.salesorder_id = salesorderId;

    const data = await zohoGet<ZohoDeliveryChallansResponse>("/deliverychallans", params);
    return NextResponse.json(data.deliverychallans || []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch delivery challans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateDCBody {
  customer_id: string;
  salesorder_id?: string;
  reference_number?: string;
  challan_type?: string;
  line_items: {
    item_id: string;
    name?: string;
    description?: string;
    rate: number;
    quantity: number;
    tax_id?: string;
    hsn_or_sac?: string;
  }[];
}

interface ZohoCreateDCResponse {
  deliverychallan: {
    deliverychallan_id: string;
    deliverychallan_number: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: "Zoho not configured" }, { status: 503 });
    }

    const body = (await request.json()) as CreateDCBody;

    if (!body.customer_id || !body.line_items?.length) {
      return NextResponse.json(
        { error: "customer_id and line_items are required" },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      customer_id: body.customer_id,
      line_items: body.line_items.map((item) => {
        const li: Record<string, unknown> = {
          item_id: item.item_id,
          rate: item.rate,
          quantity: item.quantity,
        };
        if (item.name) li.name = item.name;
        if (item.description) li.description = item.description;
        if (item.tax_id) li.tax_id = item.tax_id;
        if (item.hsn_or_sac) li.hsn_or_sac = item.hsn_or_sac;
        return li;
      }),
    };
    if (body.challan_type) payload.challan_type = body.challan_type;
    if (body.salesorder_id) payload.salesorder_id = body.salesorder_id;
    if (body.reference_number) payload.reference_number = body.reference_number;

    const data = await zohoPost<ZohoCreateDCResponse>("/deliverychallans", payload);

    return NextResponse.json({
      deliveryChallanId: data.deliverychallan.deliverychallan_id,
      deliveryChallanNumber: data.deliverychallan.deliverychallan_number,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create delivery challan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
