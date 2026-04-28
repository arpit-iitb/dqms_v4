import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/parts/[id]/pricing/lock — lock the pricing model and mark part as PRICED
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pricing = await prisma.pricingModel.findUnique({ where: { partId: id } });
  if (!pricing) return NextResponse.json({ error: "No pricing model found" }, { status: 404 });
  if (pricing.locked) return NextResponse.json({ error: "Already locked" }, { status: 409 });

  const [updated] = await prisma.$transaction([
    prisma.pricingModel.update({
      where: { partId: id },
      data: { locked: true },
      include: { clientQuote: true },
    }),
    prisma.part.update({
      where: { id },
      data: { state: "PRICED" },
    }),
  ]);

  return NextResponse.json({ pricing: updated });
}
