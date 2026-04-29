"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, Circle, Clock, Truck, Save, ExternalLink, AlertTriangle,
} from "lucide-react";

interface CheckEntry {
  checked: boolean;
  timestamp?: string;
}

interface DispatchDocEntry extends CheckEntry {
  documentNumber?: string;
}

interface OrderDispatchModuleData {
  transporter?: string;
  scheduledDate?: string;
  actualDate?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  inspectionReportGenerated: DispatchDocEntry;
  deliveryChallanGenerated: DispatchDocEntry;
  invoiceGenerated: DispatchDocEntry;
  packagingCompleted: CheckEntry;
  dispatched: CheckEntry;
  receivedByClient: CheckEntry;
  updatedAt?: string;
}

const DEFAULT_MODULE: OrderDispatchModuleData = {
  inspectionReportGenerated: { checked: false },
  deliveryChallanGenerated: { checked: false },
  invoiceGenerated: { checked: false },
  packagingCompleted: { checked: false },
  dispatched: { checked: false },
  receivedByClient: { checked: false },
};

interface Order {
  id: string;
  status: string;
  dispatchModule: any;
  clientDcNumber: string | null;
  mechximizeDcNumber: string | null;
  zohoSalesOrderId: string | null;
  client: { id: string; name: string; zohoContactId?: string | null };
  parts: Array<{
    publicId: string;
    partName: string | null;
    clientPartId?: string | null;
    quantity: number;
    pricingModel?: { clientUnitPriceUsd: number };
  }>;
}

interface Vendor {
  id: string;
  name: string;
  zohoContactId: string | null;
}

interface Props {
  order: Order;
  onUpdate: () => void;
}

function CheckRow({ label, entry, onToggle, disabled }: { label: string; entry: CheckEntry; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="flex items-start gap-2.5 w-full text-left group py-1.5 hover:bg-slate-50 rounded px-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="mt-0.5 flex-shrink-0">
        {entry.checked
          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : <Circle className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />}
      </span>
      <span className="flex-1">
        <span className={`text-sm ${entry.checked ? "text-slate-800 font-medium" : "text-slate-600"}`}>{label}</span>
        {entry.checked && entry.timestamp && (
          <span className="ml-2 text-xs text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-0.5" />
            {new Date(entry.timestamp).toLocaleString("en-IN")}
          </span>
        )}
      </span>
    </button>
  );
}

