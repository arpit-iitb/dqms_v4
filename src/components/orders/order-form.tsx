"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { buildUpdateSchedule } from "@/lib/order-utils";

interface Client {
  id: string;
  name: string;
  email: string;
}

interface OrderFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    clientId: string;
    status: string;
    orderDate: string | null;
    deliveryDate: string | null;
    deliveryDatePO: string | null;
    clientPoNumber: string | null;
    notes: string | null;
  };
}

export function OrderForm({ mode, initialData }: OrderFormProps) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    clientId: initialData?.clientId ?? "",
    orderDate: initialData?.orderDate ? initialData.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    deliveryDate: initialData?.deliveryDate ? initialData.deliveryDate.slice(0, 10) : "",
    deliveryDatePO: initialData?.deliveryDatePO ? initialData.deliveryDatePO.slice(0, 10) : "",
    clientPoNumber: initialData?.clientPoNumber ?? "",
    notes: initialData?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []));
  }, []);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { setError("Please select a client"); return; }
    if (!form.deliveryDate) { setError("Delivery date is required"); return; }
    setSaving(true);
    setError("");

    const updateSchedule = form.orderDate && form.deliveryDate
      ? buildUpdateSchedule(form.orderDate, form.deliveryDate)
      : [];

    try {
      const payload = {
        clientId: form.clientId,
        orderDate: form.orderDate || null,
        deliveryDate: form.deliveryDate || null,
        deliveryDatePO: form.deliveryDatePO || null,
        clientPoNumber: form.clientPoNumber || null,
        notes: form.notes || null,
        status: initialData?.status ?? "ORDER_CONFIRMED",
        updateSchedule,
        updatesDone: updateSchedule.map(() => false),
      };

      const res = mode === "create"
        ? await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/orders/${initialData!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      router.push(`/orders/${data.order.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "New Sales Order" : "Edit Order"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client */}
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <select
                value={form.clientId}
                onChange={(e) => set("clientId", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No clients yet.{" "}
                  <a href="/clients" className="text-blue-600 hover:underline">Add a client first</a>
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Order Date</Label>
                <Input type="date" value={form.orderDate} onChange={(e) => set("orderDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date (Commitment) *</Label>
                <Input type="date" value={form.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date (PO)</Label>
                <Input type="date" value={form.deliveryDatePO} onChange={(e) => set("deliveryDatePO", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Client PO Number</Label>
                <Input value={form.clientPoNumber} onChange={(e) => set("clientPoNumber", e.target.value)} placeholder="PO-12345" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Any additional notes..." />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : mode === "create" ? "Create Order" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
