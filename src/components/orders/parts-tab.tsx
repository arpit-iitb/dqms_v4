"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ChevronRight, Trash2, Package } from "lucide-react";
import { generateDrawingId } from "@/lib/client-id-generator";

interface Part {
  id: string;
  publicId: string;
  state: string;
  partName: string | null;
  quantity: number;
  createdAt: string;
}

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

interface PartsTabProps {
  order: { id: string; parts: Part[] };
  onUpdate: () => void;
}

export function PartsTab({ order, onUpdate }: PartsTabProps) {
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddPart = async () => {
    setAdding(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/parts`, {
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
        <p className="text-sm text-muted-foreground">{order.parts.length} part{order.parts.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={handleAddPart} disabled={adding}>
          <Plus className="h-4 w-4 mr-1" />
          {adding ? "Adding..." : "Add Part"}
        </Button>
      </div>

      {order.parts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No parts yet</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={handleAddPart} disabled={adding}>
            Add first part
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {order.parts.map((part) => (
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
