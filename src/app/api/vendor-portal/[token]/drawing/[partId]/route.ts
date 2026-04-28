import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath, fileExists } from "@/lib/storage";
import fs from "fs";

// GET /api/vendor-portal/[token]/drawing/[partId]
// Public: validates vendor token, then serves the masked drawing PDF for that part.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; partId: string }> }
) {
  const { token, partId } = await params;

  // Validate token — find the GroupedRFQVendor and confirm this part is in the RFQ
  const vendorRfq = await prisma.groupedRFQVendor.findUnique({
    where: { accessToken: token },
    include: {
      groupedRfq: {
        include: { parts: { where: { partId }, select: { partId: true } } },
      },
    },
  });

  if (!vendorRfq) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const partInRfq = vendorRfq.groupedRfq.parts.find((p) => p.partId === partId);
  if (!partInRfq) {
    return NextResponse.json({ error: "Part not in this RFQ" }, { status: 403 });
  }

  // Find the masked derivative for this part's DRAWING_PDF
  const maskedDerivative = await prisma.fileDerivative.findFirst({
    where: {
      file: { partId, fileType: "DRAWING_PDF" },
      derivativeType: "MASKED",
      status: "READY",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!maskedDerivative) {
    return NextResponse.json({ error: "No sanitized drawing available for this part" }, { status: 404 });
  }

  const absPath = getAbsolutePath(maskedDerivative.filePath);
  if (!fileExists(maskedDerivative.filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const buffer = fs.readFileSync(absPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="drawing-${partId}.pdf"`,
      "Content-Length": String(buffer.length),
      // No caching for sensitive drawings
      "Cache-Control": "no-store",
    },
  });
}
