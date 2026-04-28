import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicId } from "@/lib/id-generator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.manufacturingPlan.findUnique({ where: { partId: id } });
  if (existing) return NextResponse.json({ plan: existing });

  const plan = await prisma.manufacturingPlan.create({
    data: {
      publicId: generatePublicId("PLAN"),
      partId: id,
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
