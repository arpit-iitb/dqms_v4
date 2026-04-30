import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFileBuffer, saveFile } from "@/lib/storage";
import {
  analyzeForSanitization,
  applySanitization,
  type RedactionBlock,
} from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

// POST /api/parts/[id]/sanitize
// Body variants:
//   { fileId, action: "analyze" }              — Phase 1 only (returns proposed redactions)
//   { fileId, action: "apply", redactions, internalId? }  — Phase 2 (apply approved redactions)
//   { fileId }                                  — Full sanitize (backward compat: analyze + apply)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { fileId, action } = body as {
    fileId?: string;
    action?: "analyze" | "apply";
  };

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 }
    );
  }

  // Validate file belongs to this part and is a DRAWING_PDF
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.partId !== id) {
    return NextResponse.json(
      { error: "File not found for this part" },
      { status: 404 }
    );
  }
  if (file.fileType !== "DRAWING_PDF") {
    return NextResponse.json(
      { error: "Only DRAWING_PDF files can be sanitized" },
      { status: 400 }
    );
  }

  const pdfBuffer = await getFileBuffer(file.filePath);
  if (!pdfBuffer) {
    return NextResponse.json(
      { error: "PDF file not found" },
      { status: 404 }
    );
  }

  try {
    // ------------------------------------------------------------------
    // ACTION: ANALYZE — return proposed redactions without modifying PDF
    // ------------------------------------------------------------------
    if (action === "analyze") {
      const analysis = await analyzeForSanitization(pdfBuffer);
      return NextResponse.json(analysis);
    }

    // ------------------------------------------------------------------
    // ACTION: APPLY — take approved redactions and generate masked PDF
    // ------------------------------------------------------------------
    if (action === "apply") {
      const { redactions, internalId } = body as {
        redactions?: RedactionBlock[];
        internalId?: string;
      };

      if (!redactions || !Array.isArray(redactions)) {
        return NextResponse.json(
          { error: "redactions array is required for action=apply" },
          { status: 400 }
        );
      }

      const maskedBuffer = await applySanitization(pdfBuffer, redactions, {
        internalId: internalId ?? file.id,
        companyOverlay: "Mechximize",
      });

      // Save masked PDF
      const maskedName = `${file.id}_masked.pdf`;
      const maskedPath = await saveFile(
        maskedBuffer,
        maskedName,
        "masked"
      );

      // Upsert masked derivative
      const existing = await prisma.fileDerivative.findFirst({
        where: { fileId: file.id, derivativeType: "MASKED" },
      });

      if (existing) {
        await prisma.fileDerivative.update({
          where: { id: existing.id },
          data: { filePath: maskedPath, status: "READY", errorMessage: null },
        });
      } else {
        await prisma.fileDerivative.create({
          data: {
            fileId: file.id,
            derivativeType: "MASKED",
            filePath: maskedPath,
            status: "READY",
          },
        });
      }

      // Extract metadata from removed blocks
      const removedTexts = redactions
        .filter((r) => r.action === "REMOVE" && !r.isImage)
        .map((r) => r.text);

      // Update file metadata
      const clientDrawingId =
        (body.metadata?.clientDrawingId as string) ?? null;
      const clientCompanyName =
        (body.metadata?.clientCompanyName as string) ?? null;

      await prisma.file.update({
        where: { id: file.id },
        data: {
          clientDrawingId,
          clientCompanyName,
          sanitizationMetadata: body.metadata ?? {},
          aiSanitizedAt: new Date(),
        },
      });

      // Transition part to SANITIZED
      await prisma.part.update({
        where: { id },
        data: { state: "SANITIZED" },
      });

      return NextResponse.json({
        maskedFileId: file.id,
        clientDrawingId,
        clientCompanyName,
        redactedBlockCount: redactions.filter((r) => r.action === "REMOVE")
          .length,
      });
    }

    // ------------------------------------------------------------------
    // NO ACTION — Full sanitize (backward compatible: analyze + apply)
    // ------------------------------------------------------------------
    const analysis = await analyzeForSanitization(pdfBuffer);

    const maskedBuffer = await applySanitization(
      pdfBuffer,
      analysis.blocks,
      {
        internalId: file.id,
        companyOverlay: "Mechximize",
      }
    );

    // Save masked PDF
    const maskedName = `${file.id}_masked.pdf`;
    const maskedPath = await saveFile(maskedBuffer, maskedName, "masked");

    // Upsert masked derivative
    const existing = await prisma.fileDerivative.findFirst({
      where: { fileId: file.id, derivativeType: "MASKED" },
    });

    if (existing) {
      await prisma.fileDerivative.update({
        where: { id: existing.id },
        data: { filePath: maskedPath, status: "READY", errorMessage: null },
      });
    } else {
      await prisma.fileDerivative.create({
        data: {
          fileId: file.id,
          derivativeType: "MASKED",
          filePath: maskedPath,
          status: "READY",
        },
      });
    }

    // Update file metadata from analysis
    await prisma.file.update({
      where: { id: file.id },
      data: {
        clientDrawingId: analysis.metadata.clientDrawingId,
        clientCompanyName: analysis.metadata.clientCompanyName,
        sanitizationMetadata: analysis.metadata,
        aiSanitizedAt: new Date(),
      },
    });

    // Transition part to SANITIZED
    await prisma.part.update({
      where: { id },
      data: { state: "SANITIZED" },
    });

    return NextResponse.json({
      maskedFileId: file.id,
      clientDrawingId: analysis.metadata.clientDrawingId,
      clientCompanyName: analysis.metadata.clientCompanyName,
      redactedBlockCount: analysis.blocks.filter(
        (b) => b.action === "REMOVE"
      ).length,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Sanitization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
