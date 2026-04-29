import { NextResponse } from "next/server";
import { isConfigured, zohoGet } from "@/lib/zoho";

export const dynamic = "force-dynamic";

interface ZohoTax {
  tax_id: string;
  tax_name: string;
  tax_percentage: number;
  tax_type: string;
}

interface ZohoTaxesResponse {
  taxes: ZohoTax[];
}

export async function GET() {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: "Zoho Books is not configured" }, { status: 503 });
    }

    const data = await zohoGet<ZohoTaxesResponse>("/settings/taxes");
    const taxes = (data.taxes || []).map((t) => ({
      taxId: t.tax_id,
      taxName: t.tax_name,
      taxPercentage: t.tax_percentage,
      taxType: t.tax_type,
    }));

    return NextResponse.json({ taxes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch taxes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
