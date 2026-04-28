import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const activeOnly = searchParams.get("active") !== "false";

  const vendors = await prisma.vendor.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { vendorCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, contactPerson, contactPhone, specialization, gstin } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Generate vendor code: V + 4-digit counter
  const count = await prisma.vendor.count();
  const vendorCode = `V${String(count + 1).padStart(4, "0")}`;

  const vendor = await prisma.vendor.create({
    data: {
      publicId: generatePublicId("V"),
      vendorCode,
      name,
      email,
      contactPerson: contactPerson || null,
      contactPhone: contactPhone || null,
      specialization: specialization || null,
      gstin: gstin || null,
    },
  });

  return NextResponse.json({ vendor }, { status: 201 });
}
