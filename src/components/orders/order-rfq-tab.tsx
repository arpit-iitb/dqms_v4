"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Send, Package, Users, Calendar, CheckCircle2, Clock, Link as LinkIcon,
} from "lucide-react";

interface Part {
  id: string;
  publicId: string;
  partName: string | null;
  quantity: number;
  state: string;
}

interface Vendor {
  id: string;
  name: string;
  email: string | null;
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

const RFQ_STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-amber-100 text-amber-700",
  QUOTED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

interface Props {
  orderId: string;
  parts: Part[];
  onUpdate: () => void;
}

export function OrderRFQTab({ orderId, parts, onUpdate }: Props) {
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

  const load = useCallback(async () => {
    setLoading(true);
    const [rfqRes, vendorRes] = await Promise.all([
      fetch(`/api/orders/${orderId}/rfq`).then((r) => r.json()),
      fetch("/api/vendors").then((r) => r.json()),
    ]);
    setRfqs(rfqRes.rfqs ?? []);
    setVendors(vendorRes.vendors ?? []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const toggleId = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partIds.length) { setCreateError("Select at least one part"); return; }
    if (!form.vendorIds.length) { setCreateError("Select at least one vendor"); return; }
    if (!form.dueDate) { setCreateError("Due date required"); return; }
    setCreating(true);
    setCreateError("");
    const res = await fetch(`/api/orders/${orderId}/rfq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setCreateOpen(false);
    setForm({ partIds: [], vendorIds: [], dueDate: "", coverNote: "" });
    load();
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
                {/* Parts */}
                <div className="flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600">
                    {rfq.parts.map((p) => p.part.publicId).join(", ")}
                  </p>
                </div>
                {rfq.coverNote && (
                  <p className="text-xs text-muted-foreground bg-slate-50 rounded p-2">{rfq.coverNote}</p>
                )}
                {/* Vendors */}
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
            {/* Parts */}
            <div className="space-y-1.5">
              <Label className="text-sm">Select Parts *</Label>
              {parts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No parts on this order yet.</p>
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

            {/* Vendors */}
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

            {/* Due date + notes */}
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
