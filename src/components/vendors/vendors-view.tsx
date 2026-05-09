"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Truck, X, ChevronDown } from "lucide-react";

interface ManufacturingProcess {
  id: string;
  name: string;
  category: string;
}

interface VendorCapability {
  id: string;
  processId: string;
  process: ManufacturingProcess;
}

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  email: string;
  contactPerson: string | null;
  contactPhone: string | null;
  specialization: string | null;
  gstin: string | null;
  isActive: boolean;
  capabilities?: VendorCapability[];
}

const EMPTY_FORM = {
  name: "", email: "", contactPerson: "", contactPhone: "", specialization: "", gstin: "",
};

export function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Process capabilities
  const [allProcesses, setAllProcesses] = useState<ManufacturingProcess[]>([]);
  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);
  const [processDropdownOpen, setProcessDropdownOpen] = useState(false);
  const [addingNewProcess, setAddingNewProcess] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [newProcessCategory, setNewProcessCategory] = useState("");

  const loadProcesses = () => {
    fetch("/api/manufacturing-processes")
      .then((r) => r.json())
      .then((d) => setAllProcesses(d.processes ?? []));
  };

  useEffect(() => { loadProcesses(); }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (showAll) params.set("active", "false");
    fetch(`/api/vendors?${params}`)
      .then((r) => r.json())
      .then((d) => setVendors(d.vendors ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, showAll]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedProcessIds([]);
    setAddingNewProcess(false);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      name: v.name, email: v.email,
      contactPerson: v.contactPerson ?? "",
      contactPhone: v.contactPhone ?? "",
      specialization: v.specialization ?? "",
      gstin: v.gstin ?? "",
    });
    setSelectedProcessIds(v.capabilities?.map((c) => c.processId) ?? []);
    setAddingNewProcess(false);
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { setError("Name and email are required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, processIds: selectedProcessIds };
      const res = editing
        ? await fetch(`/api/vendors/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/vendors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save vendor");
        return;
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: Vendor) => {
    await fetch(`/api/vendors/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    load();
  };

  const set = (k: string, val: string) => setForm((p) => ({ ...p, [k]: val }));

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll((v) => !v)}
          className={showAll ? "border-slate-400" : ""}
        >
          {showAll ? "All" : "Active only"}
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Vendor
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-16 animate-pulse bg-slate-50" /></Card>
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No vendors found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendors.map((v) => (
            <Card key={v.id} className={`${!v.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm flex-shrink-0">
                    {v.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{v.name}</p>
                      <span className="text-xs text-muted-foreground font-mono">{v.vendorCode}</span>
                      {!v.isActive && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{v.email}</p>
                    {v.specialization && (
                      <p className="text-xs text-slate-500 truncate">{v.specialization}</p>
                    )}
                    {v.capabilities && v.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.capabilities.map((c) => (
                          <Badge key={c.id} variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                            {c.process.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(v)} className="h-8 w-8 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(v)}
                    className="h-8 w-8 p-0 text-muted-foreground"
                    title={v.isActive ? "Deactivate" : "Activate"}
                  >
                    {v.isActive
                      ? <ToggleRight className="h-4 w-4 text-emerald-600" />
                      : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Vendor name" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="vendor@example.com" />
              </div>
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+91 99999 00000" />
              </div>
              <div className="space-y-1">
                <Label>Specialization</Label>
                <Input value={form.specialization} onChange={(e) => set("specialization", e.target.value)} placeholder="CNC Machining, etc." />
              </div>
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} placeholder="27AAAAA0000A1Z5" />
              </div>
            </div>

            {/* Process capabilities selector */}
            <div className="space-y-1.5">
              <Label>Manufacturing Processes</Label>
              {selectedProcessIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {selectedProcessIds.map((pid) => {
                    const proc = allProcesses.find((p) => p.id === pid);
                    return proc ? (
                      <Badge key={pid} variant="outline" className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200 gap-1">
                        {proc.name}
                        <button
                          type="button"
                          onClick={() => setSelectedProcessIds((prev) => prev.filter((x) => x !== pid))}
                          className="ml-0.5 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProcessDropdownOpen((v) => !v)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-left flex items-center justify-between text-muted-foreground"
                >
                  <span>{selectedProcessIds.length > 0 ? `${selectedProcessIds.length} selected` : "Select processes..."}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${processDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {processDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {(() => {
                      const grouped: Record<string, ManufacturingProcess[]> = {};
                      allProcesses.forEach((p) => {
                        if (!grouped[p.category]) grouped[p.category] = [];
                        grouped[p.category].push(p);
                      });
                      return Object.entries(grouped).map(([category, procs]) => (
                        <div key={category}>
                          <p className="text-xs font-semibold text-muted-foreground px-3 py-1.5 bg-slate-50 sticky top-0">{category}</p>
                          {procs.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedProcessIds.includes(p.id)}
                                onChange={() =>
                                  setSelectedProcessIds((prev) =>
                                    prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                  )
                                }
                                className="rounded"
                              />
                              <span className="text-xs">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      ));
                    })()}
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-blue-600 font-medium hover:bg-blue-50 border-t"
                      onClick={() => {
                        setAddingNewProcess(true);
                        setProcessDropdownOpen(false);
                      }}
                    >
                      <Plus className="h-3 w-3 inline mr-1" /> Add New Process
                    </button>
                  </div>
                )}
              </div>
              {addingNewProcess && (
                <div className="flex items-end gap-2 p-2 border rounded-md bg-slate-50">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={newProcessName}
                      onChange={(e) => setNewProcessName(e.target.value)}
                      placeholder="e.g. Laser Cutting"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Input
                      value={newProcessCategory}
                      onChange={(e) => setNewProcessCategory(e.target.value)}
                      placeholder="e.g. Cutting"
                      className="h-7 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!newProcessName || !newProcessCategory}
                    onClick={async () => {
                      const res = await fetch("/api/manufacturing-processes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: newProcessName, category: newProcessCategory }),
                      });
                      if (res.ok) {
                        const d = await res.json();
                        setAllProcesses((prev) => [...prev, d.process]);
                        setSelectedProcessIds((prev) => [...prev, d.process.id]);
                        setNewProcessName("");
                        setNewProcessCategory("");
                        setAddingNewProcess(false);
                      }
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setAddingNewProcess(false); setNewProcessName(""); setNewProcessCategory(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
