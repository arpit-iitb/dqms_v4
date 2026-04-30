"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Calendar, Edit, AlertCircle,
  Package, Trash2, FileSpreadsheet, ArrowRightCircle,
  Plus, ChevronRight, Send, Users, Clock, CheckCircle2,
  Link as LinkIcon, Mail, AlertTriangle, FileText, ExternalLink, Search, ChevronDown, IndianRupee,
} from "lucide-react";
import { ZohoActionsPanel } from "@/components/orders/zoho-actions-panel";
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_MANUAL_NEXT,
} from "@/lib/lead-utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Lead {
  id: string;
  displayId: string;
  internalQuoteNumber: string | null;
  status: string;
  orderDate: string | null;
  deliveryDate: string | null;
  zohoQuotationId: string | null;
  notes: string | null;
  salesOrderId: string | null;
  salesOrder: { id: string; displayId: string; status: string } | null;
  client: { id: string; name: string; email: string; contactPerson: string | null };
  parts: Array<{
    id: string;
    publicId: string;
    state: string;
    partName: string | null;
    quantity: number;
    createdAt: string;
    pricingModel: { locked: boolean; clientUnitPriceUsd: number | null; totalPriceUsd: number | null } | null;
    files: Array<{ id: string; fileType: string; fileName: string }>;
  }>;
  emailLogs: any[];
  documents: any[];
}

interface GroupedRFQ {
  id: string;
  publicId: string;
  status: string;
  dueDate: string;
  coverNote: string | null;
  createdAt: string;
  vendors: { id: string; vendorId: string; accessToken: string; submittedAt: string | null; vendor: { name: string } }[];
  parts: { id: string; partId: string; part: { publicId: string; partName: string | null } }[];
}

interface Vendor {
  id: string;
  name: string;
  email: string | null;
}

interface EmailLog {
  id: string;
  subject: string;
  recipientEmail: string;
  recipientName: string | null;
  templateKey: string | null;
  sentAt: string;
}

interface EmailTemplate {
  id: string;
  key: string;
  displayName: string;
  subject: string;
  body: string;
}

interface Document {
  id: string;
  documentType: string;
  documentNumber: string | null;
  url: string | null;
  notes: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FINAL_STATUSES = ["WON", "LOST"];

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
  DRAFT: "Draft",
  FILES_RECEIVED: "Files Received",
  SANITIZED: "Sanitized",
  RFQ_SENT: "RFQ Sent",
  QUOTED: "Quoted",
  PRICED: "Priced",
  REJECTED: "Rejected",
  CLIENT_APPROVED: "Client Approved",
  PLANNED: "Planned",
  IN_EXECUTION: "In Execution",
  COMPLETED: "Completed",
  SHIPPED: "Shipped",
  CLOSED: "Closed",
};

