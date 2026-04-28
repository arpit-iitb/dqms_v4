import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";

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
    include: { _count: { select: { orders: true } } },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, contactPerson, contactPhone, address, gstin } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
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
    },
  });

  return NextResponse.json({ client }, { status: 201 });
}
