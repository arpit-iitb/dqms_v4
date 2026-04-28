import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDrawingId } from "@/lib/id-generator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const publicId = await generateDrawingId();

  const part = await prisma.part.create({
    data: {
      publicId,
      orderId: id,
      state: "DRAFT",
      partName: body.partName || null,
      description: body.description || null,
      materialName: body.materialName || null,
      materialGrade: body.materialGrade || null,
      surfaceTreatment: body.surfaceTreatment || null,
      quantity: body.quantity ?? 1,
    },
  });

  return NextResponse.json({ part }, { status: 201 });
}