export function OrderDispatchModule({ order, onUpdate }: Props) {
  const [data, setData] = useState<OrderDispatchModuleData>(
    (order.dispatchModule as OrderDispatchModuleData) ?? DEFAULT_MODULE,
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dcDialogOpen, setDcDialogOpen] = useState(false);
  const [dcType, setDcType] = useState<"client" | "manufacturer">("client");
  const [dcForm, setDcForm] = useState({
    referenceNumber: order.clientDcNumber ?? "",
    mechximizeDcNumber: order.mechximizeDcNumber ?? "",
  });
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [vendorId, setVendorId] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [creatingDc, setCreatingDc] = useState(false);
  const [dcError, setDcError] = useState<string | null>(null);

  // Load vendors when manufacturer DC is selected
  useEffect(() => {
    if (dcType === "manufacturer" && dcDialogOpen && vendors.length === 0) {
      setLoadingVendors(true);
      fetch("/api/vendors")
        .then((r) => r.json())
        .then((d) => setVendors(d.vendors ?? []))
        .finally(() => setLoadingVendors(false));
    }
  }, [dcType, dcDialogOpen, vendors.length]);

  const toggleCheck = (key: keyof OrderDispatchModuleData) => {
    setData((prev) => {
      const entry = prev[key] as CheckEntry;
      const updated = {
        ...prev,
        [key]: {
          ...entry,
          checked: !entry.checked,
          timestamp: !entry.checked ? new Date().toISOString() : undefined,
        },
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    setDirty(true);
  };

  const setField = (k: string, v: string) => {
    setData((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const handleSave = async (extraPatch?: Record<string, string>) => {
    setSaving(true);
    const patch: Record<string, any> = { dispatchModule: data };

    // Auto-transition to DISPATCHED when dispatched is checked and order is READY_FOR_DISPATCH
    if (data.dispatched.checked && order.status === "READY_FOR_DISPATCH") {
      patch.status = "DISPATCHED";
    }
    // Auto-transition to COMPLETED when received
    if (data.receivedByClient.checked && order.status === "DISPATCHED") {
      patch.status = "COMPLETED";
    }

    if (extraPatch) Object.assign(patch, extraPatch);

    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setDirty(false);
    onUpdate();
  };

  const openDcDialog = () => {
    setDcType("client");
    setDcForm({
      referenceNumber: order.clientDcNumber ?? "",
      mechximizeDcNumber: order.mechximizeDcNumber ?? "",
    });
    setSelectedPartIds(new Set(order.parts.map((p) => p.publicId)));
    setVendorId("");
    setDcError(null);
    setDcDialogOpen(true);
  };

  const togglePartSelection = (publicId: string) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) {
        next.delete(publicId);
      } else {
        next.add(publicId);
      }
      return next;
    });
  };

  const selectAllParts = () => {
    setSelectedPartIds(new Set(order.parts.map((p) => p.publicId)));
  };

  const deselectAllParts = () => {
    setSelectedPartIds(new Set());
  };

  const getPartDisplayName = (part: Order["parts"][number]) => {
    if (dcType === "client") {
      // Client DC: use partName or clientPartId (original names)
      return part.partName || part.clientPartId || part.publicId;
    }
    // Manufacturer DC: use the Drawing ID (publicId)
    return part.publicId;
  };

  const getRecipientId = () => {
    if (dcType === "client") {
      return (order.client as any).zohoContactId ?? order.client.id;
    }
    // Manufacturer DC: use selected vendor's zohoContactId
    const selectedVendor = vendors.find((v) => v.id === vendorId);
    return selectedVendor?.zohoContactId ?? vendorId;
  };

  const handleCreateZohoDC = async () => {
    if (selectedPartIds.size === 0) {
      setDcError("Select at least one part");
      return;
    }
    if (dcType === "manufacturer" && !vendorId) {
      setDcError("Select a vendor for Manufacturer DC");
      return;
    }

    setCreatingDc(true);
    setDcError(null);

    const selectedParts = order.parts.filter((p) => selectedPartIds.has(p.publicId));

    // Build line items from selected parts with appropriate naming
    const lineItems = selectedParts.map((p) => ({
      item_id: p.publicId,
      name: getPartDisplayName(p),
      rate: (p as any).pricingModel?.clientUnitPriceUsd ?? 0,
      quantity: p.quantity,
    }));

    const res = await fetch("/api/zoho/delivery-challans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: getRecipientId(),
        salesorder_id: order.zohoSalesOrderId ?? undefined,
        reference_number: dcForm.referenceNumber || undefined,
        line_items: lineItems,
      }),
    });

    const d = await res.json();
    setCreatingDc(false);

    if (!res.ok) {
      setDcError(d.error ?? "Failed to create DC in Zoho");
      return;
    }

    // Save DC numbers to order and mark checklist
    const newData = {
      ...data,
      deliveryChallanGenerated: { checked: true, timestamp: new Date().toISOString(), documentNumber: d.deliveryChallanNumber },
    };
    setData(newData);

    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dispatchModule: newData,
        mechximizeDcNumber: d.deliveryChallanNumber,
        clientDcNumber: dcForm.referenceNumber || undefined,
      }),
    });

    setDcDialogOpen(false);
    setDirty(false);
    onUpdate();
  };

  const done = [
    data.inspectionReportGenerated.checked,
    data.deliveryChallanGenerated.checked,
    data.invoiceGenerated.checked,
    data.packagingCompleted.checked,
    data.dispatched.checked,
    data.receivedByClient.checked,
  ].filter(Boolean).length;

  const dispatchComplete = done === 6;

  return (
    <>
      <Card className={dispatchComplete ? "border-green-200" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" /> Dispatch Checklist
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${done === 6 ? "text-green-600" : "text-muted-foreground"}`}>{done}/6 done</span>
              {dirty && (
                <Button size="sm" onClick={() => handleSave()} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logistics details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Transporter</Label>
              <Input
                value={data.transporter ?? ""}
                onChange={(e) => setField("transporter", e.target.value)}
                placeholder="Courier / Transport name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tracking / AWB Number</Label>
              <Input
                value={data.trackingNumber ?? ""}
                onChange={(e) => setField("trackingNumber", e.target.value)}
                placeholder="Docket / AWB"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scheduled Dispatch Date</Label>
              <Input
                type="date"
                value={data.scheduledDate ?? ""}
                onChange={(e) => setField("scheduledDate", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Actual Dispatch Date</Label>
              <Input
                type="date"
                value={data.actualDate ?? ""}
                onChange={(e) => setField("actualDate", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* DC Numbers */}
          {(order.mechximizeDcNumber || order.clientDcNumber) && (
            <div className="flex flex-wrap gap-3 text-xs bg-slate-50 rounded-lg p-2.5 border">
              {order.mechximizeDcNumber && (
                <span>Mechximize DC: <span className="font-mono font-semibold text-slate-700">{order.mechximizeDcNumber}</span></span>
              )}
              {order.clientDcNumber && (
                <span>Client DC Ref: <span className="font-mono font-semibold text-slate-700">{order.clientDcNumber}</span></span>
              )}
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-0.5 border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={openDcDialog}
              >
                <ExternalLink className="h-3 w-3 mr-1" /> Create Zoho DC
              </Button>
            </div>
            <CheckRow label="Inspection Report Generated" entry={data.inspectionReportGenerated} onToggle={() => toggleCheck("inspectionReportGenerated")} />
            <CheckRow
              label={`Delivery Challan Generated${data.deliveryChallanGenerated.documentNumber ? ` (${data.deliveryChallanGenerated.documentNumber})` : ""}`}
              entry={data.deliveryChallanGenerated}
              onToggle={() => toggleCheck("deliveryChallanGenerated")}
            />
            <CheckRow label="Invoice Generated" entry={data.invoiceGenerated} onToggle={() => toggleCheck("invoiceGenerated")} />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-2">Dispatch</p>
            <CheckRow label="Packaging Completed" entry={data.packagingCompleted} onToggle={() => toggleCheck("packagingCompleted")} />
            <CheckRow
              label="Dispatched to Client"
              entry={data.dispatched}
              onToggle={() => toggleCheck("dispatched")}
            />
            <CheckRow label="Received by Client" entry={data.receivedByClient} onToggle={() => toggleCheck("receivedByClient")} />
          </div>

          {/* Status auto-transition hint */}
          {data.dispatched.checked && order.status === "READY_FOR_DISPATCH" && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              Save to auto-transition order status to <strong>Dispatched</strong>.
            </div>
          )}
          {data.receivedByClient.checked && order.status === "DISPATCHED" && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              Save to mark order as <strong>Completed</strong>.
            </div>
          )}

          {data.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(data.updatedAt).toLocaleString("en-IN")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Zoho DC Creation Dialog */}
      <Dialog open={dcDialogOpen} onOpenChange={setDcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Delivery Challan in Zoho</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {/* DC Type Selector */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">DC Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDcType("client")}
                  className={`rounded-lg border-2 p-2.5 text-sm font-medium transition-colors text-center ${
                    dcType === "client"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-blue-300 text-slate-600"
                  }`}
                >
                  Client DC
                </button>
                <button
                  type="button"
                  onClick={() => setDcType("manufacturer")}
                  className={`rounded-lg border-2 p-2.5 text-sm font-medium transition-colors text-center ${
                    dcType === "manufacturer"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-blue-300 text-slate-600"
                  }`}
                >
                  Manufacturer DC
                </button>
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Recipient</Label>
              {dcType === "client" ? (
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 border text-sm text-slate-700">
                  <span className="font-medium">{order.client.name}</span>
                  <Badge variant="secondary" className="text-xs">Client</Badge>
                </div>
              ) : (
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  <option value="">
                    {loadingVendors ? "Loading vendors..." : "Select a vendor"}
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.zohoContactId ? "" : " (no Zoho ID)"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference Number (optional)</Label>
              <Input
                value={dcForm.referenceNumber}
                onChange={(e) => setDcForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                placeholder={dcType === "client" ? "Client-provided DC / PO ref" : "Internal reference"}
                className="h-8 text-sm"
              />
            </div>

            {/* Part selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Parts to include</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllParts}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllParts}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg border max-h-48 overflow-y-auto">
                {order.parts.map((p) => {
                  const isSelected = selectedPartIds.has(p.publicId);
                  return (
                    <label
                      key={p.publicId}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors border-b last:border-b-0 ${
                        isSelected ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePartSelection(p.publicId)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="flex-1 text-xs font-mono">
                        {getPartDisplayName(p)}
                      </span>
                      <span className="text-xs text-muted-foreground">x{p.quantity}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedPartIds.size} of {order.parts.length} parts selected
              </p>
            </div>

            {!order.zohoSalesOrderId && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                No Zoho Sales Order linked to this order. DC will be created without a sales order reference.
              </div>
            )}
            {dcError && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {dcError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDcDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateZohoDC} disabled={creatingDc}>
              {creatingDc ? "Creating..." : "Create in Zoho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
