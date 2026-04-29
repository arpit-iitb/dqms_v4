"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Calendar, Clock, Edit, AlertTriangle, AlertCircle,
  Package, Trash2,
} from "lucide-react";
import {
  SO_STATUS_LABELS, SO_STATUS_COLORS, PRODUCTION_STATUSES, SO_MANUAL_NEXT,
  isOverdue, isDueWithinDays,
} from "@/lib/order-utils";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { PartsTab } from "./parts-tab";
import { OrderEmailLogTab } from "./order-email-log-tab";
import { OrderDocumentsTab } from "./order-documents-tab";
import { OrderDispatchModule } from "./order-dispatch-module";
import { OrderRFQTab } from "./order-rfq-tab";
import { ZohoEstimateDialog } from "./zoho-estimate-dialog";
import { ZohoActionsPanel } from "./zoho-actions-panel";

interface Order {
  id: string;
  displayId: string;
  internalQuoteNumber: string | null;
  status: string;
  orderDate: string | null;
  deliveryDate: string | null;
  deliveryDatePO: string | null;
  clientPoNumber: string | null;
  clientDcNumber: string | null;
  mechximizeDcNumber: string | null;
  zohoSalesOrderId: string | null;
  updateSchedule: string[];
  updatesDone: boolean[];
  dispatchModule: any;
  notes: string | null;
  client: { id: string; name: string; email: string; contactPerson: string | null };
  lead?: { id: string; displayId: string } | null;
  parts: Array<{ id: string; publicId: string; state: string; partName: string | null; quantity: number; createdAt: string }>;
  emailLogs: any[];
  documents: any[];
}

const FINAL_STATUSES = ["COMPLETED", "CANCELLED", "DISPATCHED"];

