import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath } from "@/lib/storage";
import { spawn } from "child_process";
import path from "path";

function getPythonCmd(): string {
  return process.env.AI_SANITIZER_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
}

function getScriptPath(): string {
  return process.env.EXTRACT_TEXT_SCRIPT ?? path.resolve(process.cwd(), "../backend/ai/extract_region_text.py");
}

// POST /api/parts/[id]/extract-text
// Body: { fileId, x0, y0, x1, y1, page? }  — coordinates as 0-1 fractions of the canvas (794x1123)
// The canvas is sized to match A4 rendering; we pass fractions so the script maps to actual PDF dims.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { fileId, x0, y0, x1, y1, page = 0 } = await req.json();

  if (fileId == null || x0 == null || y0 == null || x1 == null || y1 == null) {
    return NextResponse.json({ error: "fileId, x0, y0, x1, y1 required" }, { status: 400 });
  }

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.partId !== id || file.fileType !== "DRAWING_PDF") {
    return NextResponse.json({ error: "PDF file not found for this part" }, { status: 404 });
  }

  const inputPath = getAbsolutePath(file.filePath);

  const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
    (resolve, reject) => {
      const child = spawn(getPythonCmd(), [
        getScriptPath(),
        "--input", inputPath,
        "--x0", String(x0),
        "--y0", String(y0),
        "--x1", String(x1),
        "--y1", String(y1),
        "--page", String(page),
      ]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      child.on("error", reject);
      child.on("close", (code) => resolve({ stdout, stderr, code }));
    }
  );

  if (result.code !== 0) {
    return NextResponse.json({ error: result.stderr.trim() || "Text extraction failed", text: "" });
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    return NextResponse.json({ text: parsed.text ?? "" });
  } catch {
    return NextResponse.json({ text: "" });
  }
}
