import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.processTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const { name, description, steps } = await req.json();
  if (!name || !Array.isArray(steps)) {
    return NextResponse.json({ error: "name and steps[] required" }, { status: 400 });
  }
  const template = await prisma.processTemplate.create({
    data: { name, description: description || null, steps },
  });
  return NextResponse.json({ template }, { status: 201 });
}
