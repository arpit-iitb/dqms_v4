"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  Plus, Search, Calendar, AlertTriangle, ClipboardList,
} from "lucide-react";
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ALL_STATUSES, isOverdue, isDueWithinDays,
} from "@/lib/order-utils";
import { formatDistanceToNow } from "date-fns";

interface Order {
  id: string;
  displayId: string;
  status: string;
  orderDate: string | null;
  deliveryDate: string | null;
  clientPoNumber: string | null;
  updatedAt: string;
  client: { id: string; name: string; email: string };
  _count: { parts: number };
}

export function OrdersView() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("filter") === "overdue" ? "overdue" : searchParams?.get("status") ?? "");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter === "overdue") params.set("filter", "overdue");
    else if (statusFilter === "completed") params.set("filter", "completed");
    else if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
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
          <option value="">All statuses</option>
          <option value="overdue">Overdue</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <Link href="/orders/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Order
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-20 animate-pulse bg-slate-50" /></Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No orders found</p>
          <Link href="/orders/new" className="mt-2 inline-block">
            <Button size="sm" variant="outline">Create first order</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const overdue = isOverdue(order.deliveryDate, order.status);
            const urgent = isDueWithinDays(order.deliveryDate, order.status, 3);
            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className={`hover:shadow-md transition-shadow cursor-pointer ${overdue ? "border-red-300" : urgent ? "border-amber-300" : ""}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {overdue && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 font-mono">{order.displayId}</span>
                          {order.clientPoNumber && (
                            <span className="text-xs text-muted-foreground">PO: {order.clientPoNumber}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.client.name}</p>
                        <p className="text-xs text-slate-400">
                          {order._count.parts} part{order._count.parts !== 1 ? "s" : ""} · updated {formatDistanceToNow(new Date(order.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {order.deliveryDate && (
                        <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" />
                          {new Date(order.deliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                      <Badge className={`text-xs ${ORDER_STATUS_COLORS[order.status] ?? ""}`}>
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
