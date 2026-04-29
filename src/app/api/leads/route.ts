import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLeadDisplayId, generatePublicId } from "@/lib/id-generator";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const statusParam = searchParams.get("status");
  const clientId = searchParams.get("client");

  const whereStatus: any = statusParam ? { status: statusParam } : {};

  const leads = await prisma.lead.findMany({
    where: {
      ...whereStatus,
      ...(clientId ? { clientId } : {}),
      ...(search
        ? {
            OR: [
              { displayId: { contains: search, mode: "insensitive" as const } },
              { client: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, email: true } },
      _count: { select: { parts: true } },
    },
  });

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientId, notes } = body;

  if (!clientId) {
    return NextResponse.json({ error: "Client is required" }, { status: 400 });
  }

  const displayId = await generateLeadDisplayId();
  const lead = await prisma.lead.create({
    data: {
      publicId: generatePublicId("LQ"),
      displayId,
      clientId,
      status: "LEAD",
      orderDate: new Date(),
      notes: notes || null,
    },
    include: { client: true },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
