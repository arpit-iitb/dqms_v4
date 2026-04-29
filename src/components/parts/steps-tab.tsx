"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, ChevronDown, ChevronUp, CheckCircle2, Circle, Trash2,
  Package, Wrench, FlaskConical, Sparkles, RefreshCw, Clock,
  XCircle, AlertCircle, Ruler, LayoutTemplate, Edit2, Lock,
  Upload, FileText, Image, X,
} from "lucide-react";
import {
  BlockType, BlockStatus, StepData, CheckEntry,
  BLOCK_TYPE_LABELS, BLOCK_TYPE_COLORS,
  getStepChecks, defaultStepData,
  InspectionStepData, PostProcessingStepData,
  INSPECTION_TYPE_LABELS, POST_PROCESSING_TYPE_LABELS,
} from "@/lib/step-types";

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  MATERIAL: Package, MANUFACTURING: Wrench, INSPECTION: FlaskConical,
  POST_PROCESSING: Sparkles, REWORK: RefreshCw, EMAIL: Clock,
};

interface InspectionResult {
  inspectorType: string;
  result: string;
  notes: string | null;
  inspectedAt: string;
}

interface PartDimension {
  id: string;
  name: string;
  rawText: string;
  dimOrder: number;
}

interface BlockDimensionRecord {
  id: string;
  dimensionId: string;
  measuredValue: string | null;
  result: "PASS" | "FAIL" | null;
  dimension: PartDimension;
}

interface PlanBlock {
  id: string;
  blockOrder: number;
  type: string;
  processName: string | null;
  status: string;
  stepData: StepData | null;
  notes: string | null;
  deadline: string | null;
  vendor: { id: string; name: string } | null;
  inspectionResult: InspectionResult | null;
  // Email trigger fields
  emailEnabled: boolean;
  emailRecipient: string | null;
  emailTemplate: string | null;
  emailContent: string | null;
  emailTrigger: "START" | "COMPLETE" | null;
}

interface Plan {
  id: string;
  locked: boolean;
  totalBlocks: number;
  completedBlocks: number;
  blocks: PlanBlock[];
}

interface Props {
  partId: string;
  plan: Plan | undefined | null;
  onUpdate: () => void;
}

function CheckRow({ label, entry, onToggle }: { label: string; entry: CheckEntry; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-start gap-2 w-full text-left group py-1.5 hover:bg-slate-50 rounded px-1 transition-colors"
    >
      <span className="mt-0.5 flex-shrink-0">
        {entry.checked
          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : <Circle className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />}
      </span>
      <span className="flex-1">
        <span className={`text-sm ${entry.checked ? "text-slate-800 font-medium line-through decoration-green-400" : "text-slate-600"}`}>{label}</span>
        {entry.checked && entry.timestamp && (
          <span className="ml-2 text-xs text-muted-foreground">
            {new Date(entry.timestamp).toLocaleString()}
          </span>
        )}
      </span>
    </button>
  );
}

