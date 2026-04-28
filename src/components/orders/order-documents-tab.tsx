"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, FileText, ExternalLink, Trash2 } from "lucide-react";

interface Document {
  id: string;
  documentType: string;
  documentNumber: string | null;
  url: string | null;
  notes: string | null;
  createdAt: string;
}

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

interface Props {
  orderId: string;
  documents: Document[];
  onUpdate: () => void;
}

export function OrderDocumentsTab({ orderId, documents, onUpdate }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ documentType: "OTHER", documentNumber: "", url: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    await fetch(`/api/orders/${orderId}/documents`, {
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