const RFQ_STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-amber-100 text-amber-700",
  QUOTED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  QUOTATION: "Quotation",
  SALES_ORDER: "Sales Order",
  PURCHASE_ORDER: "Purchase Order",
  DELIVERY_CHALLAN_CLIENT: "DC (Client)",
  DELIVERY_CHALLAN_MECHXIMIZE: "DC (Mechximize)",
  INVOICE: "Invoice",
  INSPECTION_REPORT: "Inspection Report",
  CLIENT_PO: "Client PO",
  OTHER: "Other",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  QUOTATION: "bg-purple-100 text-purple-700",
  SALES_ORDER: "bg-emerald-100 text-emerald-700",
  INVOICE: "bg-blue-100 text-blue-700",
  PURCHASE_ORDER: "bg-amber-100 text-amber-700",
  DELIVERY_CHALLAN_CLIENT: "bg-teal-100 text-teal-700",
  DELIVERY_CHALLAN_MECHXIMIZE: "bg-cyan-100 text-cyan-700",
  INSPECTION_REPORT: "bg-orange-100 text-orange-700",
  CLIENT_PO: "bg-indigo-100 text-indigo-700",
  OTHER: "bg-slate-100 text-slate-600",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function LeadDetail({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  // Status dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);

  // Zoho estimate dialog
  const [zohoEstimateDialogOpen, setZohoEstimateDialogOpen] = useState(false);

  // Convert to Sales Order dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({ deliveryDate: "", deliveryDatePO: "", clientPoNumber: "" });

  // Pre-fill conversion form when lead data loads
  useEffect(() => {
    if (lead?.deliveryDate) {
      setConvertForm((prev) => ({
        ...prev,
        deliveryDate: prev.deliveryDate || new Date(lead.deliveryDate!).toISOString().slice(0, 10),
      }));
    }
  }, [lead?.deliveryDate]);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");

  /* ---------- Load ---------- */

  const load = useCallback(() => {
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => { if (d.lead) setLead(d.lead); })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  /* ---------- Update helper ---------- */

  const updateLead = async (patch: Record<string, unknown>) => {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (d.lead) {
      // Re-fetch full data since PATCH returns a simplified shape
      load();
    }
    return d;
  };

  /* ---------- Status change ---------- */

  const handleStatusChange = async () => {
    if (!nextStatus) return;
    setSavingStatus(true);
    await updateLead({ status: nextStatus });
    setSavingStatus(false);
    setStatusDialogOpen(false);
    setNextStatus("");
  };

  /* ---------- Delete ---------- */

  const handleDelete = async () => {
    if (!confirm(`Delete lead ${lead?.displayId}? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    router.push("/quotations");
  };

  /* ---------- Convert ---------- */

  const handleConvert = async () => {
    if (!convertForm.deliveryDate) {
      setConvertError("Delivery date is required");
      return;
    }
    setConverting(true);
    setConvertError("");
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: convertForm.deliveryDate,
          deliveryDatePO: convertForm.deliveryDatePO || undefined,
          clientPoNumber: convertForm.clientPoNumber || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setConvertError(d.error || "Conversion failed");
        setConverting(false);
        return;
      }
      // Redirect to the new sales order
      router.push(`/orders/${d.salesOrder.id}`);
    } catch {
      setConvertError("Conversion failed");
      setConverting(false);
    }
  };

  /* ---------- Loading / not found ---------- */

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 animate-pulse rounded" />
        <div className="h-48 bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }

  if (!lead) {
    return <div className="p-6 text-muted-foreground">Lead not found</div>;
  }

  const isFinal = FINAL_STATUSES.includes(lead.status);
  const nextOptions = LEAD_MANUAL_NEXT[lead.status] ?? [];
  const canConvert = ["CLIENT_PROPOSAL_SENT", "QUOTED"].includes(lead.status) && !lead.salesOrderId;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Linked Sales Order banner */}
      {lead.salesOrder && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <AlertCircle className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-700">Converted to Sales Order</AlertTitle>
          <AlertDescription className="text-emerald-600 text-xs flex items-center gap-2">
            This lead has been converted to{" "}
            <Link href={`/orders/${lead.salesOrder.id}`} className="font-semibold underline hover:text-emerald-800">
              {lead.salesOrder.displayId}
            </Link>
            <Badge className="text-xs ml-1">{lead.salesOrder.status}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Header breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/quotations" className="hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Leads & Quotations
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-slate-800">{lead.displayId}</span>
      </div>

      {/* Main card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{lead.displayId}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {lead.client.name}
                {lead.internalQuoteNumber && (
                  <> · Quote: <span className="font-medium text-slate-700">{lead.internalQuoteNumber}</span></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <Badge className={`${LEAD_STATUS_COLORS[lead.status]} text-sm px-3 py-1`}>
                {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
              </Badge>
              {!isFinal && nextOptions.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
                  Update Status
                </Button>
              )}
              {canConvert && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setConvertForm({ deliveryDate: "", deliveryDatePO: "", clientPoNumber: "" });
                    setConvertError("");
                    setConvertDialogOpen(true);
                  }}
                >
                  <ArrowRightCircle className="h-3.5 w-3.5 mr-1" /> Convert to Sales Order
                </Button>
              )}
              <Link href={`/leads/${lead.id}/edit`}>
                <Button variant="outline" size="sm"><Edit className="h-3.5 w-3.5 mr-1" /> Edit</Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-600 hover:text-red-800 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t text-sm">
            {lead.orderDate && (
              <div>
                <p className="text-xs text-muted-foreground">Lead Date</p>
                <p className="font-medium">{new Date(lead.orderDate).toLocaleDateString("en-IN")}</p>
              </div>
            )}
            {lead.deliveryDate && (
              <div>
                <p className="text-xs text-muted-foreground">Expected Delivery</p>
                <p className="font-medium">{new Date(lead.deliveryDate).toLocaleDateString("en-IN")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Parts</p>
              <p className="font-medium">{lead.parts.length} part{lead.parts.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Zoho Actions Panel */}
      <ZohoActionsPanel
        entityType="lead"
        entityId={lead.id}
        zohoQuotationId={lead.zohoQuotationId}
        zohoSalesOrderId={null}
        displayId={lead.displayId}
        onUpdate={load}
        onOpenEstimateDialog={() => setZohoEstimateDialogOpen(true)}
      />

      {/* Tabs */}
      <Tabs defaultValue="parts">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger value="parts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Parts ({lead.parts.length})
          </TabsTrigger>
          <TabsTrigger value="rfq" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            RFQ
          </TabsTrigger>
          <TabsTrigger value="emails" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Emails ({lead.emailLogs.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Documents ({lead.documents.length})
          </TabsTrigger>
        </TabsList>

        {/* Parts Tab */}
        <TabsContent value="parts" className="pt-4">
          <LeadPartsTab lead={lead} onUpdate={load} />
        </TabsContent>

        {/* RFQ Tab */}
        <TabsContent value="rfq" className="pt-4">
          <LeadRFQTab leadId={lead.id} parts={lead.parts} onUpdate={load} />
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="pt-4">
          <LeadEmailTab
            leadId={lead.id}
            emailLogs={lead.emailLogs}
            onUpdate={load}
            leadContext={{
              displayId: lead.displayId,
              clientName: lead.client.name,
              clientEmail: lead.client.email,
              deliveryDate: lead.deliveryDate,
            }}
          />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="pt-4">
          <LeadDocumentsTab leadId={lead.id} documents={lead.documents} onUpdate={load} />
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------------- */}
      {/* Zoho Estimate Dialog                                              */}
      {/* ---------------------------------------------------------------- */}
      <LeadZohoEstimateDialog
        open={zohoEstimateDialogOpen}
        onOpenChange={setZohoEstimateDialogOpen}
        leadId={lead.id}
        leadDisplayId={lead.displayId}
        onSuccess={() => load()}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Status Update Dialog                                              */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Current: <Badge className={LEAD_STATUS_COLORS[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
            </p>
            <div className="space-y-2">
              {nextOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setNextStatus(s === nextStatus ? "" : s)}
                  className={`w-full text-left rounded-lg border-2 p-3 text-sm font-semibold transition-colors ${nextStatus === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-blue-300 text-slate-600"}`}
                >
                  {LEAD_STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange} disabled={!nextStatus || savingStatus}>
              {savingStatus ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Convert to Sales Order Dialog                                     */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convert to Sales Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              This will create a new Sales Order from lead <span className="font-mono font-semibold">{lead.displayId}</span>,
              link all parts, and mark the lead as Won.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Date (Commitment) *</Label>
              <Input
                type="date"
                value={convertForm.deliveryDate}
                onChange={(e) => setConvertForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Date (PO)</Label>
              <Input
                type="date"
                value={convertForm.deliveryDatePO}
                onChange={(e) => setConvertForm((f) => ({ ...f, deliveryDatePO: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client PO Number</Label>
              <Input
                placeholder="e.g. PO-2024-001"
                value={convertForm.clientPoNumber}
                onChange={(e) => setConvertForm((f) => ({ ...f, clientPoNumber: e.target.value }))}
              />
            </div>
            {convertError && <p className="text-sm text-red-600">{convertError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConvert}
              disabled={converting || !convertForm.deliveryDate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />
              {converting ? "Converting..." : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================== */
/* Inline sub-components (use lead API endpoints)                      */
/* ================================================================== */

/* ---------- Parts Tab ---------- */

function LeadPartsTab({ lead, onUpdate }: { lead: Lead; onUpdate: () => void }) {
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddPart = async () => {
    setAdding(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) onUpdate();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (partId: string) => {
    if (!confirm("Delete this part? This cannot be undone.")) return;
    setDeletingId(partId);
    await fetch(`/api/parts/${partId}`, { method: "DELETE" });
    setDeletingId(null);
    onUpdate();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{lead.parts.length} part{lead.parts.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={handleAddPart} disabled={adding}>
          <Plus className="h-4 w-4 mr-1" />
          {adding ? "Adding..." : "Add Part"}
        </Button>
      </div>

      {lead.parts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No parts yet</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={handleAddPart} disabled={adding}>
            Add first part
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {lead.parts.map((part) => (
            <Card key={part.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold font-mono text-slate-800">{part.publicId}</span>
                      <Badge className={`text-xs ${PART_STATE_COLORS[part.state] ?? ""}`}>
                        {PART_STATE_LABELS[part.state] ?? part.state}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {part.partName ?? "Unnamed part"} · Qty: {part.quantity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(part.id)}
                    disabled={deletingId === part.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Link href={`/parts/${part.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- RFQ Tab ---------- */

function LeadRFQTab({ leadId, parts, onUpdate }: { leadId: string; parts: Lead["parts"]; onUpdate: () => void }) {
  const [rfqs, setRfqs] = useState<GroupedRFQ[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [form, setForm] = useState({
    partIds: [] as string[],
    vendorIds: [] as string[],
    dueDate: "",
    coverNote: "",
  });

  const loadRfqs = useCallback(async () => {
    setLoading(true);
    const [rfqRes, vendorRes] = await Promise.all([
      fetch(`/api/leads/${leadId}/rfq`).then((r) => r.json()),
      fetch("/api/vendors").then((r) => r.json()),
    ]);
    setRfqs(rfqRes.rfqs ?? []);
    setVendors(vendorRes.vendors ?? []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { loadRfqs(); }, [loadRfqs]);

  const toggleId = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partIds.length) { setCreateError("Select at least one part"); return; }
    if (!form.vendorIds.length) { setCreateError("Select at least one vendor"); return; }
    if (!form.dueDate) { setCreateError("Due date required"); return; }
    setCreating(true);
    setCreateError("");
    const res = await fetch(`/api/leads/${leadId}/rfq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setCreateOpen(false);
    setForm({ partIds: [], vendorIds: [], dueDate: "", coverNote: "" });
    loadRfqs();
    onUpdate();
  };

  const copyPortalLink = (token: string) => {
    const url = `${window.location.origin}/vendor-portal/${token}`;
    navigator.clipboard.writeText(url).then(() => alert("Link copied!"));
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rfqs.length} RFQ{rfqs.length !== 1 ? "s" : ""} sent</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New RFQ
        </Button>
      </div>

      {rfqs.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
          <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No RFQs sent yet.</p>
          <p className="text-xs mt-1">Select parts and vendors to request quotes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqs.map((rfq) => (
            <Card key={rfq.id}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-mono">{rfq.publicId}</CardTitle>
                    <Badge className={`text-xs ${RFQ_STATUS_COLORS[rfq.status] ?? ""}`}>{rfq.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Due {new Date(rfq.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600">
                    {rfq.parts.map((p) => p.part.publicId).join(", ")}
                  </p>
                </div>
                {rfq.coverNote && (
                  <p className="text-xs text-muted-foreground bg-slate-50 rounded p-2">{rfq.coverNote}</p>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Vendors
                  </p>
                  {rfq.vendors.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {v.submittedAt
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          : <Clock className="h-3.5 w-3.5 text-slate-300" />}
                        <span className={v.submittedAt ? "text-green-700 font-medium" : "text-slate-600"}>
                          {v.vendor.name}
                        </span>
                        {v.submittedAt && (
                          <span className="text-muted-foreground">
                            · Quoted {new Date(v.submittedAt).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-blue-600"
                        onClick={() => copyPortalLink(v.accessToken)}
                      >
                        <LinkIcon className="h-3 w-3 mr-1" /> Copy link
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create RFQ Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New RFQ</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Select Parts *</Label>
              {parts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No parts on this lead yet.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {parts.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={form.partIds.includes(p.id)}
                        onChange={() => setForm((prev) => ({ ...prev, partIds: toggleId(prev.partIds, p.id) }))}
                        className="rounded"
                      />
                      <span className="font-mono text-xs">{p.publicId}</span>
                      {p.partName && <span className="text-muted-foreground text-xs">{p.partName}</span>}
                      <span className="text-muted-foreground text-xs ml-auto">qty: {p.quantity}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Select Vendors *</Label>
              {vendors.length === 0 ? (
                <p className="text-xs text-muted-foreground">No vendors added yet.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {vendors.filter((v) => v).map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={form.vendorIds.includes(v.id)}
                        onChange={() => setForm((prev) => ({ ...prev, vendorIds: toggleId(prev.vendorIds, v.id) }))}
                        className="rounded"
                      />
                      <span className="text-xs">{v.name}</span>
                      {v.email && <span className="text-muted-foreground text-xs ml-auto">{v.email}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Quote Due Date *</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cover Note (optional)</Label>
              <Textarea
                value={form.coverNote}
                onChange={(e) => setForm((p) => ({ ...p, coverNote: e.target.value }))}
                placeholder="Any special instructions for vendors..."
                rows={2}
              />
            </div>

            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create RFQ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Email Tab ---------- */

function LeadEmailTab({
  leadId, emailLogs, onUpdate, leadContext,
}: {
  leadId: string;
  emailLogs: EmailLog[];
  onUpdate: () => void;
  leadContext?: { displayId: string; clientName: string; clientEmail: string; deliveryDate?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [form, setForm] = useState({ recipientEmail: "", recipientName: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const openDialog = async () => {
    setResult(null);
    const res = await fetch("/api/settings/email-templates");
    const d = await res.json();
    const tpls: EmailTemplate[] = (d.templates ?? []).filter((t: any) => t.isActive);
    setTemplates(tpls);
    setForm({
      recipientEmail: leadContext?.clientEmail ?? "",
      recipientName: leadContext?.clientName ?? "",
      subject: "",
      body: "",
    });
    setSelectedKey("");
    setOpen(true);
  };

  const applyTemplate = (key: string) => {
    setSelectedKey(key);
    const tpl = templates.find((t) => t.key === key);
    if (!tpl) return;
    setForm((f) => ({ ...f, subject: tpl.subject, body: tpl.body }));
  };

  const handleSend = async () => {
    if (!form.recipientEmail.trim() || !form.subject.trim() || !form.body.trim()) return;
    setSending(true);
    setResult(null);

    const variables: Record<string, string> = {
      orderDisplayId: leadContext?.displayId ?? "",
      clientName: leadContext?.clientName ?? "",
      deliveryDate: leadContext?.deliveryDate
        ? new Date(leadContext.deliveryDate).toLocaleDateString("en-IN")
        : "",
    };

    const res = await fetch(`/api/leads/${leadId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: selectedKey || undefined,
        subject: form.subject,
        body: form.body,
        recipientEmail: form.recipientEmail.trim(),
        recipientName: form.recipientName.trim() || undefined,
        variables,
      }),
    });

    const d = await res.json();
    setSending(false);

    if (res.status === 207) {
      setResult({ ok: false, message: `Logged but not sent: ${d.warning}` });
    } else if (res.ok) {
      setResult({ ok: true, message: "Email sent successfully." });
      onUpdate();
      setTimeout(() => { setOpen(false); setResult(null); }, 1500);
    } else {
      setResult({ ok: false, message: d.error ?? "Failed to send" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{emailLogs.length} email{emailLogs.length !== 1 ? "s" : ""} sent</p>
        <Button size="sm" onClick={openDialog}>
          <Plus className="h-4 w-4 mr-1" /> Send Email
        </Button>
      </div>

      {emailLogs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No emails sent yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emailLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{log.subject}</p>
                <p className="text-xs text-muted-foreground">To: {log.recipientName ? `${log.recipientName} <${log.recipientEmail}>` : log.recipientEmail}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {new Date(log.sentAt).toLocaleString("en-IN")}
                </p>
              </div>
              {log.templateKey && (
                <Badge className="text-xs bg-slate-100 text-slate-600 flex-shrink-0">{log.templateKey}</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Send dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send Email</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Use Template (optional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setSelectedKey(""); setForm((f) => ({ ...f, subject: "", body: "" })); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!selectedKey ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                  >
                    Custom
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => applyTemplate(t.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedKey === t.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                    >
                      {t.displayName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Recipient Email *</Label>
                <Input
                  type="email"
                  value={form.recipientEmail}
                  onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                  placeholder="client@example.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recipient Name</Label>
                <Input
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  placeholder="John Doe"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Quotation update for lead ..."
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Body *</Label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={6}
                placeholder="Email body... Use {{orderDisplayId}}, {{clientName}}, {{deliveryDate}} as variables."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Variables: <code className="bg-slate-100 px-1 rounded">{"{{orderDisplayId}}"}</code>{" "}
                <code className="bg-slate-100 px-1 rounded">{"{{clientName}}"}</code>{" "}
                <code className="bg-slate-100 px-1 rounded">{"{{deliveryDate}}"}</code>
              </p>
            </div>

            {result && (
              <div className={`flex items-start gap-2 text-xs rounded px-3 py-2 ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                {result.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sending || !form.recipientEmail.trim() || !form.subject.trim() || !form.body.trim()}
            >
              <Mail className="h-4 w-4 mr-1" />
              {sending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Documents Tab ---------- */

function LeadDocumentsTab({ leadId, documents, onUpdate }: { leadId: string; documents: Document[]; onUpdate: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ documentType: "OTHER", documentNumber: "", url: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    await fetch(`/api/leads/${leadId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setDialogOpen(false);
    setForm({ documentType: "OTHER", documentNumber: "", url: "", notes: "" });
    onUpdate();
  };

  const handleDelete = async (docId: string) => {
    await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    onUpdate();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${DOC_TYPE_COLORS[doc.documentType] ?? ""}`}>
                      {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                    </Badge>
                    {doc.documentNumber && <span className="text-sm font-mono text-slate-700">{doc.documentNumber}</span>}
                  </div>
                  {doc.notes && <p className="text-xs text-muted-foreground mt-0.5">{doc.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Document Type</Label>
              <select
                value={form.documentType}
                onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Document Number</Label>
              <Input
                value={form.documentNumber}
                onChange={(e) => setForm((p) => ({ ...p, documentNumber: e.target.value }))}
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-1">
              <Label>URL (optional)</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Saving..." : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Zoho Estimate Dialog (for leads) ---------- */

interface ZohoCustomer {
  id: string;
  name: string;
  email: string;
}

interface ZohoPartOption {
  id: string;
  publicId: string;
  partName: string | null;
  quantity: number;
  pricingLocked: boolean;
  clientUnitPriceUsd: number | null;
  totalPriceUsd: number | null;
  drawingId: string | null;
}

function LeadZohoEstimateDialog({
  open, onOpenChange, leadId, leadDisplayId, onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadDisplayId: string;
  onSuccess?: (estimateNumber: string) => void;
}) {
  const [parts, setParts] = useState<ZohoPartOption[]>([]);
  const [customers, setCustomers] = useState<ZohoCustomer[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ estimateNumber: string; total: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError("");
    setSelectedPartIds(new Set());
    setSelectedCustomerId("");
    setSelectedCustomerName("");
    setCustomerSearch("");

    setLoadingParts(true);
    fetch(`/api/leads/${leadId}/zoho-estimate`)
      .then((r) => r.json())
      .then((data: ZohoPartOption[]) => {
        setParts(data);
        setSelectedPartIds(new Set(data.filter((p) => p.pricingLocked).map((p) => p.id)));
      })
      .finally(() => setLoadingParts(false));

    setLoadingCustomers(true);
    fetch("/api/zoho/customers")
      .then((r) => r.json())
      .then((data: ZohoCustomer[]) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, leadId]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const togglePart = (id: string) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCustomer = (c: ZohoCustomer) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(c.name);
    setCustomerSearch(c.name);
    setCustomerDropdownOpen(false);
  };

  const totalAmount = parts
    .filter((p) => selectedPartIds.has(p.id) && p.totalPriceUsd != null)
    .reduce((sum, p) => sum + (p.totalPriceUsd ?? 0), 0);

  const lockedSelected = parts.filter((p) => selectedPartIds.has(p.id) && p.pricingLocked);

  const handleGenerate = async () => {
    setError("");
    if (!selectedCustomerId) { setError("Select a customer"); return; }
    if (lockedSelected.length === 0) { setError("Select at least one part with locked pricing"); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/zoho-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          partIds: [...selectedPartIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate estimate"); }
      else {
        setResult({ estimateNumber: data.estimateNumber, total: data.total });
        onSuccess?.(data.estimateNumber);
      }
    } catch {
      setError("Failed to generate estimate");
    }
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            Generate Zoho Estimate
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Estimate created successfully</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Estimate <span className="font-mono font-bold">{result.estimateNumber}</span>
                  {" · "}Total: ₹{result.total.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The Zoho estimate ID has been saved to lead {leadDisplayId}.
            </p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Customer picker */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">Customer</p>
              <div className="relative">
                <div
                  className="flex items-center border rounded-md px-3 h-9 gap-2 cursor-text bg-white"
                  onClick={() => setCustomerDropdownOpen(true)}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                    placeholder={loadingCustomers ? "Loading customers..." : "Search or select customer..."}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomerId("");
                      setSelectedCustomerName("");
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                  />
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${customerDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {customerDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2.5">
                        {loadingCustomers ? "Loading..." : "No customers found"}
                      </p>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedCustomerId === c.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-800"}`}
                          onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                        >
                          {c.name}
                          {c.email && <span className="ml-2 text-xs text-muted-foreground font-normal">{c.email}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedCustomerName && selectedCustomerId && (
                <p className="text-xs text-slate-500">
                  Selected: <span className="font-semibold text-slate-700">{selectedCustomerName}</span>
                </p>
              )}
            </div>

            {/* Parts selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Parts to include</p>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    const locked = parts.filter((p) => p.pricingLocked).map((p) => p.id);
                    setSelectedPartIds(new Set(locked));
                  }}
                >
                  Select all priced
                </button>
              </div>

              {loadingParts ? (
                <p className="text-xs text-muted-foreground py-2">Loading parts...</p>
              ) : parts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No parts found for this lead.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                  {parts.map((p) => {
                    const isSelected = selectedPartIds.has(p.id);
                    const disabled = !p.pricingLocked;
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"} ${isSelected && !disabled ? "bg-blue-50/40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => togglePart(p.id)}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-800">{p.publicId}</span>
                            {p.partName && <span className="text-xs text-muted-foreground truncate">{p.partName}</span>}
                            {!p.pricingLocked && (
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">No locked pricing</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Qty: {p.quantity}</p>
                        </div>
                        {p.pricingLocked && p.clientUnitPriceUsd != null && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-slate-800">
                              ₹{p.clientUnitPriceUsd.toLocaleString("en-IN")} <span className="font-normal text-muted-foreground">/u</span>
                            </p>
                            {p.totalPriceUsd != null && (
                              <p className="text-xs text-emerald-700 font-semibold">
                                ₹{p.totalPriceUsd.toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {lockedSelected.length > 0 && (
                <div className="flex items-center justify-between pt-1 text-sm font-semibold border-t mt-1">
                  <span className="text-xs text-muted-foreground">{lockedSelected.length} part{lockedSelected.length !== 1 ? "s" : ""} selected</span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {totalAmount.toLocaleString("en-IN")} total
                  </span>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedCustomerId || lockedSelected.length === 0}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              {generating ? "Generating..." : "Generate Estimate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
