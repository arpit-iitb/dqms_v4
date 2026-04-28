"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Calendar, AlertTriangle, TrendingUp,
  FileText, SendHorizonal, CheckCircle2, XCircle,
} from "lucide-react";
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PRE_SALES_STATUSES,
} from "@/lib/order-utils";
import { formatDistanceToNow } from "date-fns";

const PIPELINE_STEPS = [
  { key: "LEAD", label: "Lead" },
  { key: "QUOTATION_IN_PROGRESS", label: "Quoting" },
  { key: "RFQ_SENT", label: "RFQ Sent" },
  { key: "QUOTED", label: "Quoted" },
  { key: "CLIENT_PROPOSAL_SENT", label: "Proposal Sent" },
];

interface Order {
  id: string;
  displayId: string;
  status: string;
  orderDate: string | null;
  deliveryDate: string | null;
  clientPoNumber: string | null;
  notes: string | null;
  updatedAt: string;
  client: { id: string; name: string; email: string };
  _count: { parts: number };
}

interface Client {
  id: string;
  name: string;
  email: string;
}

function PipelineFunnel({ orders }: { orders: Order[] }) {
  const counts: Record<string, number> = {};
  for (const s of PRE_SALES_STATUSES) counts[s] = 0;
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;

  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      {PIPELINE_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs ${ORDER_STATUS_COLORS[step.key] ?? "bg-slate-100"}`}>
            <span className="font-bold text-base leading-none">{counts[step.key] ?? 0}</span>
            <span className="mt-0.5 opacity-80">{step.label}</span>
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <TrendingUp className="h-3.5 w-3.5 text-slate-300" />
          )}
        </div>
      ))}
    </div>
  );
}

export function QuotationsView() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Create lead form
  const [form, setForm] = useState({ clientId: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    // Always filter to pre-sales statuses unless a specific one is selected
    if (statusFilter) {
      params.set("status", statusFilter);
    } else {
      params.set("pipeline", "pre_sales");
    }
    if (search) params.set("search", search);
    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients ?? []));
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { setCreateError("Select a client"); return; }
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        status: "LEAD",
        notes: form.notes || null,
        orderDate: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setCreateOpen(false);
    setForm({ clientId: "", notes: "" });
    router.push(`/orders/${data.order.id}`);
  };

  const statusIcon = (status: string) => {
    if (status === "CLIENT_PROPOSAL_SENT") return <SendHorizonal className="h-3.5 w-3.5" />;
    if (status === "QUOTED") return <CheckCircle2 className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Funnel */}
      <PipelineFunnel orders={orders} />

      {/* Filters + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All stages</option>
          {PIPELINE_STEPS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Lead
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-20 animate-pulse bg-slate-50" /></Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-slate-600">No leads in pipeline</p>
          <p className="text-xs mt-1">Create a new lead to get started</p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Lead
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 font-mono">{order.displayId}</span>
                        {order.clientPoNumber && (
                          <span className="text-xs text-muted-foreground">PO: {order.clientPoNumber}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.client.name}</p>
                      <p className="text-xs text-slate-400">
                        {order._count.parts} part{order._count.parts !== 1 ? "s" : ""} · updated {formatDistanceToNow(new Date(order.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {order.deliveryDate && (
                      <span className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(order.deliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <Badge className={`text-xs flex items-center gap-1 ${ORDER_STATUS_COLORS[order.status] ?? ""}`}>
                      {statusIcon(order.status)}
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateLead} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No clients yet. <a href="/clients" className="text-blue-600 hover:underline">Add one first</a>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Brief description of the enquiry..."
                rows={3}
              />
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Lead"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
