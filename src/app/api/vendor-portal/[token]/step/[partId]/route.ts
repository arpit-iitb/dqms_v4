import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath, fileExists } from "@/lib/storage";
import fs from "fs";

// GET /api/vendor-portal/[token]/step/[partId]
// Public: validates vendor token, then serves the STEP file for that part.
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

  // Find the latest STEP file for this part
  const stepFile = await prisma.file.findFirst({
    where: { partId, fileType: "STEP", isLatest: true },
  });

  if (!stepFile) {
    return NextResponse.json({ error: "No STEP file available for this part" }, { status: 404 });
  }

  const absPath = getAbsolutePath(stepFile.filePath);
  if (!fileExists(stepFile.filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const buffer = fs.readFileSync(absPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="step-${partId}.step"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
