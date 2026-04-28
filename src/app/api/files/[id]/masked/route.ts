import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath, fileExists } from "@/lib/storage";
import fs from "fs";

export const dynamic = "force-dynamic";

// GET /api/files/[id]/masked — serve the masked PDF derivative
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const derivative = await prisma.fileDerivative.findFirst({
    where: { fileId: id, derivativeType: "MASKED", status: "READY" },
    include: { file: true },
  });

  if (!derivative) {
    return NextResponse.json({ error: "Masked file not ready" }, { status: 404 });
  }

  if (!fileExists(derivative.filePath)) {
    return NextResponse.json({ error: "File not on disk" }, { status: 404 });
  }

  const absolutePath = getAbsolutePath(derivative.filePath);
  const buffer = fs.readFileSync(absolutePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="masked_${derivative.file.fileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
