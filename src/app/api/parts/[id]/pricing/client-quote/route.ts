import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// POST /api/parts/[id]/pricing/client-quote — generate a client quote with a shareable token
// Body: { notes? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const notes: string | null = body.notes ?? null;

  const pricing = await prisma.pricingModel.findUnique({
    where: { partId: id },
    include: { clientQuote: true },
  });

  if (!pricing) return NextResponse.json({ error: "No pricing model found" }, { status: 404 });
  if (!pricing.locked) return NextResponse.json({ error: "Lock pricing before generating a client quote" }, { status: 409 });

  // Return existing if already generated
  if (pricing.clientQuote) {
    return NextResponse.json({ clientQuote: pricing.clientQuote });
  }

  const accessToken = crypto.randomBytes(24).toString("hex");

  const clientQuote = await prisma.clientQuote.create({
    data: {
      pricingModelId: pricing.id,
      accessToken,
      unitPriceUsd: pricing.clientUnitPriceUsd,
      quantity: pricing.quantity,
      totalPriceUsd: pricing.totalPriceUsd,
      leadTimeDays: pricing.selectedLeadTimeDays ?? 0,
      notes,
      status: "SENT",
    },
  });

  // Transition part to CLIENT_APPROVED candidate state — just mark as PRICED for now
  // (actual CLIENT_APPROVED happens when client accepts via portal)

  return NextResponse.json({ clientQuote }, { status: 201 });
}
