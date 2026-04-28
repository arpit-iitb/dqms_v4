import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/files/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const file = await prisma.file.findUnique({
    where: { id },
    include: { part: true },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only allow deletion in DRAFT or FILES_RECEIVED
  if (!["DRAFT", "FILES_RECEIVED"].includes(file.part.state)) {
    return NextResponse.json(
      { error: `Cannot delete file when part is in ${file.part.state} state` },
      { status: 400 }
    );
  }

  await prisma.file.delete({ where: { id } });

  // If part was FILES_RECEIVED and now missing a file, revert to DRAFT
  const remaining = await prisma.file.findMany({
    where: { partId: file.partId, isLatest: true },
  });
  const hasStep = remaining.some((f) => f.fileType === "STEP");
  const hasPdf = remaining.some((f) => f.fileType === "DRAWING_PDF");
  if ((!hasStep || !hasPdf) && file.part.state === "FILES_RECEIVED") {
    await prisma.part.update({ where: { id: file.partId }, data: { state: "DRAFT" } });
  }

  return NextResponse.json({ ok: true });
}
