import { NextRequest, NextResponse } from "next/server";
import { getFileBuffer, getFileMime, fileExists } from "@/lib/storage";
import path from "path";

export const dynamic = "force-dynamic";

// GET /api/uploads/inspections/filename.ext — serve uploaded files
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  const storageKey = segments.join("/");

  // Only allow serving from known subdirectories
  const allowedPrefixes = ["inspections/", "documents/", "originals/", "masked/"];
  if (!allowedPrefixes.some((p) => storageKey.startsWith(p))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (!(await fileExists(storageKey))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await getFileBuffer(storageKey);
  if (!buffer) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const contentType = await getFileMime(storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(storageKey)}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
