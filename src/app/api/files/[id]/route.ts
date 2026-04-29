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

  // If deleting the latest version, promote the previous version
  if (file.isLatest) {
    const olderVersion = await prisma.file.findFirst({
      where: {
        partId: file.partId,
        fileType: file.fileType,
        id: { not: file.id },
        version: { lt: file.version },
      },
      orderBy: { version: "desc" },
    });

    if (olderVersion) {
      await prisma.$transaction([
        prisma.file.delete({ where: { id } }),
        prisma.file.update({
          where: { id: olderVersion.id },
          data: { isLatest: true },
        }),
        prisma.part.update({
          where: { id: file.partId },
          data: { revision: { decrement: 1 } },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }
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
