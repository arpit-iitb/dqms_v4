import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFileBuffer, getFileMime } from "@/lib/storage";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || !doc.filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await getFileBuffer(doc.filePath);
  if (!data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const contentType = await getFileMime(doc.filePath);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(doc.filePath)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
