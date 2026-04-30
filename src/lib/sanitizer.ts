/**
 * PDF Sanitization Service for DQMS v4
 *
 * Two-phase sanitization:
 *   Phase 1 — analyzeForSanitization: extract text/image blocks, classify via Gemini
 *   Phase 2 — applySanitization: redact approved blocks and produce masked PDF
 *
 * Server-only module. Do NOT import from client components.
 */

import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextBlock {
  id: string;
  text: string;
  page: number; // 0-indexed
  x: number;
  y: number;
  width: number;
  height: number;
  isImage: boolean;
}

export interface RedactionBlock {
  id: string;
  text: string;
  page: number; // 0-indexed
  x: number; // PDF coordinates (origin bottom-left)
  y: number;
  width: number;
  height: number;
  action: "REMOVE" | "KEEP";
  reason: string;
  isImage: boolean;
}

export interface SanitizationAnalysis {
  blocks: RedactionBlock[];
  metadata: {
    clientDrawingId: string | null;
    clientCompanyName: string | null;
    partName: string | null;
    material: string | null;
  };
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateBlockId(page: number, index: number): string {
  return `p${page}_b${index}`;
}

/**
 * Checks whether a TextItem-like object has the `str` property
 * (i.e. it is a TextItem, not a TextMarkedContent).
 */
function isTextItem(item: unknown): item is TextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

// ---------------------------------------------------------------------------
// Phase 1-A: Text extraction via pdf.js
// ---------------------------------------------------------------------------

async function extractTextBlocks(pdfData: Uint8Array): Promise<{
  blocks: TextBlock[];
  pageCount: number;
}> {
  // Load the PDF with pdf.js legacy build (Node-compatible, no workers)
  const loadingTask = getDocument({
    data: pdfData,
    useSystemFonts: true,
    useWorkerFetch: false,
  });

  const doc = await loadingTask.promise;
  const allBlocks: TextBlock[] = [];

  for (let pageIdx = 0; pageIdx < doc.numPages; pageIdx++) {
    const page = await doc.getPage(pageIdx + 1); // 1-indexed in pdf.js
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    // ----- collect raw text items with bounding boxes -----
    interface RawItem {
      text: string;
      x: number;
      y: number; // PDF coordinate (bottom-left origin)
      width: number;
      height: number;
    }

    const rawItems: RawItem[] = [];

    for (const item of textContent.items) {
      if (!isTextItem(item)) continue;
      if (!item.str.trim()) continue;

      // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontHeight = Math.abs(item.transform[3]) || item.height;
      const w = item.width;

      rawItems.push({
        text: item.str,
        x: tx,
        y: ty,
        width: w,
        height: fontHeight,
      });
    }

    // ----- group items into lines (same y ± 4pt tolerance) -----
    interface Line {
      items: RawItem[];
      avgY: number;
    }

    const lines: Line[] = [];
    const Y_TOLERANCE = 4;

    for (const ri of rawItems) {
      let matched = false;
      for (const line of lines) {
        if (Math.abs(ri.y - line.avgY) <= Y_TOLERANCE) {
          line.items.push(ri);
          // recalculate average y
          line.avgY =
            line.items.reduce((s, it) => s + it.y, 0) / line.items.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        lines.push({ items: [ri], avgY: ri.y });
      }
    }

    // ----- build a TextBlock per line -----
    for (const line of lines) {
      // sort items left-to-right
      line.items.sort((a, b) => a.x - b.x);

      const firstItem = line.items[0];
      const lastItem = line.items[line.items.length - 1];
      const minX = firstItem.x;
      const maxX = lastItem.x + lastItem.width;
      const minY = Math.min(...line.items.map((i) => i.y));
      const maxHeight = Math.max(...line.items.map((i) => i.height));

      const text = line.items.map((i) => i.text).join(" ");
      const blockIndex = allBlocks.length;

      allBlocks.push({
        id: generateBlockId(pageIdx, blockIndex),
        text,
        page: pageIdx,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxHeight,
        isImage: false,
      });
    }

    // ----- detect images via operator list -----
    try {
      const opList = await page.getOperatorList();
      const imageOps = [
        OPS.paintImageXObject,
        OPS.paintImageXObjectRepeat,
        OPS.paintImageMaskXObject,
        OPS.paintImageMaskXObjectGroup,
      ];

      for (let i = 0; i < opList.fnArray.length; i++) {
        if (imageOps.includes(opList.fnArray[i])) {
          // We cannot reliably get bounding boxes from the operator list
          // without replaying the graphics state. Use a heuristic: create an
          // image block covering a generous area near the centre of the page.
          // If a transform matrix is available in the args we try to use it.
          const args = opList.argsArray[i];

          let imgX = 0;
          let imgY = 0;
          let imgW = viewport.width;
          let imgH = viewport.height;

          // Some ops carry a transform matrix [a,b,c,d,e,f] in args[1]
          if (args && Array.isArray(args[1]) && args[1].length >= 6) {
            const m = args[1];
            imgW = Math.abs(m[0]) || viewport.width * 0.3;
            imgH = Math.abs(m[3]) || viewport.height * 0.3;
            imgX = m[4] ?? 0;
            imgY = m[5] ?? 0;
          }

          const blockIndex = allBlocks.length;
          allBlocks.push({
            id: generateBlockId(pageIdx, blockIndex),
            text: `[IMAGE at page ${pageIdx + 1}]`,
            page: pageIdx,
            x: imgX,
            y: imgY,
            width: imgW,
            height: imgH,
            isImage: true,
          });
        }
      }
    } catch {
      // If operator list extraction fails, proceed without image detection
    }

    page.cleanup();
  }

  const pageCount = doc.numPages;
  doc.destroy();

  return { blocks: allBlocks, pageCount };
}

// ---------------------------------------------------------------------------
// Phase 1-B: AI classification via Gemini
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = `You are a PDF sanitization classifier for engineering/manufacturing drawings.

You will receive a JSON array of text and image blocks extracted from a PDF drawing. For each block you must decide:
- "REMOVE" — if the block contains proprietary/identifying info that should be redacted
- "KEEP" — if the block contains technical information that should be preserved

## REMOVE these types of content:
- Company names, brand names, logos
- Drawing numbers, part numbers assigned by the client
- Names, initials, signatures of people
- Email addresses, phone numbers, fax numbers
- Physical addresses
- Dates (drawing dates, revision dates, approval dates)
- QR codes, barcodes
- Proprietary/confidentiality notices
- Title block headers like "DRAWN BY", "CHECKED BY", "APPROVED BY" and their values
- Revision history tables
- Logo images, QR/barcode images

## KEEP these types of content:
- Dimensions and tolerances (e.g. "25.00 ±0.05", "Ø12 H7")
- GD&T symbols and callouts
- Material specifications (e.g. "AISI 304", "EN8")
- Manufacturing notes and instructions
- Surface finish symbols and values (e.g. "Ra 1.6")
- Heat treatment specifications
- Section view labels (e.g. "SECTION A-A")
- Scale indicators (e.g. "SCALE 2:1")
- Technical labels and annotations
- Technical diagram images (cross-sections, detail views, etc.)

For IMAGE blocks: if the description suggests it is a logo, QR code, barcode, or stamp — REMOVE. If it appears to be a technical diagram, cross-section, or detail view — KEEP. If uncertain, default to REMOVE for safety.

Respond ONLY with a valid JSON array. Each element must have exactly these fields:
  { "id": "<block id>", "action": "REMOVE" | "KEEP", "reason": "<brief reason>" }

Do not include any text outside the JSON array.`;

const METADATA_PROMPT = `You are analyzing text blocks that were REMOVED (redacted) from an engineering drawing.

From the redacted content below, extract the following metadata if present:
- clientDrawingId: the client's drawing number or part number (NOT internal IDs)
- clientCompanyName: the company name found on the drawing
- partName: the name or description of the part
- material: material specification mentioned

Respond ONLY with a valid JSON object:
{ "clientDrawingId": "..." | null, "clientCompanyName": "..." | null, "partName": "..." | null, "material": "..." | null }

Do not include any text outside the JSON object.`;

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

async function classifyBlocks(
  blocks: TextBlock[]
): Promise<{ id: string; action: "REMOVE" | "KEEP"; reason: string }[]> {
  if (blocks.length === 0) return [];

  const model = getGeminiModel();

  // Prepare a compact representation for the prompt
  const blockSummaries = blocks.map((b) => ({
    id: b.id,
    text: b.text,
    page: b.page + 1,
    isImage: b.isImage,
  }));

  // Split into batches if needed (very large documents)
  const BATCH_SIZE = 200;
  const results: { id: string; action: "REMOVE" | "KEEP"; reason: string }[] =
    [];

  for (let i = 0; i < blockSummaries.length; i += BATCH_SIZE) {
    const batch = blockSummaries.slice(i, i + BATCH_SIZE);
    const inputJson = JSON.stringify(batch, null, 2);

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${CLASSIFICATION_PROMPT}\n\nBlocks to classify:\n${inputJson}`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
      },
    });

    const responseText =
      response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract JSON from the response (handle markdown fences)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // If Gemini fails to return JSON, default everything to REMOVE for safety
      for (const b of batch) {
        results.push({
          id: b.id,
          action: "REMOVE",
          reason: "AI classification failed — defaulting to REMOVE",
        });
      }
      continue;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        id: string;
        action: string;
        reason: string;
      }[];

      for (const entry of parsed) {
        results.push({
          id: entry.id,
          action: entry.action === "KEEP" ? "KEEP" : "REMOVE",
          reason: entry.reason || "",
        });
      }
    } catch {
      // Parse failure — default to REMOVE
      for (const b of batch) {
        results.push({
          id: b.id,
          action: "REMOVE",
          reason: "AI response parse failure — defaulting to REMOVE",
        });
      }
    }
  }

  return results;
}

async function extractMetadata(
  removedBlocks: TextBlock[]
): Promise<SanitizationAnalysis["metadata"]> {
  const defaultMeta: SanitizationAnalysis["metadata"] = {
    clientDrawingId: null,
    clientCompanyName: null,
    partName: null,
    material: null,
  };

  if (removedBlocks.length === 0) return defaultMeta;

  const model = getGeminiModel();

  const removedTexts = removedBlocks
    .filter((b) => !b.isImage)
    .map((b) => b.text)
    .join("\n");

  if (!removedTexts.trim()) return defaultMeta;

  try {
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${METADATA_PROMPT}\n\nRedacted text blocks:\n${removedTexts}`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.1,
      },
    });

