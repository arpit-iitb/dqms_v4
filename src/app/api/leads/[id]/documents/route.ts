import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { documentType, documentNumber, url, notes } = body;

  const doc = await prisma.document.create({
    data: {
      leadId: id,
      documentType: documentType ?? "OTHER",
      documentNumber: documentNumber || null,
      url: url || null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
