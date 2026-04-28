import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet, zohoPost } from "@/lib/zoho";
import type { ZohoQuotation } from "@/lib/zoho-types";

export const dynamic = "force-dynamic";

interface ZohoEstimateRaw {
  estimate_id: string;
  estimate_number: string;
  customer_name: string;
  total: number;
  date: string;
  status: string;
}

interface ZohoEstimatesResponse {
  estimates: ZohoEstimateRaw[];
}

interface ZohoEstimateCreateResponse {
  estimate: ZohoEstimateRaw;
}

function mapEstimateToQuotation(est: ZohoEstimateRaw): ZohoQuotation {
  return {
    id: est.estimate_id,
    quoteNumber: est.estimate_number,
    subject: est.customer_name,
    amount: est.total,
    createdDate: est.date,
    customerName: est.customer_name,
    status: est.status,
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

    const page = searchParams.get("page");
    if (page) params.page = page;

    const perPage = searchParams.get("per_page");
    if (perPage) params.per_page = perPage;

    const data = await zohoGet<ZohoEstimatesResponse>("/estimates", params);
    const quotations: ZohoQuotation[] = (data.estimates || []).map(mapEstimateToQuotation);

    return NextResponse.json(quotations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch estimates";
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
    const data = await zohoPost<ZohoEstimateCreateResponse>("/estimates", body);
    const quotation = mapEstimateToQuotation(data.estimate);

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create estimate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
