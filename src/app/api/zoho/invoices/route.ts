import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet, zohoPost } from "@/lib/zoho";
import type { ZohoInvoice } from "@/lib/zoho-types";

export const dynamic = "force-dynamic";

interface ZohoInvoicesResponse {
  invoices: ZohoInvoice[];
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

    const data = await zohoGet<ZohoInvoicesResponse>("/invoices", params);
    return NextResponse.json(data.invoices || []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateInvoiceBody {
  customer_id: string;
  estimate_id?: string;
  salesorder_id?: string;
  reference_number?: string;
  line_items: {
    item_id: string;
    name?: string;
    description?: string;
    rate: number;
    quantity: number;
    discount?: number;
    tax_id?: string;
    hsn_or_sac?: string;
  }[];
}

interface ZohoCreateInvoiceResponse {
  invoice: {
    invoice_id: string;
    invoice_number: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: "Zoho not configured" }, { status: 503 });
    }

    const body = (await request.json()) as CreateInvoiceBody;

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
        if (item.discount) li.discount = item.discount;
        if (item.tax_id) li.tax_id = item.tax_id;
        if (item.hsn_or_sac) li.hsn_or_sac = item.hsn_or_sac;
        return li;
      }),
    };
    if (body.estimate_id) payload.estimate_id = body.estimate_id;
    if (body.salesorder_id) payload.salesorder_id = body.salesorder_id;
    if (body.reference_number) payload.reference_number = body.reference_number;

    const data = await zohoPost<ZohoCreateInvoiceResponse>("/invoices", payload);

    return NextResponse.json({
      invoiceId: data.invoice.invoice_id,
      invoiceNumber: data.invoice.invoice_number,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
