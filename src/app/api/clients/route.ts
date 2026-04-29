import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";
import { isConfigured, zohoPost } from "@/lib/zoho";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const clients = await prisma.client.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { leads: true, salesOrders: true } } },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, contactPerson, contactPhone, address, gstin, createInZoho } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  let zohoContactId: string | null = null;

  if (createInZoho && isConfigured()) {
    try {
      const zohoData = await zohoPost<{ contact: { contact_id: string } }>("/contacts", {
        contact_name: name,
        email,
        company_name: name,
        contact_type: "customer",
      });
      zohoContactId = zohoData.contact.contact_id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Zoho API error";
      return NextResponse.json({ error: `Failed to create Zoho contact: ${message}` }, { status: 502 });
    }
  }

  const count = await prisma.client.count();
  const client = await prisma.client.create({
    data: {
      publicId: `C-${String(count + 1).padStart(4, "0")}`,
      name,
      email,
      contactPerson: contactPerson || null,
      contactPhone: contactPhone || null,
      address: address || null,
      gstin: gstin || null,
      ...(zohoContactId ? { zohoContactId } : {}),
    },
  });

  return NextResponse.json({ client }, { status: 201 });
}
