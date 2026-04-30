import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import path from "path";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ planId: string; blockId: string }> };

// GET — return reportPath and list of photos
export async function GET(_req: NextRequest, { params }: Params) {
  const { blockId } = await params;

  const result = await prisma.inspectionResult.findUnique({
    where: { blockId },
    select: {
      id: true,
      reportPath: true,
      photos: {
        select: { id: true, fileName: true, filePath: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    reportPath: result?.reportPath ?? null,
    photos: result?.photos ?? [],
  });
}

// POST — upload a file (report PDF or photo)
export async function POST(req: NextRequest, { params }: Params) {
  const { blockId } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "report" | "photo"

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!type || !["report", "photo"].includes(type)) {
    return NextResponse.json({ error: "type must be 'report' or 'photo'" }, { status: 400 });
  }

  // Find or create InspectionResult for this block
  let result = await prisma.inspectionResult.findUnique({ where: { blockId } });
  if (!result) {
    // Create a minimal inspection result so we can attach files
    result = await prisma.inspectionResult.create({
      data: {
        blockId,
        inspectorType: "INTERNAL",
        result: "PASS",
        notes: null,
      },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase() || "";
  const storedName = `${result.id}-${Date.now()}${ext}`;
  const relativePath = await saveFile(buffer, storedName, "inspections");

  if (type === "report") {
    await prisma.inspectionResult.update({
      where: { id: result.id },
      data: { reportPath: relativePath },
    });
    return NextResponse.json({ reportPath: relativePath }, { status: 201 });
  }

  // type === "photo"
  const photo = await prisma.inspectionPhoto.create({
    data: {
      resultId: result.id,
      fileName: file.name,
      filePath: relativePath,
    },
  });

  return NextResponse.json({ photo }, { status: 201 });
}

// DELETE — remove a photo by ?photoId=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const { blockId } = await params;
  const url = new URL(req.url);
  const photoId = url.searchParams.get("photoId");

  if (!photoId) {
    return NextResponse.json({ error: "photoId query param required" }, { status: 400 });
  }

  // Verify the photo belongs to this block's inspection
  const photo = await prisma.inspectionPhoto.findUnique({
    where: { id: photoId },
    include: { result: true },
  });

  if (!photo || photo.result.blockId !== blockId) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Delete DB record (FileBlob cleanup handled separately or by DB cascade)
  await prisma.inspectionPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ ok: true });
}
