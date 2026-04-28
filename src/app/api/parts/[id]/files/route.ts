import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import path from "path";

export const dynamic = "force-dynamic";

// GET /api/parts/[id]/files — list files for a part
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const files = await prisma.file.findMany({
    where: { partId: id, isLatest: true },
    include: { derivatives: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      fileType: f.fileType,
      fileName: f.fileName,
      version: f.version,
      isOriginal: f.isOriginal,
      createdAt: f.createdAt,
      aiSanitizedAt: f.aiSanitizedAt,
      derivatives: f.derivatives.map((d) => ({
        id: d.id,
        type: d.derivativeType,
        status: d.status,
      })),
    })),
  });
}

// POST /api/parts/[id]/files — upload STEP or PDF
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const part = await prisma.part.findUnique({ where: { id }, include: { files: true } });
  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const fileTypeRaw = formData.get("type") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!fileTypeRaw || !["STEP", "DRAWING_PDF"].includes(fileTypeRaw)) {
    return NextResponse.json({ error: "type must be STEP or DRAWING_PDF" }, { status: 400 });
  }

  const fileType = fileTypeRaw as "STEP" | "DRAWING_PDF";
  const ext = path.extname(file.name).toLowerCase() || (fileType === "DRAWING_PDF" ? ".pdf" : ".step");

  // Check for duplicate
  const existing = part.files.find((f) => f.fileType === fileType && f.isLatest);
  if (existing) {
    return NextResponse.json({ error: `${fileType} already uploaded. Delete existing file first.` }, { status: 409 });
  }

  // Create DB record first to get UUID
  const fileRecord = await prisma.file.create({
    data: {
      partId: id,
      fileType,
      fileName: file.name,
      filePath: "",
      version: 1,
      isOriginal: true,
      isLatest: true,
    },
  });

  const storedName = `${fileRecord.id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const relativePath = await saveFile(buffer, storedName, "originals");

  await prisma.file.update({
    where: { id: fileRecord.id },
    data: { fileName: storedName, filePath: relativePath },
  });

  // Auto-transition part to FILES_RECEIVED if both STEP + PDF now exist
  const allFiles = await prisma.file.findMany({ where: { partId: id, isLatest: true } });
  const hasStep = allFiles.some((f) => f.fileType === "STEP");
  const hasPdf = allFiles.some((f) => f.fileType === "DRAWING_PDF");
  if (hasStep && hasPdf && part.state === "DRAFT") {
    await prisma.part.update({ where: { id }, data: { state: "FILES_RECEIVED" } });
  }

  return NextResponse.json({
    file: { id: fileRecord.id, fileType, fileName: storedName, version: 1 },
  }, { status: 201 });
}