export function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [zohoEstimateDialogOpen, setZohoEstimateDialogOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => { if (d.order) setOrder(d.order); })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const updateOrder = async (patch: Partial<Order>) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json();
    if (d.order) setOrder((prev) => prev ? { ...prev, ...d.order } : d.order);
    return d;
  };

  const handleStatusChange = async () => {
    if (!nextStatus) return;
    setSavingStatus(true);
    await updateOrder({ status: nextStatus as any });
    setSavingStatus(false);
    setStatusDialogOpen(false);
    setNextStatus("");
  };

  const handleAcknowledgeUpdate = async (index: number) => {
    if (!order) return;
    const updatesDone = [...order.updatesDone];
    updatesDone[index] = true;
    await updateOrder({ updatesDone } as any);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete order ${order?.displayId}? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    router.push("/orders");
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 animate-pulse rounded" />
        <div className="h-48 bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-6 text-muted-foreground">Order not found</div>;
  }

  const overdue = isOverdue(order.deliveryDate, order.status);
  const urgent = isDueWithinDays(order.deliveryDate, order.status, 3);
  const daysLeft = order.deliveryDate
    ? differenceInDays(new Date(order.deliveryDate), new Date())
    : null;
  const isFinal = FINAL_STATUSES.includes(order.status);
  const nextOptions = SO_MANUAL_NEXT[order.status] ?? [];
  const pendingUpdates = order.updateSchedule
    .map((date, i) => ({ date, index: i, done: order.updatesDone[i] ?? false }))
    .filter((u) => !u.done && new Date(u.date) <= new Date())
    .filter(() => !FINAL_STATUSES.includes(order.status));

  // Compute overall progress from parts (based on part states)
  const partStateWeight: Record<string, number> = {
    DRAFT: 0, FILES_RECEIVED: 1, SANITIZED: 2, RFQ_SENT: 3,
    QUOTED: 4, PRICED: 5, CLIENT_APPROVED: 6, PLANNED: 7,
    IN_EXECUTION: 8, COMPLETED: 9, SHIPPED: 10, CLOSED: 11,
  };
  const maxWeight = 11;
  const totalProgress = order.parts.length > 0
    ? Math.round(order.parts.reduce((sum, p) => sum + (partStateWeight[p.state] ?? 0), 0) / (order.parts.length * maxWeight) * 100)
    : 0;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Alerts */}
      {pendingUpdates.map((u) => (
        <Alert key={u.index} className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 flex items-center justify-between">
            <span>Client Update Due — {new Date(u.date).toLocaleDateString()}</span>
            <button
              onClick={() => handleAcknowledgeUpdate(u.index)}
              className="text-xs font-semibold bg-amber-200 hover:bg-amber-300 text-amber-800 rounded px-2 py-0.5 ml-4"
            >
              Mark Done
            </button>
          </AlertTitle>
          <AlertDescription className="text-amber-700 text-xs">
            Send a production progress update to {order.client.name}.
          </AlertDescription>
        </Alert>
      ))}
      {overdue && (
        <Alert className="border-red-400 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-700">Overdue</AlertTitle>
          <AlertDescription className="text-red-600 text-xs">
            Delivery date {new Date(order.deliveryDate!).toLocaleDateString()} has passed.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/orders" className="hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-slate-800">{order.displayId}</span>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{order.displayId}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {order.client.name}
                {order.clientPoNumber && <> · PO: <span className="font-medium text-slate-700">{order.clientPoNumber}</span></>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <Badge className={`${SO_STATUS_COLORS[order.status]} text-sm px-3 py-1`}>
                {SO_STATUS_LABELS[order.status] ?? order.status}
              </Badge>
              {!isFinal && nextOptions.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
                  Update Status
                </Button>
              )}
              <Link href={`/orders/${order.id}/edit`}>
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
            {order.orderDate && (
              <div>
                <p className="text-xs text-muted-foreground">Order Date</p>
                <p className="font-medium">{new Date(order.orderDate).toLocaleDateString("en-IN")}</p>
              </div>
            )}
            {order.deliveryDate && (
              <div>
                <p className="text-xs text-muted-foreground">Delivery (Commitment)</p>
                <p className={`font-medium ${overdue ? "text-red-600" : urgent ? "text-amber-600" : ""}`}>
                  {new Date(order.deliveryDate).toLocaleDateString("en-IN")}
                  {daysLeft !== null && !overdue && (
                    <span className="text-xs text-muted-foreground ml-1">({daysLeft}d)</span>
                  )}
                </p>
              </div>
            )}
            {order.deliveryDatePO && (
              <div>
                <p className="text-xs text-muted-foreground">Delivery (PO)</p>
                <p className="font-medium">{new Date(order.deliveryDatePO).toLocaleDateString("en-IN")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Parts</p>
              <p className="font-medium">{order.parts.length} part{order.parts.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Progress bar */}
          {PRODUCTION_STATUSES.includes(order.status) && order.parts.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-medium text-slate-600">Overall Progress</span>
                <span className="font-semibold text-slate-700">{totalProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalProgress === 100 ? "bg-emerald-500" : totalProgress >= 60 ? "bg-green-500" : totalProgress > 0 ? "bg-amber-500" : "bg-slate-200"}`}
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Lead reference */}
          {order.lead && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Converted from{" "}
              <Link href={`/leads/${order.lead.id}`} className="font-mono text-blue-600 hover:underline">
                {order.lead.displayId}
              </Link>
            </div>
          )}

          {/* Reference numbers */}
          {(order.clientDcNumber || order.mechximizeDcNumber) && (
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
              {order.clientDcNumber && <span>Client DC: <span className="font-mono text-slate-700">{order.clientDcNumber}</span></span>}
              {order.mechximizeDcNumber && <span>Mechximize DC: <span className="font-mono text-slate-700">{order.mechximizeDcNumber}</span></span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zoho Actions Panel */}
      <ZohoActionsPanel
        entityType="salesOrder"
        entityId={order.id}
        zohoSalesOrderId={order.zohoSalesOrderId}
        displayId={order.displayId}
        onUpdate={load}
        onOpenEstimateDialog={() => setZohoEstimateDialogOpen(true)}
      />

      {/* Tabs */}
      <Tabs defaultValue="parts">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger value="parts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Parts ({order.parts.length})
          </TabsTrigger>
          <TabsTrigger value="rfq" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            RFQ
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Dispatch
          </TabsTrigger>
          <TabsTrigger value="emails" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Emails ({order.emailLogs.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">
            Documents ({order.documents.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="pt-4">
          <PartsTab order={order} onUpdate={load} />
        </TabsContent>
        <TabsContent value="rfq" className="pt-4">
          <OrderRFQTab orderId={order.id} parts={order.parts} onUpdate={load} />
        </TabsContent>
        <TabsContent value="dispatch" className="pt-4">
          <OrderDispatchModule order={order as any} onUpdate={load} />
        </TabsContent>
        <TabsContent value="emails" className="pt-4">
          <OrderEmailLogTab
            orderId={order.id}
            emailLogs={order.emailLogs}
            onUpdate={load}
            orderContext={{
              displayId: order.displayId,
              clientName: order.client.name,
              clientEmail: order.client.email,
              deliveryDate: order.deliveryDate,
            }}
          />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <OrderDocumentsTab orderId={order.id} documents={order.documents} onUpdate={load} />
        </TabsContent>
      </Tabs>

      {/* Zoho Estimate dialog */}
      <ZohoEstimateDialog
        open={zohoEstimateDialogOpen}
        onOpenChange={setZohoEstimateDialogOpen}
        orderId={order.id}
        orderDisplayId={order.displayId}
        onSuccess={(estimateNumber) => {
          load(); // refresh order to show new zohoQuotationId
        }}
      />

      {/* Status update dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Current: <Badge className={SO_STATUS_COLORS[order.status]}>{SO_STATUS_LABELS[order.status]}</Badge>
            </p>
            <div className="space-y-2">
              {nextOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setNextStatus(s === nextStatus ? "" : s)}
                  className={`w-full text-left rounded-lg border-2 p-3 text-sm font-semibold transition-colors ${nextStatus === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-blue-300 text-slate-600"}`}
                >
                  {SO_STATUS_LABELS[s] ?? s}
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
    </div>
  );
}
