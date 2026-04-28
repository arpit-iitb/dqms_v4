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
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Truck } from "lucide-react";

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
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { setError("Name and email are required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = editing
        ? await fetch(`/api/vendors/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch("/api/vendors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
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
