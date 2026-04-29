import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { revisionId } from "@/lib/id-generator";
import path from "path";

export const dynamic = "force-dynamic";

// GET /api/parts/[id]/files — list files for a part
// ?history=true returns all versions (not just latest), ordered by fileType asc, version desc
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const showHistory = req.nextUrl.searchParams.get("history") === "true";

  const files = await prisma.file.findMany({
    where: { partId: id, ...(showHistory ? {} : { isLatest: true }) },
    include: { derivatives: true },
    orderBy: showHistory
      ? [{ fileType: "asc" }, { version: "desc" }]
      : { createdAt: "asc" },
  });

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      fileType: f.fileType,
      fileName: f.fileName,
      version: f.version,
      isOriginal: f.isOriginal,
      isLatest: f.isLatest,
      internalDrawingId: f.internalDrawingId,
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
  const isRevision = formData.get("isRevision") === "true";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!fileTypeRaw || !["STEP", "DRAWING_PDF"].includes(fileTypeRaw)) {
    return NextResponse.json({ error: "type must be STEP or DRAWING_PDF" }, { status: 400 });
  }

  const fileType = fileTypeRaw as "STEP" | "DRAWING_PDF";
  const ext = path.extname(file.name).toLowerCase() || (fileType === "DRAWING_PDF" ? ".pdf" : ".step");

  // Check for existing latest file of same type
  const existing = part.files.find((f) => f.fileType === fileType && f.isLatest);

  if (existing && !isRevision) {
    return NextResponse.json({ error: `${fileType} already uploaded. Delete existing file first.` }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isRevision && existing) {
    // Revision upload — wrap in transaction
    const newVersion = existing.version + 1;
    const newRevision = part.revision + 1;
    const newRevisionId = revisionId(part.publicId, newRevision);

    const result = await prisma.$transaction(async (tx) => {
      // Mark old file as not latest
      await tx.file.update({
        where: { id: existing.id },
        data: { isLatest: false },
      });

      // Increment part revision
      await tx.part.update({
        where: { id },
        data: { revision: newRevision },
      });

      // Create new file record
      const fileRecord = await tx.file.create({
        data: {
          partId: id,
          fileType,
          fileName: file.name,
          filePath: "",
          version: newVersion,
          isOriginal: true,
          isLatest: true,
          internalDrawingId: newRevisionId,
        },
      });

      return fileRecord;
    });

    const storedName = `${result.id}${ext}`;
    const relativePath = await saveFile(buffer, storedName, "originals");

    await prisma.file.update({
      where: { id: result.id },
      data: { fileName: storedName, filePath: relativePath },
    });

    return NextResponse.json({
      file: { id: result.id, fileType, fileName: storedName, version: newVersion, internalDrawingId: newRevisionId },
    }, { status: 201 });
  }

  // Standard upload (no revision)
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
