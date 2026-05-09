import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDrawingId } from "@/lib/id-generator";

interface BulkPartInput {
  partName?: string | null;
  materialName?: string | null;
  materialGrade?: string | null;
  surfaceTreatment?: string | null;
  description?: string | null;
  quantity?: number | null;
  clientPartId?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({ parts: [] }));
  const inputs: BulkPartInput[] = body.parts ?? [];

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return NextResponse.json(
      { error: "parts array is required and must not be empty" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Generate all drawing IDs upfront (each calls the counter)
  const drawingIds = await Promise.all(
    inputs.map(() => generateDrawingId()),
  );

  // Create all parts in a single transaction
  const parts = await prisma.$transaction(
    inputs.map((input, i) =>
      prisma.part.create({
        data: {
          publicId: drawingIds[i],
          leadId: id,
          state: "DRAFT",
          partName: input.partName || null,
          clientPartId: input.clientPartId || null,
          description: input.description || null,
          materialName: input.materialName || null,
          materialGrade: input.materialGrade || null,
          surfaceTreatment: input.surfaceTreatment || null,
          quantity: input.quantity ?? 1,
        },
      }),
    ),
  );

  return NextResponse.json({ parts }, { status: 201 });
}
