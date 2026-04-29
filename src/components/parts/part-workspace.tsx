"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Save } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { StepsTab } from "./steps-tab";
import { FilesTab } from "./files-tab";
import { DimensionsTab } from "./dimensions-tab";
import { PricingTab } from "./pricing-tab";
import { AnnotationsTab } from "./annotations-tab";

const PART_STATE_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  FILES_RECEIVED: "bg-blue-100 text-blue-700",
  SANITIZED: "bg-indigo-100 text-indigo-700",
  RFQ_SENT: "bg-amber-100 text-amber-700",
  QUOTED: "bg-purple-100 text-purple-700",
  PRICED: "bg-pink-100 text-pink-700",
  CLIENT_APPROVED: "bg-emerald-100 text-emerald-700",
  PLANNED: "bg-cyan-100 text-cyan-700",
  IN_EXECUTION: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  SHIPPED: "bg-teal-100 text-teal-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

const PART_STATE_LABELS: Record<string, string> = {
  DRAFT: "Draft", FILES_RECEIVED: "Files Received", SANITIZED: "Sanitized",
  RFQ_SENT: "RFQ Sent", QUOTED: "Quoted", PRICED: "Priced", REJECTED: "Rejected",
  CLIENT_APPROVED: "Client Approved", PLANNED: "Planned", IN_EXECUTION: "In Execution",
  COMPLETED: "Completed", SHIPPED: "Shipped", CLOSED: "Closed",
};

const ALL_STATES = Object.keys(PART_STATE_LABELS);

interface Part {
  id: string;
  publicId: string;
  leadId: string | null;
  salesOrderId: string | null;
  state: string;
  revision: number;
  partName: string | null;
  description: string | null;
  materialName: string | null;
  materialGrade: string | null;
  surfaceTreatment: string | null;
  quantity: number;
  lead?: { id: string; displayId: string };
  salesOrder?: { id: string; displayId: string };
  files?: any[];
  dimensions?: any[];
  annotations?: any[];
  manufacturingPlan?: {
    id: string;
    locked: boolean;
    totalBlocks: number;
    completedBlocks: number;
    blocks: any[];
  };
}

