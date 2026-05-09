import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      capabilities: { include: { process: true } },
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }
  return NextResponse.json({ vendor });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, contactPerson, contactPhone, specialization, gstin, isActive, processIds } = body;

  const vendor = await prisma.vendor.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(specialization !== undefined && { specialization }),
      ...(gstin !== undefined && { gstin }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      capabilities: { include: { process: true } },
    },
  });

  // If processIds provided, replace all capabilities
  if (processIds !== undefined) {
    await prisma.vendorCapability.deleteMany({ where: { vendorId: id } });
    if (processIds.length > 0) {
      await prisma.vendorCapability.createMany({
        data: processIds.map((pid: string) => ({ vendorId: id, processId: pid })),
      });
    }
    // Re-fetch to include updated capabilities
    const updated = await prisma.vendor.findUnique({
      where: { id },
      include: { capabilities: { include: { process: true } } },
    });
    return NextResponse.json({ vendor: updated });
  }

  return NextResponse.json({ vendor });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.vendor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
