import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath, saveFile } from "@/lib/storage";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";

function getPythonCmd(): string {
  return process.env.AI_SANITIZER_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
}

function getScriptPath(): string {
  return process.env.AI_SANITIZER_SCRIPT ?? path.resolve(process.cwd(), "../backend/ai/ai_sanitizer.py");
}

// POST /api/parts/[id]/sanitize
// Body: { fileId: string }  — the DRAWING_PDF file to sanitize
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { fileId } = await req.json();

  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.partId !== id) {
    return NextResponse.json({ error: "File not found for this part" }, { status: 404 });
  }
  if (file.fileType !== "DRAWING_PDF") {
    return NextResponse.json({ error: "Only DRAWING_PDF files can be sanitized" }, { status: 400 });
  }

  const inputPath = getAbsolutePath(file.filePath);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dqms-ai-"));
  const outputPath = path.join(tempDir, `${file.id}_masked.pdf`);

  try {
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
      (resolve, reject) => {
        const child = spawn(getPythonCmd(), [
          getScriptPath(),
          "--input", inputPath,
          "--output", outputPath,
          "--internal-id", file.id,
        ], {
          env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        child.on("error", reject);
        child.on("close", (code) => resolve({ stdout, stderr, code }));
      }
    );

    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || "AI sanitizer failed");
    }

    let parsed: any;
    try { parsed = JSON.parse(result.stdout.trim()); } catch {
      throw new Error("AI sanitizer returned invalid JSON");
    }

    const outputBuffer = await fs.readFile(outputPath);
    const maskedName = `${file.id}_masked.pdf`;
    const maskedPath = await saveFile(outputBuffer, maskedName, "masked");

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
        data: { fileId: file.id, derivativeType: "MASKED", filePath: maskedPath, status: "READY" },
      });
    }

    // Update file metadata from sanitizer output
    await prisma.file.update({
      where: { id: file.id },
      data: {
        clientDrawingId: parsed.clientDrawingId ?? null,
        clientCompanyName: parsed.clientCompanyName ?? null,
        sanitizationMetadata: parsed.metadata ?? {},
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
      clientDrawingId: parsed.clientDrawingId,
      clientCompanyName: parsed.clientCompanyName,
      redactedBlockCount: parsed.redactedBlockCount ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Sanitization failed" }, { status: 500 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
