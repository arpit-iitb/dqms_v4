"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileSearch, ClipboardList, AlertTriangle, TrendingUp,
  ArrowRight, Clock, IndianRupee,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DashboardStats {
  openLeads: number;
  activeOrders: number;
  overdueOrders: number;
  completedThisMonth: number;
  pendingClientQuotes: number;
  recentOrders: Array<{
    id: string;
    displayId: string;
    clientName: string;
    status: string;
    deliveryDate: string | null;
    updatedAt: string;
    partCount: number;
    completedParts: number;
  }>;
  recentLeads: Array<{
    id: string;
    displayId: string;
    clientName: string;
    status: string;
    createdAt: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  LEAD: "bg-slate-100 text-slate-700",
  QUOTATION_IN_PROGRESS: "bg-amber-100 text-amber-700",
  RFQ_SENT: "bg-blue-100 text-blue-700",
  QUOTED: "bg-purple-100 text-purple-700",
  CLIENT_PROPOSAL_SENT: "bg-indigo-100 text-indigo-700",
  ORDER_CONFIRMED: "bg-emerald-100 text-emerald-700",
  IN_PRODUCTION: "bg-cyan-100 text-cyan-700",
  INSPECTION: "bg-orange-100 text-orange-700",
  READY_FOR_DISPATCH: "bg-teal-100 text-teal-700",
  DISPATCHED: "bg-green-100 text-green-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  LOST: "bg-red-100 text-red-600",
  CANCELLED: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUOTATION_IN_PROGRESS: "Quotation",
  RFQ_SENT: "RFQ Sent",
  QUOTED: "Quoted",
  CLIENT_PROPOSAL_SENT: "Proposal Sent",
  ORDER_CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  INSPECTION: "Inspection",
  READY_FOR_DISPATCH: "Ready",
  DISPATCHED: "Dispatched",
  COMPLETED: "Completed",
  LOST: "Lost",
  CANCELLED: "Cancelled",
};

function StatCard({
  title, value, icon: Icon, color, href,
}: {
  title: string; value: number; icon: React.ElementType;
  color: string; href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color === "text-red-600" ? "bg-red-50" : "bg-slate-100"}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-5 h-20 animate-pulse bg-slate-50" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Open Leads" value={stats.openLeads} icon={FileSearch} color="text-blue-600" href="/quotations" />
        <StatCard title="Active Orders" value={stats.activeOrders} icon={ClipboardList} color="text-emerald-600" href="/orders" />
        <StatCard title="Overdue" value={stats.overdueOrders} icon={AlertTriangle} color="text-red-600" href="/orders?filter=overdue" />
        <StatCard title="Completed (Month)" value={stats.completedThisMonth} icon={TrendingUp} color="text-slate-600" href="/orders?filter=completed" />
        <StatCard title="Pending Quotes" value={stats.pendingClientQuotes} icon={IndianRupee} color="text-amber-600" href="/quotations" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Leads</CardTitle>
            <Link href="/quotations" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">No leads yet.</p>
            ) : (
              <div className="divide-y">
                {stats.recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/orders/${lead.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 font-mono">{lead.displayId}</p>
                      <p className="text-xs text-muted-foreground">{lead.clientName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs px-2 py-0.5 ${STATUS_COLORS[lead.status] || ""}`}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Orders */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Active Orders</CardTitle>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">No active orders.</p>
            ) : (
              <div className="divide-y">
                {stats.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 font-mono">{order.displayId}</p>
                      <p className="text-xs text-muted-foreground">{order.clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs px-2 py-0.5 ${STATUS_COLORS[order.status] || ""}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                        {order.deliveryDate && (
                          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(order.deliveryDate).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                      {order.partCount > 0 && (
                        <span className="text-xs text-muted-foreground">{order.completedParts}/{order.partCount} parts done</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
