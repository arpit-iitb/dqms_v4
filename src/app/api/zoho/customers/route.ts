import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet } from "@/lib/zoho";

export const dynamic = "force-dynamic";

interface ZohoContactRaw {
  contact_id: string;
  contact_name: string;
  email: string;
  status: string;
}

interface ZohoContactsResponse {
  contacts: ZohoContactRaw[];
}

export async function GET(request: NextRequest) {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ error: "Zoho Books is not configured" }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const params: Record<string, string> = { contact_type: "customer" };

    const searchText = searchParams.get("search_text");
    if (searchText) params.search_text = searchText;

    const data = await zohoGet<ZohoContactsResponse>("/contacts", params);
    const customers = (data.contacts || []).map((c: ZohoContactRaw) => ({
      id: c.contact_id,
      name: c.contact_name,
      email: c.email || "",
      status: c.status || "active",
    }));

    return NextResponse.json(customers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