function StepChecklist({ data, onToggleCheck, disabled }: { data: StepData; onToggleCheck: (path: string) => void; disabled?: boolean }) {
  const toggle = (path: string) => { if (!disabled) onToggleCheck(path); };
  switch (data.type) {
    case "MATERIAL":
      return (
        <div className={`space-y-0.5 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <CheckRow label="Pickup Scheduled" entry={data.pickupScheduled} onToggle={() => toggle("pickupScheduled")} />
          <CheckRow label="Material Received" entry={data.materialReceived} onToggle={() => toggle("materialReceived")} />
          <CheckRow label="Delivery Challan Received" entry={data.deliveryChallanReceived} onToggle={() => toggle("deliveryChallanReceived")} />
        </div>
      );
    case "MANUFACTURING":
      return (
        <div className={`space-y-0.5 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <CheckRow label="Material Received by Vendor" entry={data.materialReceivedByVendor} onToggle={() => toggle("materialReceivedByVendor")} />
          <CheckRow label="Material Inspected by Vendor" entry={data.materialInspectedByVendor} onToggle={() => toggle("materialInspectedByVendor")} />
          <CheckRow label="Manufacturing Initiated" entry={data.manufacturingInitiated} onToggle={() => toggle("manufacturingInitiated")} />
          <CheckRow label="Manufacturing Completed" entry={data.manufacturingCompleted} onToggle={() => toggle("manufacturingCompleted")} />
          <CheckRow label="Inspected by Vendor" entry={data.inspectedByVendor} onToggle={() => toggle("inspectedByVendor")} />
          <CheckRow label="Dispatched" entry={data.dispatched} onToggle={() => toggle("dispatched")} />
        </div>
      );
    case "INSPECTION":
      return (
        <div className={`space-y-0.5 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <p className="text-xs text-muted-foreground mb-1">{INSPECTION_TYPE_LABELS[data.inspectionType]}</p>
          <CheckRow label="Slot Booked" entry={data.slotBooked} onToggle={() => toggle("slotBooked")} />
          <CheckRow label="Material Received by Inspector" entry={data.materialReceivedByVendor} onToggle={() => toggle("materialReceivedByVendor")} />
          <CheckRow label="Inspection Completed" entry={data.inspectionCompleted} onToggle={() => toggle("inspectionCompleted")} />
          <CheckRow label="Report Shared" entry={data.reportShared} onToggle={() => toggle("reportShared")} />
          <CheckRow label="Dispatched" entry={data.dispatched} onToggle={() => toggle("dispatched")} />
        </div>
      );
    case "POST_PROCESSING":
      return (
        <div className={`space-y-0.5 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <p className="text-xs text-muted-foreground mb-1">{POST_PROCESSING_TYPE_LABELS[data.processType]}</p>
          <CheckRow label="Material Received by Vendor" entry={data.materialReceivedByVendor} onToggle={() => toggle("materialReceivedByVendor")} />
          <CheckRow label="Post Processing Completed" entry={data.postProcessingCompleted} onToggle={() => toggle("postProcessingCompleted")} />
          <CheckRow label="Dispatched" entry={data.dispatched} onToggle={() => toggle("dispatched")} />
        </div>
      );
    case "REWORK":
      return (
        <div className={`space-y-0.5 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <CheckRow label="CAPA Completed" entry={data.capaCompleted} onToggle={() => toggle("capaCompleted")} />
          <CheckRow label="Material Received by Vendor" entry={data.materialReceivedByVendor} onToggle={() => toggle("materialReceivedByVendor")} />
          <CheckRow label="Rework Initiated" entry={data.reworkInitiated} onToggle={() => toggle("reworkInitiated")} />
          <CheckRow label="Rework Completed" entry={data.reworkCompleted} onToggle={() => toggle("reworkCompleted")} />
          <CheckRow label="Inspected by Vendor" entry={data.inspectedByVendor} onToggle={() => toggle("inspectedByVendor")} />
          <CheckRow label="Dispatched" entry={data.dispatched} onToggle={() => toggle("dispatched")} />
        </div>
      );
    default:
      return null;
  }
}

const INSPECTOR_LABELS: Record<string, string> = {
  IN_HOUSE: "In-house", THIRD_PARTY: "Third Party", CLIENT: "Client",
};

interface InspectionFile {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
}

function InspectionPanel({ block, planId, onUpdate }: { block: PlanBlock; planId: string; onUpdate: () => void }) {
  const [form, setForm] = useState({
    inspectorType: block.inspectionResult?.inspectorType ?? "IN_HOUSE",
    result: block.inspectionResult?.result ?? "PASS",
    notes: block.inspectionResult?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  // File upload state
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [photos, setPhotos] = useState<InspectionFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const filesUrl = `/api/plans/${planId}/blocks/${block.id}/inspection/files`;

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(filesUrl);
      if (res.ok) {
        const data = await res.json();
        setReportPath(data.reportPath ?? null);
        setPhotos(data.photos ?? []);
      }
    } catch {
      // ignore
    }
  }, [filesUrl]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/plans/${planId}/blocks/${block.id}/inspection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onUpdate();
  };

  const uploadFile = async (file: File, type: "report" | "photo") => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    await fetch(filesUrl, { method: "POST", body: fd });
    setUploading(false);
    loadFiles();
  };

  const deletePhoto = async (photoId: string) => {
    await fetch(`${filesUrl}?photoId=${photoId}`, { method: "DELETE" });
    loadFiles();
  };

  const existing = block.inspectionResult;

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Inspection Record</p>
      {existing && (
        <div className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${existing.result === "PASS" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {existing.result === "PASS"
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <XCircle className="h-3.5 w-3.5" />}
          <span className="font-medium">{existing.result}</span>
          <span className="text-xs opacity-70">· {INSPECTOR_LABELS[existing.inspectorType] ?? existing.inspectorType} · {new Date(existing.inspectedAt).toLocaleDateString("en-IN")}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Inspector</label>
          <select
            value={form.inspectorType}
            onChange={(e) => setForm((p) => ({ ...p, inspectorType: e.target.value }))}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
          >
            {Object.entries(INSPECTOR_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Result</label>
          <select
            value={form.result}
            onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
          >
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="CONDITIONAL_PASS">Conditional Pass</option>
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">Notes</label>
          <input
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Inspector notes..."
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : existing ? "Update Inspection" : "Record Inspection"}
      </Button>

      {/* --- File Attachments --- */}
      <div className="pt-2 border-t space-y-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Attachments</p>

        {/* Report PDF */}
        <div className="flex items-center gap-2">
          {reportPath ? (
            <a
              href={`/api/uploads/${reportPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" /> View Report (PDF)
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">No report uploaded</span>
          )}
          <label className="ml-auto cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f, "report");
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input hover:bg-slate-50 transition-colors cursor-pointer">
              <Upload className="h-3 w-3" /> {reportPath ? "Replace" : "Upload"} PDF
            </span>
          </label>
        </div>

        {/* Photos */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f, "photo");
                  e.target.value = "";
                }}
              />
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input hover:bg-slate-50 transition-colors cursor-pointer">
                <Image className="h-3 w-3" /> Upload Photo
              </span>
            </label>
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative group">
                  <a href={`/api/uploads/${p.filePath}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/uploads/${p.filePath}`}
                      alt={p.fileName}
                      className="h-16 w-16 object-cover rounded border border-slate-200"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => deletePhoto(p.id)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {uploading && <p className="text-xs text-blue-600">Uploading...</p>}
      </div>
    </div>
  );
}

function EmailConfigPanel({ block, planId, onUpdate }: { block: PlanBlock; planId: string; onUpdate: () => void }) {
  const [form, setForm] = useState({
    emailEnabled: block.emailEnabled,
    emailRecipient: block.emailRecipient ?? "",
    emailTemplate: block.emailTemplate ?? "",
    emailContent: block.emailContent ?? "",
    emailTrigger: block.emailTrigger ?? "COMPLETE",
  });
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Array<{ key: string; displayName: string }>>([]);

  useEffect(() => {
    fetch("/api/settings/email-templates")
      .then((r) => r.json())
      .then((d) => setTemplates((d.templates ?? []).filter((t: any) => t.isActive)));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/plans/${planId}/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailEnabled: form.emailEnabled,
        emailRecipient: form.emailRecipient || null,
        emailTemplate: form.emailTemplate || null,
        emailContent: form.emailContent || null,
        emailTrigger: form.emailTrigger || null,
      }),
    });
    setSaving(false);
    onUpdate();
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Email Trigger Configuration
        </p>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, emailEnabled: !f.emailEnabled }))}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${form.emailEnabled ? "border-blue-400 bg-blue-50 text-blue-700 font-medium" : "border-slate-200 text-slate-500"}`}
        >
          {form.emailEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {form.emailEnabled && (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Trigger When</label>
            <select
              value={form.emailTrigger}
              onChange={(e) => setForm((f) => ({ ...f, emailTrigger: e.target.value as "START" | "COMPLETE" }))}
              className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
            >
              <option value="START">Block starts (status → IN_PROGRESS)</option>
              <option value="COMPLETE">Block completes (status → DONE)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Recipient Email</label>
            <input
              className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
              value={form.emailRecipient}
              onChange={(e) => setForm((f) => ({ ...f, emailRecipient: e.target.value }))}
              placeholder="vendor@example.com or client@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Template (optional)</label>
            <select
              value={form.emailTemplate}
              onChange={(e) => setForm((f) => ({ ...f, emailTemplate: e.target.value }))}
              className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
            >
              <option value="">— Custom content below —</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>{t.displayName}</option>
              ))}
            </select>
          </div>
          {!form.emailTemplate && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Custom Email Content</label>
              <textarea
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none resize-none font-mono"
                rows={3}
                value={form.emailContent}
                onChange={(e) => setForm((f) => ({ ...f, emailContent: e.target.value }))}
                placeholder="Email body... Supports {{stepName}}, {{orderDisplayId}}, {{clientName}}"
              />
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-8 rounded-md bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Email Config"}
      </button>
    </div>
  );
}

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  steps: Array<{ type: string; processName?: string; customName?: string }>;
}

function DimensionMeasurementPanel({ blockId, planId, partId }: { blockId: string; planId: string; partId: string }) {
  const [partDims, setPartDims] = useState<PartDimension[]>([]);
  const [blockDims, setBlockDims] = useState<Record<string, BlockDimensionRecord>>({});
  const [draft, setDraft] = useState<Record<string, { measuredValue: string; result: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pRes, bRes] = await Promise.all([
      fetch(`/api/parts/${partId}/dimensions`),
      fetch(`/api/plans/${planId}/blocks/${blockId}/dimensions`),
    ]);
    const [pData, bData] = await Promise.all([pRes.json(), bRes.json()]);
    const dims: PartDimension[] = pData.dimensions ?? [];
    const bds: BlockDimensionRecord[] = bData.blockDimensions ?? [];

    setPartDims(dims);
    const bdMap: Record<string, BlockDimensionRecord> = {};
    const draftMap: Record<string, { measuredValue: string; result: string }> = {};
    for (const bd of bds) {
      bdMap[bd.dimensionId] = bd;
      draftMap[bd.dimensionId] = { measuredValue: bd.measuredValue ?? "", result: bd.result ?? "PASS" };
    }
    for (const d of dims) {
      if (!draftMap[d.id]) draftMap[d.id] = { measuredValue: "", result: "PASS" };
    }
    setBlockDims(bdMap);
    setDraft(draftMap);
    setLoading(false);
  }, [blockId, planId, partId]);

  useEffect(() => { load(); }, [load]);

  const saveDimension = async (dimId: string) => {
    const entry = draft[dimId];
    if (!entry?.measuredValue?.trim()) return;
    setSaving((s) => ({ ...s, [dimId]: true }));
    await fetch(`/api/plans/${planId}/blocks/${blockId}/dimensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimensionId: dimId, measuredValue: entry.measuredValue, result: entry.result }),
    });
    setSaving((s) => ({ ...s, [dimId]: false }));
    load();
  };

  if (loading) return <p className="text-xs text-muted-foreground py-2">Loading dimensions...</p>;
  if (partDims.length === 0) return (
    <p className="text-xs text-muted-foreground py-2 italic">No critical dimensions defined for this part.</p>
  );

  const recorded = partDims.filter((d) => blockDims[d.id]);
  const passed = recorded.filter((d) => blockDims[d.id]?.result === "PASS").length;
  const failed = recorded.filter((d) => blockDims[d.id]?.result === "FAIL").length;

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5" /> Dimensional Measurements
        </p>
        {recorded.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            {passed > 0 && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">{passed} Pass</span>}
            {failed > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">{failed} Fail</span>}
            <span className="text-muted-foreground">{recorded.length}/{partDims.length} recorded</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {partDims.map((dim, i) => {
          const existing = blockDims[dim.id];
          const entry = draft[dim.id] ?? { measuredValue: "", result: "PASS" };
          return (
            <div key={dim.id} className={`rounded-lg border p-2.5 space-y-2 ${existing?.result === "PASS" ? "border-green-200 bg-green-50/30" : existing?.result === "FAIL" ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">{i + 1}. {dim.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{dim.rawText}</p>
                </div>
                {existing && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${existing.result === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {existing.result}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none font-mono"
                  placeholder="Measured value"
                  value={entry.measuredValue}
                  onChange={(e) => setDraft((d) => ({ ...d, [dim.id]: { ...d[dim.id], measuredValue: e.target.value } }))}
                />
                <select
                  value={entry.result}
                  onChange={(e) => setDraft((d) => ({ ...d, [dim.id]: { ...d[dim.id], result: e.target.value } }))}
                  className="h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none"
                >
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                </select>
                <Button
                  size="sm"
                  variant={existing ? "outline" : "default"}
                  className="h-7 px-2 text-xs"
                  disabled={saving[dim.id] || !entry.measuredValue?.trim()}
                  onClick={() => saveDimension(dim.id)}
                >
                  {saving[dim.id] ? "..." : existing ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockEditPanel({ block, planId, onUpdate, locked }: { block: PlanBlock; planId: string; onUpdate: () => void; locked?: boolean }) {
  const [form, setForm] = useState({
    processName: block.processName ?? "",
    notes: block.notes ?? "",
    vendorId: block.vendor?.id ?? "",
    deadline: block.deadline ? block.deadline.slice(0, 10) : "",
    status: block.status,
  });
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/vendors").then((r) => r.json()).then((d) => setVendors(d.vendors ?? []));
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/plans/${planId}/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processName: form.processName || null,
        notes: form.notes || null,
        vendorId: form.vendorId || null,
        deadline: form.deadline || null,
        status: form.status,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error ?? "Failed to save changes");
      return;
    }
    onUpdate();
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Edit Step</p>
      {saveError && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {saveError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">Step Name</label>
          <input
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
            value={form.processName}
            onChange={(e) => setForm((f) => ({ ...f, processName: e.target.value }))}
            placeholder={BLOCK_TYPE_LABELS[block.type as BlockType] ?? block.type}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Vendor</label>
          <select
            value={form.vendorId}
            onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
          >
            <option value="">— None —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Deadline</label>
          <input
            type="date"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none"
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className={`w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none ${locked ? "opacity-60" : ""}`}
            disabled={locked}
          >
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none resize-none"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Internal notes about this step..."
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

function BlockCard({ block, planId, partId, onUpdate, locked }: { block: PlanBlock; planId: string; partId: string; onUpdate: () => void; locked?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const Icon = BLOCK_ICONS[block.type as BlockType] ?? Package;
  const stepData = block.stepData as StepData | null;
  const { done, total } = getStepChecks(stepData);
  const allDone = total > 0 && done === total;

  const toggleCheck = async (path: string) => {
    if (!stepData || locked) return;
    const updated = JSON.parse(JSON.stringify(stepData)) as any;
    const entry = updated[path] as CheckEntry;
    entry.checked = !entry.checked;
    entry.timestamp = entry.checked ? new Date().toISOString() : undefined;

    // Auto-set block status
    const { done: newDone, total: newTotal } = getStepChecks(updated);
    const newStatus = newDone === newTotal && newTotal > 0 ? "DONE"
      : newDone > 0 ? "IN_PROGRESS" : "PENDING";

    const res = await fetch(`/api/plans/${planId}/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepData: updated, status: newStatus }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to update step");
      onUpdate();
      return;
    }
    onUpdate();
  };

  const deleteBlock = async () => {
    if (!confirm("Delete this step?")) return;
    setDeleting(true);
    await fetch(`/api/plans/${planId}/blocks/${block.id}`, { method: "DELETE" });
    onUpdate();
  };

  const statusColor = block.status === "DONE" ? "text-green-600" : block.status === "IN_PROGRESS" ? "text-blue-600" : "text-slate-400";

  return (
    <Card className={`${allDone ? "border-green-200 bg-green-50/30" : ""} ${locked ? "opacity-60" : ""}`}>
      <CardContent className="p-0">
        {/* Header row */}
        <button
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/50 rounded-lg transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${locked ? "bg-slate-200" : BLOCK_TYPE_COLORS[block.type as BlockType]?.split(" ").slice(0, 1).join(" ") ?? "bg-slate-100"}`}>
            {locked ? <Lock className="h-4 w-4 text-slate-500" /> : <Icon className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">
                {block.blockOrder}. {block.processName || BLOCK_TYPE_LABELS[block.type as BlockType]}
              </span>
              <Badge className={`text-xs ${BLOCK_TYPE_COLORS[block.type as BlockType] ?? ""}`}>
                {BLOCK_TYPE_LABELS[block.type as BlockType]}
              </Badge>
              {locked && <Badge className="text-xs bg-slate-200 text-slate-600 border-slate-300" title="Complete preceding steps to unlock">Locked</Badge>}
              {allDone && !locked && <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Done</Badge>}
              {block.type === "INSPECTION" && block.inspectionResult && (
                <Badge className={`text-xs ${block.inspectionResult.result === "PASS" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-600 border-red-200"}`}>
                  {block.inspectionResult.result === "PASS" ? "Pass" : block.inspectionResult.result === "FAIL" ? "Fail" : "Conditional"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {block.vendor && <span className="text-xs text-muted-foreground">{block.vendor.name}</span>}
              {total > 0 && (
                <span className={`text-xs font-medium ${statusColor}`}>{done}/{total} checks</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Mini progress bar */}
            {total > 0 && (
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                <div
                  className={`h-full rounded-full ${allDone ? "bg-green-500" : done > 0 ? "bg-blue-500" : "bg-slate-200"}`}
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            )}
            <Button
              variant="ghost" size="sm"
              className={`h-7 w-7 p-0 ${editing ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
              onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); if (!expanded) setExpanded(true); }}
              title="Edit step"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); deleteBlock(); }}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </button>

        {/* Expanded checklist */}
        {expanded && (
          <div className="px-4 pb-4 border-t">
            {block.deadline && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-3 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Deadline: {new Date(block.deadline).toLocaleDateString("en-IN")}
              </p>
            )}
            {locked && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-3 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Complete preceding steps to unlock
              </p>
            )}
            {stepData && (
              <div className="pt-3">
                <StepChecklist data={stepData} onToggleCheck={toggleCheck} disabled={locked} />
              </div>
            )}
            {block.notes && !editing && (
              <p className="text-xs text-muted-foreground mt-2 bg-slate-50 rounded p-2">{block.notes}</p>
            )}
            {block.type === "INSPECTION" && (
              <>
                <InspectionPanel block={block} planId={planId} onUpdate={onUpdate} />
                <DimensionMeasurementPanel blockId={block.id} planId={planId} partId={partId} />
              </>
            )}
            {block.type === "EMAIL" && (
              <EmailConfigPanel block={block} planId={planId} onUpdate={onUpdate} />
            )}
            {editing && (
              <BlockEditPanel block={block} planId={planId} onUpdate={() => { onUpdate(); setEditing(false); }} locked={locked} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ADDABLE_TYPES: BlockType[] = ["MATERIAL", "MANUFACTURING", "INSPECTION", "POST_PROCESSING", "REWORK"];

export function StepsTab({ partId, plan, onUpdate }: Props) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newType, setNewType] = useState<BlockType>("MANUFACTURING");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleCreatePlan = async () => {
    setCreatingPlan(true);
    await fetch(`/api/parts/${partId}/plan`, { method: "POST" });
    setCreatingPlan(false);
    onUpdate();
  };

  const handleAddBlock = async () => {
    if (!plan) return;
    setAdding(true);
    const stepData = defaultStepData(newType);
    await fetch(`/api/plans/${plan.id}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        processName: newName.trim() || null,
        stepData,
        blockOrder: (plan.blocks?.length ?? 0) + 1,
      }),
    });
    setAdding(false);
    setAddDialogOpen(false);
    setNewName("");
    onUpdate();
  };

  const openTemplateDialog = async () => {
    setLoadingTemplates(true);
    setTemplateDialogOpen(true);
    const res = await fetch("/api/settings/process-templates");
    const d = await res.json();
    setTemplates(d.templates ?? []);
    if (d.templates?.length > 0) setSelectedTemplateId(d.templates[0].id);
    setLoadingTemplates(false);
  };

  const handleApplyTemplate = async () => {
    if (!plan || !selectedTemplateId) return;
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;
    setApplying(true);
    const baseOrder = (plan.blocks?.length ?? 0) + 1;
    for (let i = 0; i < template.steps.length; i++) {
      const step = template.steps[i];
      const bType = (step.type as BlockType) in BLOCK_TYPE_LABELS ? (step.type as BlockType) : "MANUFACTURING";
      const stepData = defaultStepData(bType);
      await fetch(`/api/plans/${plan.id}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: bType,
          processName: step.customName || step.processName || null,
          stepData,
          blockOrder: baseOrder + i,
        }),
      });
    }
    setApplying(false);
    setTemplateDialogOpen(false);
    onUpdate();
  };

  if (!plan) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium text-slate-600">No manufacturing plan yet</p>
        <p className="text-xs mt-1">Create a plan to start tracking manufacturing steps</p>
        <Button className="mt-4" onClick={handleCreatePlan} disabled={creatingPlan}>
          {creatingPlan ? "Creating..." : "Create Manufacturing Plan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {plan.blocks.length} step{plan.blocks.length !== 1 ? "s" : ""} · {plan.completedBlocks}/{plan.totalBlocks} done
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openTemplateDialog}>
            <LayoutTemplate className="h-4 w-4 mr-1" /> Apply Template
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Step
          </Button>
        </div>
      </div>

      {/* Completion banner */}
      {plan.totalBlocks > 0 && plan.completedBlocks === plan.totalBlocks && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">All steps complete!</p>
            <p className="text-xs text-emerald-700">Advance the part state to "Completed" using the state selector above.</p>
          </div>
        </div>
      )}

      {plan.blocks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-sm">No steps yet. Add the first manufacturing step.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plan.blocks.map((block) => {
            const isLocked = plan.blocks.some(
              (b) => b.blockOrder < block.blockOrder && b.status !== "DONE"
            );
            return (
              <BlockCard key={block.id} block={block} planId={plan.id} partId={partId} onUpdate={onUpdate} locked={isLocked} />
            );
          })}
        </div>
      )}

      {/* Apply Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Apply Process Template</DialogTitle></DialogHeader>
          <div className="py-2">
            {loadingTemplates ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No process templates found. Create some in Settings.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Steps will be added after existing blocks.</p>
                <div className="space-y-1.5">
                  {templates.map((t) => {
                    const steps = Array.isArray(t.steps) ? t.steps : [];
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${selectedTemplateId === t.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <p className="text-sm font-medium text-slate-800">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {steps.map((s, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${BLOCK_TYPE_COLORS[(s.type as BlockType)] ?? "bg-slate-100 text-slate-600"}`}>
                              {s.customName || s.processName || BLOCK_TYPE_LABELS[(s.type as BlockType)] || s.type}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyTemplate} disabled={applying || !selectedTemplateId || templates.length === 0}>
              {applying ? "Applying..." : "Apply Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Step Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Manufacturing Step</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Step Type</label>
              <div className="grid grid-cols-2 gap-2">
                {ADDABLE_TYPES.map((t) => {
                  const Icon = BLOCK_ICONS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${newType === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {BLOCK_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Custom Name (optional)</label>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`e.g. CNC Machining`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBlock} disabled={adding}>
              {adding ? "Adding..." : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
