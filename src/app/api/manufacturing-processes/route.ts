import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const processes = await prisma.manufacturingProcess.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ processes });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, category } = body;

  if (!name || !category) {
    return NextResponse.json(
      { error: "Name and category are required" },
      { status: 400 },
    );
  }

  const process = await prisma.manufacturingProcess.create({
    data: { name, category },
  });

  return NextResponse.json({ process }, { status: 201 });
}
