import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // --- File upload via FormData ---
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string) ?? "OTHER";
    const documentNumber = (formData.get("documentNumber") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
    const storedName = `${id}_${Date.now()}${ext}`;
    const filePath = await saveFile(buffer, storedName, "documents");

    const doc = await prisma.document.create({
      data: {
        salesOrderId: id,
        documentType: documentType as any,
        documentNumber,
        filePath,
        notes,
      },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  }

  // --- JSON-based URL document (existing behavior) ---
  const body = await req.json();
  const { documentType, documentNumber, url, notes } = body;

  const doc = await prisma.document.create({
    data: {
      salesOrderId: id,
      documentType: documentType ?? "OTHER",
      documentNumber: documentNumber || null,
      url: url || null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
