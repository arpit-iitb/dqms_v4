import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFileBuffer, getFileMime } from "@/lib/storage";

export const dynamic = "force-dynamic";

// GET /api/files/[id]/serve — stream a file to the browser
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await getFileBuffer(file.filePath);
  if (!buffer) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const contentType = await getFileMime(file.filePath);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${file.fileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
