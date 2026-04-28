"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Layers, Upload, Trash2, Eye, Sparkles, CheckCircle2,
  AlertCircle, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

interface FileRecord {
  id: string;
  fileType: "STEP" | "DRAWING_PDF";
  fileName: string;
  version: number;
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
  sanitizing,
}: {
  file: FileRecord;
  onDelete: (id: string) => void;
  onSanitize: (id: string) => void;
  sanitizing: string | null;
}) {
  const maskedDerivative = file.derivatives.find((d) => d.type === "MASKED");
  const isSanitized = !!file.aiSanitizedAt && maskedDerivative?.status === "READY";
  const isThisSanitizing = sanitizing === file.id;
  const isPdf = file.fileType === "DRAWING_PDF";
  const [expanded, setExpanded] = useState(false);

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
            {/* View original in new tab (non-PDF) */}
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

export function FilesTab({ partId, onUpdate }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
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

  const handleDelete = async (fileId: string) => {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    load();
    onUpdate();
  };

  const handleSanitize = async (fileId: string) => {
    setSanitizing(fileId);
    setSanitizeError("");
    const res = await fetch(`/api/parts/${partId}/sanitize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    setSanitizing(null);
    if (!res.ok) {
      const d = await res.json();
      setSanitizeError(d.error || "Sanitization failed");
    } else {
      load();
      onUpdate();
    }
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

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onDelete={handleDelete}
              onSanitize={handleSanitize}
              sanitizing={sanitizing}
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
          Both files uploaded. To replace a file, delete it first.
        </p>
      )}

      {files.length === 0 && !loadError && (
        <p className="text-xs text-center text-muted-foreground py-4">
          No files yet. Upload a Drawing PDF and STEP file.
        </p>
      )}
    </div>
  );
}
