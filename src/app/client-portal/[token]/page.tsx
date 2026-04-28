"use client";

import { use, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, IndianRupee, Package, AlertCircle } from "lucide-react";

interface ClientQuoteData {
  id: string;
  accessToken: string;
  unitPriceUsd: number;
  quantity: number;
  totalPriceUsd: number;
  leadTimeDays: number;
  notes: string | null;
  status: string;
  pricingModel: {
    selectedVendorName: string | null;
    marginPercent: number;
    part: {
      publicId: string;
      partName: string | null;
      description: string | null;
      materialName: string | null;
      materialGrade: string | null;
      surfaceTreatment: string | null;
      quantity: number;
      order: {
        displayId: string;
        client: { name: string };
      };
    };
  };
}

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ClientQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    fetch(`/api/client-portal/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.clientQuote) setData(d.clientQuote);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async (action: "accept" | "reject") => {
    setActing(true);
    const res = await fetch(`/api/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (res.ok) {
      setDone(action === "accept" ? "accepted" : "rejected");
      setData((prev) => prev ? { ...prev, status: d.clientQuote?.status ?? prev.status } : prev);
    }
    setActing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading quote...</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">Quote Not Found</p>
            <p className="text-sm text-muted-foreground mt-1">This link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { pricingModel: pm } = data;
  const part = pm.part;
  const alreadyResponded = data.status !== "SENT";

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Mechximize</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Quotation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Order <span className="font-mono font-semibold text-slate-700">{part.order.displayId}</span>
            {" · "}{part.order.client.name}
          </p>
        </div>

        {/* Status banner */}
        {done === "accepted" && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">You have accepted this quotation. Our team will be in touch shortly.</p>
          </div>
        )}
        {done === "rejected" && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">You have declined this quotation.</p>
          </div>
        )}
        {alreadyResponded && !done && (
          <div className="flex items-center gap-2 bg-slate-100 border rounded-lg px-4 py-3 text-slate-600">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              This quote has already been <span className="font-semibold">{data.status.toLowerCase()}</span>.
            </p>
          </div>
        )}

        {/* Part details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" /> Part Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Drawing ID</span>
              <span className="font-mono font-semibold">{part.publicId}</span>
            </div>
            {part.partName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Part Name</span>
                <span className="font-medium">{part.partName}</span>
              </div>
            )}
            {part.description && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground flex-shrink-0">Description</span>
                <span className="text-right">{part.description}</span>
              </div>
            )}
            {part.materialName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material</span>
                <span>{part.materialName}{part.materialGrade ? ` ${part.materialGrade}` : ""}</span>
              </div>
            )}
            {part.surfaceTreatment && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Surface</span>
                <span>{part.surfaceTreatment}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">{part.quantity} pcs</span>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" /> Quotation Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Unit Price</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  ₹{data.unitPriceUsd.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{data.quantity} pcs</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <p className="text-sm font-medium text-blue-800">Total Amount</p>
              <p className="text-xl font-bold text-blue-900">₹{data.totalPriceUsd.toLocaleString("en-IN")}</p>
            </div>
            {data.leadTimeDays > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Estimated delivery: <span className="font-semibold">{data.leadTimeDays} working days</span>
              </div>
            )}
            {data.notes && (
              <p className="text-xs text-muted-foreground bg-slate-50 rounded p-2 border">{data.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        {!alreadyResponded && !done && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => respond("reject")}
              disabled={acting}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button
              onClick={() => respond("accept")}
              disabled={acting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {acting ? "Processing..." : "Accept Quote"}
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by Mechximize · This link is unique to your order
        </p>
      </div>
    </div>
  );
}
