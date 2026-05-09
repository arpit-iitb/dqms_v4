"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Box, X, Wand2, Check, Loader2, ChevronRight, ChevronLeft,
  AlertCircle, CheckCircle2, Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface UploadedFile {
  id: string;       // client-side id
  file: File;
  name: string;
  type: "pdf" | "step";
}

interface FilePair {
  id: string;
  pdf: UploadedFile | null;
  step: UploadedFile | null;
  label: string;
}

interface CreatedPart {
  id: string;
  publicId: string;
  pairId: string;
}

interface ExtractionResult {
  partId: string;
  partName: string | null;
  materialName: string | null;
  materialGrade: string | null;
  surfaceTreatment: string | null;
  quantity: number | null;
  clientPartId: string | null;
}

interface PartRow {
  id: string;
  publicId: string;
  partName: string;
  materialName: string;
  materialGrade: string;
  surfaceTreatment: string;
  quantity: string;
  clientPartId: string;
}

type Stage = "upload" | "pair" | "create" | "review";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let _fileCounter = 0;
function nextFileId() {
  return `f-${++_fileCounter}-${Date.now()}`;
}

let _pairCounter = 0;
function nextPairId() {
  return `pair-${++_pairCounter}-${Date.now()}`;
}

function detectFileType(name: string): "pdf" | "step" | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "step" || ext === "stp") return "step";
  return null;
}

