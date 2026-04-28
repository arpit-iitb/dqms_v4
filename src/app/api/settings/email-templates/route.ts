import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { key: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const { key, displayName, subject, body } = await req.json();
  if (!key || !displayName || !subject || !body) {
    return NextResponse.json({ error: "key, displayName, subject, body required" }, { status: 400 });
  }
  const template = await prisma.emailTemplate.create({
    data: { key, displayName, subject, body },
  });
  return NextResponse.json({ template }, { status: 201 });
}