    const responseText =
      response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return defaultMeta;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      clientDrawingId: parsed.clientDrawingId ?? null,
      clientCompanyName: parsed.clientCompanyName ?? null,
      partName: parsed.partName ?? null,
      material: parsed.material ?? null,
    };
  } catch {
    return defaultMeta;
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — Public API
// ---------------------------------------------------------------------------

export async function analyzeForSanitization(
  pdfBuffer: Buffer
): Promise<SanitizationAnalysis> {
  const pdfData = new Uint8Array(pdfBuffer);

  // Step 1: Extract text and image blocks
  const { blocks, pageCount } = await extractTextBlocks(pdfData);

  // Step 2: Classify blocks via Gemini
  const classifications = await classifyBlocks(blocks);

  // Build a lookup map for classifications
  const classMap = new Map(classifications.map((c) => [c.id, c]));

  // Step 3: Merge classifications with blocks
  const redactionBlocks: RedactionBlock[] = blocks.map((block) => {
    const cls = classMap.get(block.id);
    return {
      ...block,
      action: cls?.action ?? "REMOVE", // default to REMOVE if not classified
      reason: cls?.reason ?? "Unclassified — defaulting to REMOVE",
    };
  });

  // Step 4: Extract metadata from removed blocks
  const removedBlocks = blocks.filter((b) => {
    const cls = classMap.get(b.id);
    return cls?.action !== "KEEP";
  });

  const metadata = await extractMetadata(removedBlocks);

  return { blocks: redactionBlocks, metadata, pageCount };
}

// ---------------------------------------------------------------------------
// Phase 2 — Apply redactions using pdf-lib
// ---------------------------------------------------------------------------

export async function applySanitization(
  pdfBuffer: Buffer,
  redactions: RedactionBlock[],
  options: {
    internalId: string;
    companyOverlay?: string;
  }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const companyName = options.companyOverlay ?? "Mechximize";

  // Group redactions by page
  const redactionsByPage = new Map<number, RedactionBlock[]>();
  for (const r of redactions) {
    if (r.action !== "REMOVE") continue;
    const existing = redactionsByPage.get(r.page) ?? [];
    existing.push(r);
    redactionsByPage.set(r.page, existing);
  }

  for (const [pageIdx, pageRedactions] of redactionsByPage) {
    if (pageIdx < 0 || pageIdx >= pages.length) continue;
    const page = pages[pageIdx];

    for (const r of pageRedactions) {
      // Draw a white filled rectangle to cover the original content.
      // pdf-lib uses PDF coordinates (origin bottom-left, y up) which
      // matches what pdf.js text extraction returns.
      const PADDING = 2;
      page.drawRectangle({
        x: r.x - PADDING,
        y: r.y - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
        color: rgb(1, 1, 1), // white
        borderWidth: 0,
      });
    }
  }

  // Add a small overlay stamp on the first page with internal ID and company
  if (pages.length > 0) {
    const firstPage = pages[0];
    const { width } = firstPage.getSize();
    const fontSize = 7;
    const stampText = `${companyName} | ${options.internalId}`;
    const textWidth = font.widthOfTextAtSize(stampText, fontSize);

    // Bottom-right corner
    firstPage.drawText(stampText, {
      x: width - textWidth - 10,
      y: 10,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes);
}
