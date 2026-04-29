import { NextRequest, NextResponse } from "next/server";
import { getAbsolutePath, fileExists } from "@/lib/storage";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// GET /api/uploads/inspections/filename.ext — serve uploaded files
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  const relativePath = segments.join("/");

  // Only allow serving from known subdirectories
  const allowedPrefixes = ["inspections/", "documents/", "originals/", "masked/"];
  if (!allowedPrefixes.some((p) => relativePath.startsWith(p))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (!fileExists(relativePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const absolutePath = getAbsolutePath(relativePath);
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(relativePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(relativePath)}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
