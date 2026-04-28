import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/parts/annotations/[annotationId] — update content or coordinates
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params;
  const { content, coordinates } = await req.json();

  const annotation = await prisma.annotation.update({
    where: { id: annotationId },
    data: {
      ...(content !== undefined && { content }),
      ...(coordinates !== undefined && { coordinates }),
    },
  });
  return NextResponse.json({ annotation });
}

// DELETE /api/parts/annotations/[annotationId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params;
  await prisma.annotation.delete({ where: { id: annotationId } });
  return NextResponse.json({ ok: true });
}
