import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFileBuffer } from "@/lib/storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

const EXTRACTION_PROMPT = `Extract the following fields from this engineering drawing PDF. Return JSON only, no markdown:
{
  "partName": "the part/component name or title",
  "materialName": "material specification (e.g., Aluminum, Steel, Brass)",
  "materialGrade": "material grade (e.g., 6061-T6, SS304, EN8)",
  "surfaceTreatment": "surface treatment/finish if specified",
  "quantity": number or null,
  "clientPartId": "the client's part/drawing number"
}
If a field is not found or unclear, set it to null.`;

interface ExtractionResult {
  partId: string;
  partName: string | null;
  materialName: string | null;
  materialGrade: string | null;
  surfaceTreatment: string | null;
  quantity: number | null;
  clientPartId: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({ partIds: [] }));
  const partIds: string[] = body.partIds ?? [];

  if (!Array.isArray(partIds) || partIds.length === 0) {
    return NextResponse.json(
      { error: "partIds array is required" },
      { status: 400 },
    );
  }

  // Verify lead exists
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const results: ExtractionResult[] = [];

  for (const partId of partIds) {
    const nullResult: ExtractionResult = {
      partId,
      partName: null,
      materialName: null,
      materialGrade: null,
      surfaceTreatment: null,
      quantity: null,
      clientPartId: null,
    };

    try {
      // Find the latest DRAWING_PDF file for this part
      const file = await prisma.file.findFirst({
        where: {
          partId,
          fileType: "DRAWING_PDF",
          isLatest: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!file) {
        results.push(nullResult);
        continue;
      }

      const pdfBuffer = await getFileBuffer(file.filePath);
      if (!pdfBuffer) {
        results.push(nullResult);
        continue;
      }

      const pdfBase64 = pdfBuffer.toString("base64");

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
        { text: EXTRACTION_PROMPT },
      ]);

      const responseText =
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // Extract JSON from response (handle possible markdown fences)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        results.push(nullResult);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      results.push({
        partId,
        partName: parsed.partName ?? null,
        materialName: parsed.materialName ?? null,
        materialGrade: parsed.materialGrade ?? null,
        surfaceTreatment: parsed.surfaceTreatment ?? null,
        quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
        clientPartId: parsed.clientPartId ?? null,
      });
    } catch (err) {
      console.error(`[extract-info] Failed for part ${partId}:`, err);
      results.push(nullResult);
    }
  }

  return NextResponse.json({ results });
}
