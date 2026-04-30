import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";
import { isConfigured, zohoGet, zohoPost } from "@/lib/zoho";

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

  // Zoho sync action
  if (body.action === "sync-zoho") {
    if (!isConfigured()) {
      return NextResponse.json({ error: "Zoho not configured" }, { status: 503 });
    }
    try {
      const data = await zohoGet<{ contacts: Array<{ contact_id: string; contact_name: string; email: string; phone?: string; company_name?: string }> }>(
        "/contacts",
        { contact_type: "customer", per_page: "200" }
      );
      const zohoContacts = data.contacts || [];
      let created = 0;
      let updated = 0;

      for (const zc of zohoContacts) {
        if (!zc.email) continue;
        // Check if already linked by zohoContactId
        const existingByZoho = await prisma.client.findUnique({ where: { zohoContactId: zc.contact_id } });
        if (existingByZoho) continue; // already synced

        // Check if exists by email
        const existingByEmail = await prisma.client.findUnique({ where: { email: zc.email } });
        if (existingByEmail) {
          if (!existingByEmail.zohoContactId) {
            await prisma.client.update({
              where: { id: existingByEmail.id },
              data: { zohoContactId: zc.contact_id },
            });
            updated++;
          }
          continue;
        }

        // Create new local client
        const count = await prisma.client.count();
        await prisma.client.create({
          data: {
            publicId: `C-${String(count + 1).padStart(4, "0")}`,
            name: zc.contact_name,
            email: zc.email,
            contactPerson: zc.contact_name,
            contactPhone: zc.phone || null,
            zohoContactId: zc.contact_id,
          },
        });
        created++;
      }

      return NextResponse.json({ synced: created, updated, total: zohoContacts.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Zoho API error";
      return NextResponse.json({ error: `Zoho sync failed: ${message}` }, { status: 502 });
    }
  }

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
