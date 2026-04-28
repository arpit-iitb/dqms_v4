import { NextRequest, NextResponse } from "next/server";
import { isConfigured, zohoGet } from "@/lib/zoho";
import type { ZohoVendor } from "@/lib/zoho-types";

export const dynamic = "force-dynamic";

interface ZohoContactPersonRaw {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface ZohoContactRaw {
  contact_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  mobile: string;
  status: string;
  contact_persons?: ZohoContactPersonRaw[];
}

interface ZohoContactsResponse {
  contacts: ZohoContactRaw[];
}

function mapContact(c: ZohoContactRaw): ZohoVendor {
  const cp = c.contact_persons?.[0];
  return {
    id: c.contact_id,
    contactName: c.contact_name,
    companyName: c.company_name || undefined,
    email: c.email || undefined,
    phone: c.phone || c.mobile || undefined,
    contactPerson: cp ? `${cp.first_name} ${cp.last_name}`.trim() : undefined,
    status: c.status || "active",
    source: "zoho",
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
    const params: Record<string, string> = {
      contact_type: "vendor",
    };

    const searchText = searchParams.get("search_text");
    if (searchText) params.search_text = searchText;

    const data = await zohoGet<ZohoContactsResponse>("/contacts", params);
    const vendors = (data.contacts || []).map(mapContact);

    return NextResponse.json(vendors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Zoho vendors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
