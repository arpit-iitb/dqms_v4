"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Layers, Upload, Trash2, Eye, Sparkles, CheckCircle2,
  AlertCircle, Loader2, ChevronDown, ChevronUp, History, RefreshCw,
  Box,
} from "lucide-react";

const StepViewer = dynamic(() => import("./step-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-slate-50 rounded-lg border">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-xs">Loading 3D viewer...</span>
      </div>
    </div>
  ),
});

interface FileRecord {
  id: string;
  fileType: "STEP" | "DRAWING_PDF";
  fileName: string;
  version: number;
  isLatest: boolean;
  internalDrawingId: string | null;
  createdAt: string;
  aiSanitizedAt: string | null;
  derivatives: { id: string; type: string; status: string }[];
}

interface Props {
  partId: string;
  onUpdate: () => void;
}

function FileIcon({ type }: { type: string }) {
  if (type === "DRAWING_PDF") return <FileText className="h-5 w-5 text-red-500" />;
  return <Layers className="h-5 w-5 text-blue-500" />;
}

function PdfViewer({
  fileId,
  isSanitized,
}: {
  fileId: string;
  isSanitized: boolean;
}) {
  const [showSanitized, setShowSanitized] = useState(isSanitized);
  const src = showSanitized && isSanitized
    ? `/api/files/${fileId}/masked`
    : `/api/files/${fileId}/serve`;

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      {isSanitized && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">View:</span>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              onClick={() => setShowSanitized(false)}
              className={`px-3 py-1.5 transition-colors ${!showSanitized ? "bg-slate-800 text-white font-medium" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Original
            </button>
            <button
              onClick={() => setShowSanitized(true)}
              className={`px-3 py-1.5 transition-colors ${showSanitized ? "bg-emerald-600 text-white font-medium" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Sanitized
            </button>
          </div>
          {showSanitized && (
            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Masked
            </Badge>
          )}
        </div>
      )}
      <div className="rounded border overflow-hidden bg-slate-100" style={{ height: "600px" }}>
        <iframe
          key={src}
          src={src}
          title="Drawing PDF"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

function FileRow({
  file,
  onDelete,
  onSanitize,
  onUploadRevision,
  sanitizing,
  revisionUploading,
}: {
  file: FileRecord;
  onDelete: (id: string) => void;
  onSanitize: (id: string) => void;
  onUploadRevision: (f: File, type: "STEP" | "DRAWING_PDF") => void;
  sanitizing: string | null;
  revisionUploading: string | null;
}) {
  const maskedDerivative = file.derivatives.find((d) => d.type === "MASKED");
  const isSanitized = !!file.aiSanitizedAt && maskedDerivative?.status === "READY";
  const isThisSanitizing = sanitizing === file.id;
  const isPdf = file.fileType === "DRAWING_PDF";
  const isStep = file.fileType === "STEP";
  const [expanded, setExpanded] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const revInputRef = useRef<HTMLInputElement>(null);
  const isRevUploading = revisionUploading === file.fileType;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <FileIcon type={file.fileType} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{file.fileName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {file.fileType === "DRAWING_PDF" ? "Drawing PDF" : "STEP File"} · v{file.version}
              </span>
              {file.internalDrawingId && (
                <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-200 font-mono">
                  {file.internalDrawingId}
                </Badge>
              )}
              {isSanitized && (
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Sanitized
                </Badge>
              )}
              {maskedDerivative && maskedDerivative.status === "PROCESSING" && (
                <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Processing...</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Upload Revision */}
            <input
              ref={revInputRef}
              type="file"
              accept={isPdf ? ".pdf" : ".step,.stp"}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadRevision(f, file.fileType);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              title="Upload Revision"
              onClick={() => revInputRef.current?.click()}
              disabled={isRevUploading}
            >
              {isRevUploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            {/* Expand PDF inline */}
            {isPdf && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs gap-1 ${expanded ? "text-blue-600 bg-blue-50" : ""}`}
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? "Collapse" : "View PDF"}
              >
                <Eye className="h-3.5 w-3.5" />
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
            {/* 3D Viewer toggle for STEP files */}
            {isStep && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs gap-1 ${show3D ? "text-blue-600 bg-blue-50" : ""}`}
                onClick={() => setShow3D((v) => !v)}
                title={show3D ? "Close 3D Viewer" : "View 3D"}
              >
                <Box className="h-3.5 w-3.5" />
                {show3D ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
            {/* Download link for non-PDF */}
            {!isPdf && (
              <a href={`/api/files/${file.id}/serve`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
            {/* AI Sanitize button */}
            {isPdf && !isSanitized && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                title="AI Sanitize"
                onClick={() => onSanitize(file.id)}
                disabled={isThisSanitizing}
              >
                {isThisSanitizing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
              </Button>
            )}
            {isPdf && isThisSanitizing && (
              <span className="text-xs text-purple-600 ml-1">Sanitizing...</span>
            )}
            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
              title="Delete"
              onClick={() => onDelete(file.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Inline PDF viewer */}
        {isPdf && expanded && (
          <PdfViewer fileId={file.id} isSanitized={isSanitized} />
        )}

        {/* Inline 3D viewer for STEP files */}
        {isStep && show3D && (
          <div className="mt-3 border-t pt-3">
            <StepViewer fileId={file.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UploadBox({
  type,
  label,
  accept,
  onUpload,
  uploading,
}: {
  type: "STEP" | "DRAWING_PDF";
  label: string;
  accept: string;
  onUpload: (file: File, type: "STEP" | "DRAWING_PDF") => void;
  uploading: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploading === type;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f, type);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full h-16 border-dashed flex flex-col gap-1"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Upload className="h-4 w-4" />}
        <span className="text-xs">{isUploading ? "Uploading..." : `Upload ${label}`}</span>
      </Button>
    </div>
  );
}

function RevisionHistory({ partId }: { partId: string }) {
  const [history, setHistory] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadHistory = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    const res = await fetch(`/api/parts/${partId}/files?history=true`);
    const d = await res.json();
    if (res.ok) {
      // Only show older versions (not the latest)
      setHistory((d.files ?? []).filter((f: FileRecord) => !f.isLatest));
      setLoaded(true);
    }
    setLoading(false);
  }, [partId, loaded]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadHistory();
  };

  return (
    <div className="border rounded-md">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        Revision History
        {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-1.5">
          {loading && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading history...
            </div>
          )}
          {!loading && history.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No previous revisions.</p>
          )}
          {history.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
              <FileIcon type={f.fileType} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {f.fileType === "DRAWING_PDF" ? "Drawing PDF" : "STEP"} · v{f.version}
                  </span>
                  {f.internalDrawingId && (
                    <span className="text-xs font-mono text-slate-500">{f.internalDrawingId}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(f.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <a href={`/api/files/${f.id}/serve`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                  <Eye className="h-3 w-3" /> View
                </Button>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilesTab({ partId, onUpdate }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [revisionUploading, setRevisionUploading] = useState<string | null>(null);
  const [sanitizing, setSanitizing] = useState<string | null>(null);
  const [sanitizeError, setSanitizeError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const res = await fetch(`/api/parts/${partId}/files`);
    const d = await res.json();
    if (!res.ok) { setLoadError(d.error || "Failed to load files"); return; }
    setFiles(d.files ?? []);
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file: File, type: "STEP" | "DRAWING_PDF") => {
    setUploading(type);
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await fetch(`/api/parts/${partId}/files`, { method: "POST", body: form });
    setUploading(null);
    if (!res.ok) {
      const d = await res.json();
      setLoadError(d.error || "Upload failed");
    } else {
      load();
      onUpdate();
    }
  };

  const handleRevisionUpload = async (file: File, type: "STEP" | "DRAWING_PDF") => {
    setRevisionUploading(type);
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("isRevision", "true");
    const res = await fetch(`/api/parts/${partId}/files`, { method: "POST", body: form });
    setRevisionUploading(null);
    if (!res.ok) {
      const d = await res.json();
      setLoadError(d.error || "Revision upload failed");
    } else {
      load();
      onUpdate();
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    load();
    onUpdate();
  };

  // Sanitization state for preview flow
  const [previewData, setPreviewData] = useState<{
    fileId: string;
    blocks: any[];
    metadata: any;
    pageCount: number;
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const handleSanitize = async (fileId: string) => {
    setSanitizing(fileId);
    setSanitizeError("");
    // Phase 1: Analyze
    const res = await fetch(`/api/parts/${partId}/sanitize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, action: "analyze" }),
    });
    setSanitizing(null);
    if (!res.ok) {
      const d = await res.json();
      setSanitizeError(d.error || "Sanitization analysis failed");
    } else {
      const data = await res.json();
      setPreviewData({ fileId, ...data });
    }
  };

  const handleApplySanitization = async () => {
    if (!previewData) return;
    setApplying(true);
    setSanitizeError("");
    const res = await fetch(`/api/parts/${partId}/sanitize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: previewData.fileId,
        action: "apply",
        redactions: previewData.blocks.filter((b: any) => b.action === "REMOVE"),
        metadata: previewData.metadata,
      }),
    });
    setApplying(false);
    if (!res.ok) {
      const d = await res.json();
      setSanitizeError(d.error || "Sanitization failed");
    } else {
      setPreviewData(null);
      load();
      onUpdate();
    }
  };

  const toggleRedactionBlock = (blockId: string) => {
    if (!previewData) return;
    setPreviewData({
      ...previewData,
      blocks: previewData.blocks.map((b: any) =>
        b.id === blockId
          ? { ...b, action: b.action === "REMOVE" ? "KEEP" : "REMOVE" }
          : b
      ),
    });
  };

  const hasPdf = files.some((f) => f.fileType === "DRAWING_PDF");
  const hasStep = files.some((f) => f.fileType === "STEP");

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-2">
          <AlertCircle className="h-4 w-4" /> {loadError}
        </div>
      )}
      {sanitizeError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-2">
          <AlertCircle className="h-4 w-4" /> {sanitizeError}
        </div>
      )}

      {/* Sanitization Preview */}
      {previewData && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Sanitization Preview
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPreviewData(null)}
                  disabled={applying}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleApplySanitization}
                  disabled={applying}
                >
                  {applying ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Applying...</> : "Apply Redactions"}
                </Button>
              </div>
            </div>

            {previewData.metadata?.clientDrawingId && (
              <div className="text-xs text-slate-600">
                Detected: <span className="font-medium">{previewData.metadata.clientDrawingId}</span>
                {previewData.metadata.clientCompanyName && <> by <span className="font-medium">{previewData.metadata.clientCompanyName}</span></>}
              </div>
            )}

            <div className="text-xs text-slate-500 mb-1">
              {previewData.blocks.filter((b: any) => b.action === "REMOVE").length} blocks to redact · {previewData.blocks.filter((b: any) => b.action === "KEEP").length} kept · Click to toggle
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 border rounded bg-white p-2">
              {previewData.blocks.map((block: any) => (
                <button
                  key={block.id}
                  onClick={() => toggleRedactionBlock(block.id)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    block.action === "REMOVE"
                      ? "bg-red-50 hover:bg-red-100 border border-red-200"
                      : "bg-green-50 hover:bg-green-100 border border-green-200"
                  }`}
                >
                  <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    block.action === "REMOVE" ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
                  }`}>
                    {block.action === "REMOVE" ? "REMOVE" : "KEEP"}
                  </span>
                  <span className="flex-1 truncate font-mono text-slate-700">
                    {block.isImage ? "[Image]" : block.text}
                  </span>
                  <span className="flex-shrink-0 text-slate-400">p{block.page + 1}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onDelete={handleDelete}
              onSanitize={handleSanitize}
              onUploadRevision={handleRevisionUpload}
              sanitizing={sanitizing}
              revisionUploading={revisionUploading}
            />
          ))}
        </div>
      )}

      {/* Upload slots */}
      <div className="grid grid-cols-2 gap-3">
        {!hasPdf && (
          <UploadBox
            type="DRAWING_PDF"
            label="Drawing PDF"
            accept=".pdf"
            onUpload={handleUpload}
            uploading={uploading}
          />
        )}
        {!hasStep && (
          <UploadBox
            type="STEP"
            label="STEP File"
            accept=".step,.stp"
            onUpload={handleUpload}
            uploading={uploading}
          />
        )}
      </div>

      {hasPdf && hasStep && files.length === 2 && (
        <p className="text-xs text-center text-muted-foreground">
          Both files uploaded. Use the revision button to upload a new version.
        </p>
      )}

      {files.length === 0 && !loadError && (
        <p className="text-xs text-center text-muted-foreground py-4">
          No files yet. Upload a Drawing PDF and STEP file.
        </p>
      )}

      {/* Revision History */}
      {files.length > 0 && (
        <RevisionHistory partId={partId} />
      )}
    </div>
  );
}
