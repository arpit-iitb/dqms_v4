import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath, fileExists } from "@/lib/storage";
import fs from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".step": "application/step",
  ".stp": "application/step",
  ".dxf": "application/dxf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || !doc.filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!fileExists(doc.filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const absPath = getAbsolutePath(doc.filePath);
  const ext = path.extname(absPath).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";
  const data = fs.readFileSync(absPath);

  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(absPath)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
