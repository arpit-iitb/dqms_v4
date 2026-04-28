import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath, fileExists } from "@/lib/storage";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// GET /api/files/[id]/serve — stream a file to the browser
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!fileExists(file.filePath)) {
    return NextResponse.json({ error: "File not on disk" }, { status: 404 });
  }

  const absolutePath = getAbsolutePath(file.filePath);
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(file.fileName).toLowerCase();
  const contentType = ext === ".pdf" ? "application/pdf"
    : ext === ".step" || ext === ".stp" ? "application/octet-stream"
    : "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${file.fileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
