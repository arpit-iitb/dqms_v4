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
  RefreshCw, Loader2,
} from "lucide-react";
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_PIPELINE_STATUSES,
} from "@/lib/lead-utils";
import { formatDistanceToNow } from "date-fns";

const PIPELINE_STEPS = [
  { key: "LEAD", label: "Lead" },
  { key: "QUOTATION_IN_PROGRESS", label: "Quoting" },
  { key: "RFQ_SENT", label: "RFQ Sent" },
  { key: "QUOTED", label: "Quoted" },
  { key: "CLIENT_PROPOSAL_SENT", label: "Proposal Sent" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
];

interface Lead {
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

function PipelineFunnel({ leads }: { leads: Lead[] }) {
  const counts: Record<string, number> = {};
  for (const s of [...LEAD_PIPELINE_STATUSES, "WON", "LOST"]) counts[s] = 0;
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;

  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      {PIPELINE_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs ${LEAD_STATUS_COLORS[step.key] ?? "bg-slate-100"}`}>
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Create lead form
  const [form, setForm] = useState({ clientId: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Inline client creation
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "", email: "", contactPerson: "", contactPhone: "", address: "", gstin: "",
  });
  const [createInZoho, setCreateInZoho] = useState(true);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState("");
  const [syncingZoho, setSyncingZoho] = useState(false);

  const handleSyncZoho = async () => {
    setSyncingZoho(true);
    setClientError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-zoho" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      // Re-fetch clients
      const cRes = await fetch("/api/clients");
      const cData = await cRes.json();
      setClients(cData.clients ?? []);
    } catch (err: any) {
      setClientError(err.message);
    } finally {
      setSyncingZoho(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (search) params.set("search", search);
    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []))
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
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        status: "LEAD",
        notes: form.notes || null,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setCreateOpen(false);
    setForm({ clientId: "", notes: "" });
    router.push(`/leads/${data.lead.id}`);
  };

  const handleCreateClient = async () => {
    if (!clientForm.name || !clientForm.email) {
      setClientError("Name and email are required");
      return;
    }
    setCreatingClient(true);
    setClientError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...clientForm, createInZoho }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClientError(data.error || "Failed to create client");
        return;
      }
      // Add the new client to the list and select it
      const newClient = data.client;
      setClients((prev) => [...prev, { id: newClient.id, name: newClient.name, email: newClient.email }]);
      setForm((prev) => ({ ...prev, clientId: newClient.id }));
      // Reset inline form
      setShowNewClient(false);
      setClientForm({ name: "", email: "", contactPerson: "", contactPhone: "", address: "", gstin: "" });
      setCreateInZoho(true);
    } catch {
      setClientError("Failed to create client");
    } finally {
      setCreatingClient(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "CLIENT_PROPOSAL_SENT") return <SendHorizonal className="h-3.5 w-3.5" />;
    if (status === "QUOTED") return <CheckCircle2 className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Funnel */}
      <PipelineFunnel leads={leads} />

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
      ) : leads.length === 0 ? (
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
          {leads.map((lead) => (
            <Link key={lead.id} href={`/leads/${lead.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 font-mono">{lead.displayId}</span>
                        {lead.clientPoNumber && (
                          <span className="text-xs text-muted-foreground">PO: {lead.clientPoNumber}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.client.name}</p>
                      <p className="text-xs text-slate-400">
                        {lead._count.parts} part{lead._count.parts !== 1 ? "s" : ""} · updated {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {lead.deliveryDate && (
                      <span className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(lead.deliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <Badge className={`text-xs flex items-center gap-1 ${LEAD_STATUS_COLORS[lead.status] ?? ""}`}>
                      {statusIcon(lead.status)}
                      {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
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
              <div className="flex items-center gap-2">
                <select
                  value={form.clientId}
                  onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 flex-shrink-0"
                  onClick={() => setShowNewClient((v) => !v)}
                  title="Add new client"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 flex-shrink-0 text-xs gap-1"
                  onClick={handleSyncZoho}
                  disabled={syncingZoho}
                  title="Import clients from Zoho"
                >
                  {syncingZoho ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Zoho
                </Button>
              </div>
              {clients.length === 0 && !showNewClient && (
                <p className="text-xs text-muted-foreground">
                  No clients yet. Click + to add one, or sync from Zoho.
                </p>
              )}

              {/* Inline new client form */}
              {showNewClient && (
                <div className="border rounded-md p-3 space-y-2 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-700">New Client</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Input
                        placeholder="Name *"
                        value={clientForm.name}
                        onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="Email *"
                        type="email"
                        value={clientForm.email}
                        onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <Input
                      placeholder="Contact Person"
                      value={clientForm.contactPerson}
                      onChange={(e) => setClientForm((p) => ({ ...p, contactPerson: e.target.value }))}
                    />
                    <Input
                      placeholder="Contact Phone"
                      value={clientForm.contactPhone}
                      onChange={(e) => setClientForm((p) => ({ ...p, contactPhone: e.target.value }))}
                    />
                    <div className="col-span-2">
                      <Input
                        placeholder="Address"
                        value={clientForm.address}
                        onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="GSTIN"
                        value={clientForm.gstin}
                        onChange={(e) => setClientForm((p) => ({ ...p, gstin: e.target.value }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createInZoho}
                      onChange={(e) => setCreateInZoho(e.target.checked)}
                    />
                    Create in Zoho
                  </label>
                  {clientError && <p className="text-xs text-red-600">{clientError}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateClient}
                      disabled={creatingClient}
                    >
                      {creatingClient ? "Creating..." : "Create Client"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewClient(false);
                        setClientError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
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
