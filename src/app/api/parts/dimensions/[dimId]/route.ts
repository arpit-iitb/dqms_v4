import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ dimId: string }> }
) {
  const { dimId } = await params;
  await prisma.dimension.delete({ where: { id: dimId } });
  return NextResponse.json({ ok: true });
}
