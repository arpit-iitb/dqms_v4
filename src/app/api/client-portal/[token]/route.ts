import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/client-portal/[token] — public endpoint, find quote by token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const clientQuote = await prisma.clientQuote.findUnique({
    where: { accessToken: token },
    include: {
      pricingModel: {
        include: {
          part: {
            select: {
              id: true,
              publicId: true,
              partName: true,
              description: true,
              materialName: true,
              materialGrade: true,
              surfaceTreatment: true,
              quantity: true,
              lead: { select: { displayId: true, client: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  if (!clientQuote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ clientQuote });
}

// POST /api/client-portal/[token] — accept or reject a quote
// Body: { action: "accept" | "reject" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { action } = await req.json();

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'accept' or 'reject'" }, { status: 400 });
  }

  const clientQuote = await prisma.clientQuote.findUnique({
    where: { accessToken: token },
    include: { pricingModel: { select: { partId: true } } },
  });

  if (!clientQuote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (clientQuote.status !== "SENT") {
    return NextResponse.json({ error: "Quote already responded to" }, { status: 409 });
  }

  const newStatus = action === "accept" ? "ACCEPTED" : "REJECTED";
  const newPartState = action === "accept" ? "CLIENT_APPROVED" : "REJECTED";

  const [updated] = await prisma.$transaction([
    prisma.clientQuote.update({
      where: { accessToken: token },
      data: { status: newStatus },
    }),
    prisma.part.update({
      where: { id: clientQuote.pricingModel.partId },
      data: { state: newPartState },
    }),
  ]);

  return NextResponse.json({ clientQuote: updated });
}