export function PartWorkspace({ partId }: { partId: string }) {
  const router = useRouter();
  const [part, setPart] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ partName: "", description: "", materialName: "", materialGrade: "", surfaceTreatment: "", quantity: "1" });
  const [metaDirty, setMetaDirty] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [changingState, setChangingState] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/parts/${partId}`);
    const d = await res.json();
    if (d.part) {
      setPart(d.part);
      setMeta({
        partName: d.part.partName ?? "",
        description: d.part.description ?? "",
        materialName: d.part.materialName ?? "",
        materialGrade: d.part.materialGrade ?? "",
        surfaceTreatment: d.part.surfaceTreatment ?? "",
        quantity: String(d.part.quantity ?? 1),
      });
    }
    setLoading(false);
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  const setMetaField = (k: string, v: string) => {
    setMeta((p) => ({ ...p, [k]: v }));
    setMetaDirty(true);
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    await fetch(`/api/parts/${partId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, quantity: parseInt(meta.quantity) || 1 }),
    });
    setSavingMeta(false);
    setMetaDirty(false);
    load();
  };

  const changeState = async (newState: string) => {
    setChangingState(true);
    await fetch(`/api/parts/${partId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: newState }),
    });
    setChangingState(false);
    load();
  };

  if (loading) return <div className="p-6 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (!part) return <div className="p-6 text-muted-foreground">Part not found</div>;

  const plan = part.manufacturingPlan;
  const planProgress = plan && plan.totalBlocks > 0
    ? Math.round((plan.completedBlocks / plan.totalBlocks) * 100)
    : 0;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        {part.salesOrder ? (
          <Link href="/orders" className="hover:text-slate-800 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Orders
          </Link>
        ) : (
          <Link href="/quotations" className="hover:text-slate-800 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Leads
          </Link>
        )}
        {part.salesOrder && (
          <>
            <span>/</span>
            <Link href={`/orders/${part.salesOrder.id}`} className="hover:text-slate-800 font-mono">{part.salesOrder.displayId}</Link>
          </>
        )}
        {!part.salesOrder && part.lead && (
          <>
            <span>/</span>
            <Link href={`/leads/${part.lead.id}`} className="hover:text-slate-800 font-mono">{part.lead.displayId}</Link>
          </>
        )}
        <span>/</span>
        <span className="font-mono font-semibold text-slate-800">{part.publicId}</span>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold font-mono text-slate-900">{part.publicId}</h1>
              {part.partName && <p className="text-sm text-muted-foreground mt-0.5">{part.partName}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <Badge className={`${PART_STATE_COLORS[part.state] ?? ""}`}>
                {PART_STATE_LABELS[part.state] ?? part.state}
              </Badge>
              <select
                value={part.state}
                onChange={(e) => changeState(e.target.value)}
                disabled={changingState}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
              >
                {ALL_STATES.map((s) => (
                  <option key={s} value={s}>{PART_STATE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress bar if plan exists */}
          {plan && (
            <div className="mt-4 pt-4 border-t space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Execution Progress</span>
                <span>{plan.completedBlocks}/{plan.totalBlocks} steps · {planProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${planProgress === 100 ? "bg-emerald-500" : planProgress > 0 ? "bg-blue-500" : "bg-slate-200"}`}
                  style={{ width: `${planProgress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          {[
            { value: "info", label: "Info" },
            {
              value: "steps",
              label: plan
                ? `Steps (${plan.completedBlocks}/${plan.totalBlocks})`
                : "Steps",
            },
            {
              value: "dimensions",
              label: part.dimensions?.length
                ? `Dimensions (${part.dimensions.length})`
                : "Dimensions",
            },
            { value: "pricing", label: "Pricing" },
            {
              value: "annotations",
              label: part.annotations?.length
                ? `Annotate (${part.annotations.length})`
                : "Annotate",
            },
            {
              value: "files",
              label: part.files?.length
                ? `Files (${part.files.length})`
                : "Files",
            },
          ].map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Info / Metadata */}
        <TabsContent value="info" className="pt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Part Details</CardTitle>
                {metaDirty && (
                  <Button size="sm" onClick={saveMeta} disabled={savingMeta}>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {savingMeta ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Part Name</Label>
                <Input value={meta.partName} onChange={(e) => setMetaField("partName", e.target.value)} placeholder="e.g. Bracket Assembly" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={meta.description} onChange={(e) => setMetaField("description", e.target.value)} placeholder="Brief description" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Material Name</Label>
                <Input value={meta.materialName} onChange={(e) => setMetaField("materialName", e.target.value)} placeholder="e.g. SS 304" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Material Grade</Label>
                <Input value={meta.materialGrade} onChange={(e) => setMetaField("materialGrade", e.target.value)} placeholder="e.g. 2B" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Surface Treatment</Label>
                <Input value={meta.surfaceTreatment} onChange={(e) => setMetaField("surfaceTreatment", e.target.value)} placeholder="e.g. Anodized" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input type="number" min="1" value={meta.quantity} onChange={(e) => setMetaField("quantity", e.target.value)} />
              </div>
              <div className="col-span-2 pt-1 text-xs text-muted-foreground space-y-0.5 border-t">
                <p>Drawing ID: <span className="font-mono text-slate-700">{part.publicId}</span></p>
                <p>Revision: <span className="font-medium">{part.revision}</span></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manufacturing Steps */}
        <TabsContent value="steps" className="pt-4">
          <StepsTab partId={partId} plan={plan} onUpdate={load} />
        </TabsContent>

        {/* Dimensions */}
        <TabsContent value="dimensions" className="pt-4">
          <DimensionsTab partId={partId} onUpdate={load} />
        </TabsContent>

        {/* Pricing */}
        <TabsContent value="pricing" className="pt-4">
          <PricingTab partId={partId} onUpdate={load} />
        </TabsContent>

        {/* Annotations */}
        <TabsContent value="annotations" className="pt-4">
          <AnnotationsTab partId={partId} onUpdate={load} />
        </TabsContent>

        {/* Files */}
        <TabsContent value="files" className="pt-4">
          <FilesTab partId={partId} onUpdate={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