function fileStem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.substring(0, dot).toLowerCase().trim() : name.toLowerCase().trim();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function BulkPartsDialog({
  open,
  onOpenChange,
  leadId,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<Stage>("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pairs, setPairs] = useState<FilePair[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [createdParts, setCreatedParts] = useState<CreatedPart[]>([]);
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ---- reset on close ----
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStage("upload");
      setFiles([]);
      setPairs([]);
      setSelectedFileIds(new Set());
      setCreatedParts([]);
      setPartRows([]);
      setProgressMsg("");
      setError("");
      setSaving(false);
    }
    onOpenChange(v);
  };

  // ---- file IDs already used in pairs ----
  const pairedFileIds = new Set(
    pairs.flatMap((p) => [p.pdf?.id, p.step?.id].filter(Boolean) as string[]),
  );

  const unpairedFiles = files.filter((f) => !pairedFileIds.has(f.id));

  // ---- Stage 1: Upload ----

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
    for (const f of Array.from(fileList)) {
      const t = detectFileType(f.name);
      if (!t) continue;
      newFiles.push({ id: nextFileId(), file: f, name: f.name, type: t });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    // Also remove from pairs if it was paired
    setPairs((prev) =>
      prev
        .map((p) => {
          if (p.pdf?.id === id) return { ...p, pdf: null, label: p.step?.name ? fileStem(p.step.name) : p.label };
          if (p.step?.id === id) return { ...p, step: null, label: p.pdf?.name ? fileStem(p.pdf.name) : p.label };
          return p;
        })
        .filter((p) => p.pdf || p.step),
    );
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  // ---- Stage 2: Pairing ----

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createPairFromSelection = () => {
    const selected = unpairedFiles.filter((f) => selectedFileIds.has(f.id));
    const pdfs = selected.filter((f) => f.type === "pdf");
    const steps = selected.filter((f) => f.type === "step");

    if (pdfs.length > 1 || steps.length > 1) {
      setError("Select at most 1 PDF and 1 STEP file");
      return;
    }
    if (pdfs.length === 0 && steps.length === 0) {
      setError("Select at least one file");
      return;
    }

    const pdf = pdfs[0] || null;
    const step = steps[0] || null;
    const label = fileStem((pdf || step)!.name);

    setPairs((prev) => [...prev, { id: nextPairId(), pdf, step, label }]);
    setSelectedFileIds(new Set());
    setError("");
  };

  const autoPair = () => {
    const unpaired = files.filter((f) => !pairedFileIds.has(f.id));
    const byName = new Map<string, { pdfs: UploadedFile[]; steps: UploadedFile[] }>();

    for (const f of unpaired) {
      const stem = fileStem(f.name);
      if (!byName.has(stem)) byName.set(stem, { pdfs: [], steps: [] });
      const entry = byName.get(stem)!;
      if (f.type === "pdf") entry.pdfs.push(f);
      else entry.steps.push(f);
    }

    const newPairs: FilePair[] = [];
    const usedIds = new Set<string>();

    for (const [stem, { pdfs, steps }] of byName) {
      // Pair first pdf with first step
      const pdf = pdfs[0] || null;
      const step = steps[0] || null;
      if (pdf || step) {
        if (pdf) usedIds.add(pdf.id);
        if (step) usedIds.add(step.id);
        newPairs.push({ id: nextPairId(), pdf, step, label: stem });
      }
    }

    // Any remaining unpaired files become single-file pairs
    for (const f of unpaired) {
      if (usedIds.has(f.id)) continue;
      usedIds.add(f.id);
      newPairs.push({
        id: nextPairId(),
        pdf: f.type === "pdf" ? f : null,
        step: f.type === "step" ? f : null,
        label: fileStem(f.name),
      });
    }

    if (newPairs.length > 0) {
      setPairs((prev) => [...prev, ...newPairs]);
    }
  };

  const removePair = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
  };

  // ---- Stage 3: Create & Extract ----

  const handleCreateAndExtract = async () => {
    setStage("create");
    setError("");
    setProgressMsg("Creating parts...");

    try {
      // 1. Bulk create parts
      const bulkBody = { parts: pairs.map(() => ({})) };
      const bulkRes = await fetch(`/api/leads/${leadId}/parts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkBody),
      });

      if (!bulkRes.ok) {
        const d = await bulkRes.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create parts");
      }

      const { parts: createdArr } = await bulkRes.json();
      const mapped: CreatedPart[] = createdArr.map((p: any, i: number) => ({
        id: p.id,
        publicId: p.publicId,
        pairId: pairs[i].id,
      }));
      setCreatedParts(mapped);

      // 2. Upload files to each part
      setProgressMsg("Uploading files...");
      const partIdsWithPdfs: string[] = [];

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const part = mapped[i];

        if (pair.pdf) {
          const form = new FormData();
          form.append("file", pair.pdf.file);
          form.append("type", "DRAWING_PDF");
          await fetch(`/api/parts/${part.id}/files`, { method: "POST", body: form });
          partIdsWithPdfs.push(part.id);
        }

        if (pair.step) {
          const form = new FormData();
          form.append("file", pair.step.file);
          form.append("type", "STEP");
          await fetch(`/api/parts/${part.id}/files`, { method: "POST", body: form });
        }

        setProgressMsg(`Uploading files... (${i + 1}/${pairs.length})`);
      }

      // 3. Extract info from PDFs via LLM
      let extractionResults: ExtractionResult[] = [];
      if (partIdsWithPdfs.length > 0) {
        setProgressMsg("Extracting info from drawings (AI)...");
        try {
          const extractRes = await fetch(`/api/leads/${leadId}/parts/extract-info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partIds: partIdsWithPdfs }),
          });
          if (extractRes.ok) {
            const extractData = await extractRes.json();
            extractionResults = extractData.results ?? [];
          }
        } catch {
          // LLM extraction failed — proceed without it
        }
      }

      // 4. Build rows for review
      const extractMap = new Map(extractionResults.map((r) => [r.partId, r]));

      const rows: PartRow[] = mapped.map((cp) => {
        const ext = extractMap.get(cp.id);
        return {
          id: cp.id,
          publicId: cp.publicId,
          partName: ext?.partName ?? "",
          materialName: ext?.materialName ?? "",
          materialGrade: ext?.materialGrade ?? "",
          surfaceTreatment: ext?.surfaceTreatment ?? "",
          quantity: ext?.quantity?.toString() ?? "1",
          clientPartId: ext?.clientPartId ?? "",
        };
      });

      setPartRows(rows);
      setProgressMsg("");
      setStage("review");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setProgressMsg("");
      setStage("pair"); // go back so user can retry
    }
  };

  // ---- Stage 4: Review & Save ----

  const updateRow = (idx: number, field: keyof PartRow, value: string) => {
    setPartRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError("");

    try {
      await Promise.all(
        partRows.map((row) =>
          fetch(`/api/parts/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partName: row.partName || null,
              materialName: row.materialName || null,
              materialGrade: row.materialGrade || null,
              surfaceTreatment: row.surfaceTreatment || null,
              quantity: parseInt(row.quantity, 10) || 1,
              clientPartId: row.clientPartId || undefined,
            }),
          }),
        ),
      );

      onComplete();
      handleOpenChange(false);
    } catch {
      setError("Failed to save some part updates");
    } finally {
      setSaving(false);
    }
  };

  // ---- Render ----

  const stageIndex = { upload: 0, pair: 1, create: 2, review: 3 }[stage];
  const stageLabels = ["Upload Files", "Pair Files", "Creating...", "Review & Save"];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Add Parts</DialogTitle>
          {/* Progress steps */}
          <div className="flex items-center gap-1 pt-2">
            {stageLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                {i > 0 && <div className="w-6 h-px bg-slate-200" />}
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                    i === stageIndex
                      ? "bg-blue-100 text-blue-700"
                      : i < stageIndex
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i < stageIndex ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="w-4 text-center">{i + 1}</span>
                  )}
                  {label}
                </div>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {/* ---- Stage 1: Upload ---- */}
          {stage === "upload" && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accepts .pdf, .step, .stp files
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.step,.stp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        {f.type === "pdf" ? (
                          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <Box className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{f.name}</span>
                        <Badge className={`text-xs ${f.type === "pdf" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {f.type.toUpperCase()}
                        </Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Stage 2: Pair ---- */}
          {stage === "pair" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Unpaired files */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">
                      Unpaired Files ({unpairedFiles.length})
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={autoPair}
                      disabled={unpairedFiles.length === 0}
                    >
                      <Wand2 className="h-3 w-3 mr-1" /> Auto-Pair
                    </Button>
                  </div>

                  {unpairedFiles.length === 0 ? (
                    <div className="border-2 border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
                      All files paired
                    </div>
                  ) : (
                    <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                      {unpairedFiles.map((f) => (
                        <label
                          key={f.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${
                            selectedFileIds.has(f.id) ? "bg-blue-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFileIds.has(f.id)}
                            onChange={() => toggleFileSelection(f.id)}
                            className="flex-shrink-0"
                          />
                          {f.type === "pdf" ? (
                            <FileText className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          ) : (
                            <Box className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1 text-xs">{f.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {selectedFileIds.size > 0 && (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={createPairFromSelection}
                    >
                      Create Pair ({selectedFileIds.size} selected)
                    </Button>
                  )}
                </div>

                {/* Right: Pairs */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Parts ({pairs.length})
                  </p>

                  {pairs.length === 0 ? (
                    <div className="border-2 border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
                      No pairs yet. Select files and pair them, or use Auto-Pair.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {pairs.map((pair, i) => (
                        <div key={pair.id} className="border rounded-md p-3 bg-white">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-slate-700">
                              Part {i + 1}
                            </span>
                            <button
                              onClick={() => removePair(pair.id)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="space-y-1 text-xs">
                            {pair.pdf && (
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3 w-3 text-red-500" />
                                <span className="truncate">{pair.pdf.name}</span>
                              </div>
                            )}
                            {pair.step && (
                              <div className="flex items-center gap-1.5">
                                <Box className="h-3 w-3 text-blue-500" />
                                <span className="truncate">{pair.step.name}</span>
                              </div>
                            )}
                            {!pair.pdf && !pair.step && (
                              <span className="text-muted-foreground">Empty pair</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ---- Stage 3: Creating ---- */}
          {stage === "create" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600">{progressMsg}</p>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ---- Stage 4: Review ---- */}
          {stage === "review" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Review and edit the auto-extracted information below, then click Save All.
              </p>

              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Drawing ID</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Part Name</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Material</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Grade</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Surface Treatment</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap w-16">Qty</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Client Part ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {partRows.map((row, i) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-1.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {row.publicId}
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.partName}
                            onChange={(e) => updateRow(i, "partName", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Part name"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.materialName}
                            onChange={(e) => updateRow(i, "materialName", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Material"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.materialGrade}
                            onChange={(e) => updateRow(i, "materialGrade", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Grade"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.surfaceTreatment}
                            onChange={(e) => updateRow(i, "surfaceTreatment", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Treatment"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.quantity}
                            onChange={(e) => updateRow(i, "quantity", e.target.value)}
                            className="h-7 text-xs w-16"
                            type="number"
                            min={1}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={row.clientPartId}
                            onChange={(e) => updateRow(i, "clientPartId", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Client ID"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Footer ---- */}
        <DialogFooter className="gap-2 pt-2 border-t">
          {stage === "upload" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStage("pair")}
                disabled={files.length === 0}
              >
                Next: Pair Files <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {stage === "pair" && (
            <>
              <Button variant="outline" onClick={() => setStage("upload")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleCreateAndExtract}
                disabled={pairs.length === 0}
              >
                Create {pairs.length} Part{pairs.length !== 1 ? "s" : ""}{" "}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {stage === "create" && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing...
            </Button>
          )}

          {stage === "review" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAll} disabled={saving}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save All"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
