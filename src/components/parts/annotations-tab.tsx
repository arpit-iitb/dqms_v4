"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trash2, Square, MessageSquare, Ruler, Eye, EyeOff, MousePointer,
  FileText, ZoomIn, ZoomOut, Loader2,
} from "lucide-react";

type AnnotationType = "MASK" | "NOTE" | "CRITICAL_DIM";

interface Coordinates {
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
}

interface Annotation {
  id: string;
  type: AnnotationType;
  coordinates: Coordinates;
  content: string | null;
  createdAt: string;
}

interface DrawingFile {
  id: string;
  fileName: string;
  fileType: string;
  aiSanitizedAt: string | null;
  derivatives: { type: string; status: string }[];
}

interface Props {
  partId: string;
  onUpdate?: () => void;
}

const TYPE_CONFIG: Record<AnnotationType, { label: string; fillColor: string; borderColor: string; icon: React.ElementType }> = {
  MASK:         { label: "Mask",         fillColor: "rgba(0,0,0,0.65)",       borderColor: "#1e293b", icon: Square       },
  NOTE:         { label: "Note",         fillColor: "rgba(251,191,36,0.25)",  borderColor: "#d97706", icon: MessageSquare },
  CRITICAL_DIM: { label: "Critical Dim", fillColor: "rgba(239,68,68,0.10)",   borderColor: "#dc2626", icon: Ruler        },
};

// Canvas dimensions (A4 at 96dpi)
const CANVAS_W = 794;
const CANVAS_H = 1123;

