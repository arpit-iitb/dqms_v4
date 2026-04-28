import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { displayName, subject, body, isActive } = await req.json();
  const template = await prisma.emailTemplate.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(subject !== undefined && { subject }),
      ...(body !== undefined && { body }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  return NextResponse.json({ template });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.emailTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
