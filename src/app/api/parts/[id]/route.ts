import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, displayId: true } },
      files: true,
      annotations: true,
      dimensions: { orderBy: { dimOrder: "asc" } },
      pricingModel: true,
      manufacturingPlan: {
        include: {
          blocks: {
            orderBy: { blockOrder: "asc" },
            include: { vendor: true, blockDimensions: true, inspectionResult: true },
          },
        },
      },
    },
  });

  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ part });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  const part = await prisma.part.update({
    where: { id },
    data: {
      ...(body.state !== undefined && { state: body.state }),
      ...(body.partName !== undefined && { partName: body.partName }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.materialName !== undefined && { materialName: body.materialName }),
      ...(body.materialGrade !== undefined && { materialGrade: body.materialGrade }),
      ...(body.surfaceTreatment !== undefined && { surfaceTreatment: body.surfaceTreatment }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
    },
  });

  return NextResponse.json({ part });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.part.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