export function AnnotationsTab({ partId, onUpdate }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawingFile, setDrawingFile] = useState<DrawingFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<AnnotationType | "SELECT">("SELECT");
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [zoom, setZoom] = useState(1);
  const [extracting, setExtracting] = useState(false);
  const [useSanitized, setUseSanitized] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const load = useCallback(async () => {
    const [annRes, fileRes] = await Promise.all([
      fetch(`/api/parts/${partId}/annotations`),
      fetch(`/api/parts/${partId}/files`),
    ]);
    const [annData, fileData] = await Promise.all([annRes.json(), fileRes.json()]);
    setAnnotations(annData.annotations ?? []);

    const pdfFile = (fileData.files ?? []).find((f: DrawingFile) => f.fileType === "DRAWING_PDF");
    setDrawingFile(pdfFile ?? null);

    // Default to sanitized view if available
    if (pdfFile?.aiSanitizedAt && pdfFile.derivatives?.some((d: any) => d.type === "MASKED" && d.status === "READY")) {
      setUseSanitized(true);
    }
    setLoading(false);
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!showAnnotations) return;

    const w = canvas.width;
    const h = canvas.height;

    for (const ann of annotations) {
      const co = ann.coordinates;
      const rx = co.x * w;
      const ry = co.y * h;
      const rw = co.w * w;
      const rh = co.h * h;
      const cfg = TYPE_CONFIG[ann.type];

      // Fill + border
      ctx.fillStyle = cfg.fillColor;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = cfg.borderColor;
      ctx.lineWidth = ann.type === "CRITICAL_DIM" ? 1.5 : 2;
      ctx.setLineDash([]);
      ctx.strokeRect(rx, ry, rw, rh);

      if (ann.content) {
        ctx.font = "bold 11px sans-serif";
        const label = ann.content;
        const textW = ctx.measureText(label).width;

        if (ann.type === "CRITICAL_DIM") {
          // Draw label OUTSIDE and ABOVE the rectangle, with a small connector
          const labelX = rx;
          const labelY = ry - 6;

          // Background pill
          ctx.fillStyle = "rgba(220,38,38,0.9)";
          ctx.beginPath();
          const pad = 4;
          ctx.roundRect(labelX - pad, labelY - 12, textW + pad * 2, 14, 3);
          ctx.fill();

          ctx.fillStyle = "white";
          ctx.fillText(label, labelX, labelY);
        } else {
          // For NOTE/MASK: draw inside
          ctx.fillStyle = cfg.borderColor;
          ctx.fillText(label, rx + 4, ry + 13, rw - 8);
        }
      }
    }

    // In-progress rect
    if (currentRect && drawing) {
      const cfg = TYPE_CONFIG[tool as AnnotationType];
      if (cfg) {
        ctx.fillStyle = cfg.fillColor;
        ctx.fillRect(currentRect.x * w, currentRect.y * h, currentRect.w * w, currentRect.h * h);
        ctx.strokeStyle = cfg.borderColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(currentRect.x * w, currentRect.y * h, currentRect.w * w, currentRect.h * h);
        ctx.setLineDash([]);
      }
    }
  }, [annotations, showAnnotations, currentRect, drawing, tool]);

  const getRelativePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "SELECT") return;
    const pt = getRelativePos(e);
    setStartPt(pt);
    setDrawing(true);
    setCurrentRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPt) return;
    const pt = getRelativePos(e);
    setCurrentRect({
      x: Math.min(startPt.x, pt.x),
      y: Math.min(startPt.y, pt.y),
      w: Math.abs(pt.x - startPt.x),
      h: Math.abs(pt.y - startPt.y),
    });
  };

  const onMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPt || tool === "SELECT") return;
    const pt = getRelativePos(e);
    const x = Math.min(startPt.x, pt.x);
    const y = Math.min(startPt.y, pt.y);
    const w = Math.abs(pt.x - startPt.x);
    const h = Math.abs(pt.y - startPt.y);

    setDrawing(false);
    setStartPt(null);
    setCurrentRect(null);

    if (w < 0.01 || h < 0.01) return;

    // For CRITICAL_DIM: extract text from the selected region first
    let extractedText = "";
    if (tool === "CRITICAL_DIM" && drawingFile) {
      setExtracting(true);
      try {
        const res = await fetch(`/api/parts/${partId}/extract-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: drawingFile.id,
            x0: x,
            y0: y,
            x1: x + w,
            y1: y + h,
            page: 0,
          }),
        });
        const d = await res.json();
        extractedText = (d.text || "").trim();
      } catch { /* ignore, user can type manually */ }
      setExtracting(false);
    }

    const res = await fetch(`/api/parts/${partId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: tool,
        coordinates: { x, y, w, h, page: 1 },
        content: extractedText || null,
      }),
    });
    const d = await res.json();
    if (d.annotation) {
      setAnnotations((prev) => [...prev, d.annotation]);

      if (tool === "CRITICAL_DIM") {
        // Auto-create a dimension record with extracted text
        const dimCount = annotations.filter((a) => a.type === "CRITICAL_DIM").length + 1;
        const dimName = `D${dimCount}`;
        const rawText = extractedText || `Dimension ${dimCount}`;

        await fetch(`/api/parts/${partId}/dimensions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: dimName, rawText }),
        });

        // Also update annotation content with dim name if no text was extracted
        if (!extractedText) {
          await fetch(`/api/parts/annotations/${d.annotation.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: dimName }),
          });
          setAnnotations((prev) =>
            prev.map((a) => a.id === d.annotation.id ? { ...a, content: dimName } : a)
          );
        } else {
          // Set label as D{n}: value
          const label = `D${dimCount}`;
          await fetch(`/api/parts/annotations/${d.annotation.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: label }),
          });
          setAnnotations((prev) =>
            prev.map((a) => a.id === d.annotation.id ? { ...a, content: label } : a)
          );

          // Update dimension with extracted text as spec
          // Re-fetch to get the created dimension ID and update its rawText
          // (already set correctly in the create call above)
        }
      } else if (tool !== "MASK") {
        // Open label editor for NOTE
        setEditingId(d.annotation.id);
        setEditContent(extractedText);
      }
    }
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/parts/annotations/${id}`, { method: "DELETE" });
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    onUpdate?.();
  };

  const handleSaveContent = async (id: string) => {
    await fetch(`/api/parts/annotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, content: editContent } : a));
    setEditingId(null);
  };

  const isSanitized = !!(
    drawingFile?.aiSanitizedAt &&
    drawingFile.derivatives?.some((d) => d.type === "MASKED" && d.status === "READY")
  );

  const pdfSrc = drawingFile
    ? (useSanitized && isSanitized
        ? `/api/files/${drawingFile.id}/masked`
        : `/api/files/${drawingFile.id}/serve`)
    : null;

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap p-2 bg-slate-50 rounded-lg border">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Tool:</span>
        {[
          { id: "SELECT" as const, label: "Select", icon: MousePointer },
          { id: "MASK" as const, label: "Mask", icon: Square },
          { id: "NOTE" as const, label: "Note", icon: MessageSquare },
          { id: "CRITICAL_DIM" as const, label: "Crit. Dim", icon: Ruler },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${tool === id ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
        <div className="flex-1" />

        {/* Raw/sanitized toggle */}
        {isSanitized && (
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => setUseSanitized(false)}
              className={`px-2.5 py-1.5 transition-colors ${!useSanitized ? "bg-slate-800 text-white font-medium" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Original
            </button>
            <button
              onClick={() => setUseSanitized(true)}
              className={`px-2.5 py-1.5 transition-colors ${useSanitized ? "bg-emerald-600 text-white font-medium" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Sanitized
            </button>
          </div>
        )}

        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
          className="h-7 w-7 rounded border border-slate-200 hover:border-slate-300 flex items-center justify-center"
        ><ZoomIn className="h-3.5 w-3.5" /></button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          className="h-7 w-7 rounded border border-slate-200 hover:border-slate-300 flex items-center justify-center"
        ><ZoomOut className="h-3.5 w-3.5" /></button>
        <button
          onClick={() => setShowAnnotations((v) => !v)}
          className={`h-7 w-7 rounded border flex items-center justify-center transition-colors ${showAnnotations ? "border-blue-300 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-400"}`}
        >{showAnnotations ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>

        {extracting && (
          <span className="text-xs text-blue-600 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Extracting text...
          </span>
        )}
      </div>

      {tool === "CRITICAL_DIM" && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
          Draw a box around a dimension value — text will be extracted automatically and added to the Dimensions tab.
        </p>
      )}

      {/* Main drawing area */}
      <div className="flex gap-4">
        {/* Canvas + PDF */}
        <div className="flex-1 min-w-0 overflow-auto border rounded-lg bg-slate-100">
          {!pdfSrc ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No drawing PDF uploaded for this part.</p>
              <p className="text-xs mt-1">Upload a DRAWING_PDF in the Files tab first.</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative inline-block"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            >
              <iframe
                key={pdfSrc}
                src={pdfSrc}
                title="Drawing PDF"
                className="block border-0"
                style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }}
              />
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0"
                style={{
                  cursor: tool === "SELECT" ? "default" : "crosshair",
                  touchAction: "none",
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={() => { if (drawing) { setDrawing(false); setStartPt(null); setCurrentRect(null); } }}
              />
            </div>
          )}
        </div>

        {/* Annotation list panel */}
        <div className="w-60 flex-shrink-0 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Annotations ({annotations.length})
          </p>
          {annotations.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {pdfSrc ? "Draw on the PDF to add annotations." : "Upload a drawing first."}
            </p>
          ) : (
            annotations.map((ann, i) => {
              const cfg = TYPE_CONFIG[ann.type];
              const Icon = cfg.icon;
              return (
                <Card key={ann.id} className={`${editingId === ann.id ? "ring-1 ring-blue-300" : ""}`}>
                  <CardContent className="p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge
                        className="text-xs px-1.5 py-0 flex items-center gap-1"
                        style={{
                          background: cfg.fillColor.replace(/[\d.]+\)$/, "0.35)"),
                          color: cfg.borderColor,
                          border: `1px solid ${cfg.borderColor}`,
                        }}
                      >
                        <Icon className="h-3 w-3" />{cfg.label}
                      </Badge>
                      <div className="flex gap-1">
                        <button
                          className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-blue-600 rounded"
                          onClick={() => { setEditingId(ann.id); setEditContent(ann.content ?? ""); }}
                        >
                          <MessageSquare className="h-3 w-3" />
                        </button>
                        <button
                          className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-red-600 rounded"
                          onClick={() => handleDelete(ann.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      #{i + 1}
                    </p>
                    {ann.content && (
                      <p className="text-xs text-slate-700 truncate font-medium" title={ann.content}>{ann.content}</p>
                    )}
                    {editingId === ann.id && (
                      <div className="flex gap-1 mt-1">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveContent(ann.id); if (e.key === "Escape") setEditingId(null); }}
                          placeholder="Label..."
                          className="h-6 text-xs flex-1"
                          autoFocus
                        />
                        <Button size="sm" className="h-6 px-2 text-xs" onClick={() => handleSaveContent(ann.id)}>
                          OK
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
