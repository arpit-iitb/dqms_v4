"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Package, Calendar, ClipboardList, FileText } from "lucide-react";

interface PartEntry {
  groupedRfqPartId: string;
  part: {
    id: string;
    publicId: string;
    partName: string | null;
    materialName: string | null;
    quantity: number;
  };
  existingQuote: {
    unitPriceUsd: number | null;
    leadTimeDays: number | null;
    notes: string | null;
  } | null;
  hasDrawing: boolean;
}

interface RFQData {
  rfq: {
    id: string;
    publicId: string;
    dueDate: string;
    coverNote: string | null;
    orderDisplayId: string;
    locked: boolean;
    status: string;
  };
  vendor: { id: string; name: string };
  vendorRfqId: string;
  submittedAt: string | null;
  overallNotes: string | null;
  parts: PartEntry[];
}

interface QuoteEntry {
  unitPriceUsd: string;
  leadTimeDays: string;
  notes: string;
  includesManufacturing: boolean;
  includesMaterial: boolean;
  includesDelivery: boolean;
}

export default function VendorPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<RFQData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, QuoteEntry>>({});
  const [overallNotes, setOverallNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/vendor-portal/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setOverallNotes(d.overallNotes ?? "");
        // Pre-fill quotes from existing data
        const initial: Record<string, QuoteEntry> = {};
        for (const p of d.parts) {
          const breakdown = p.existingQuote?.quoteBreakdown as any ?? {};
          initial[p.groupedRfqPartId] = {
            unitPriceUsd: p.existingQuote?.unitPriceUsd != null ? String(p.existingQuote.unitPriceUsd) : "",
            leadTimeDays: p.existingQuote?.leadTimeDays != null ? String(p.existingQuote.leadTimeDays) : "",
            notes: p.existingQuote?.notes ?? "",
            includesManufacturing: breakdown.includesManufacturing ?? false,
            includesMaterial: breakdown.includesMaterial ?? false,
            includesDelivery: breakdown.includesDelivery ?? false,
          };
        }
        setQuotes(initial);
        if (d.submittedAt) setSubmitted(true);
      })
      .catch(() => setError("Failed to load RFQ"))
      .finally(() => setLoading(false));
  }, [token]);

  const setQuoteField = (partId: string, field: keyof QuoteEntry, value: string | boolean) => {
    setQuotes((p) => ({ ...p, [partId]: { ...p[partId], [field]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    const payload = {
      overallNotes,
      quotes: data.parts.map((p) => ({
        groupedRfqPartId: p.groupedRfqPartId,
        unitPriceUsd: quotes[p.groupedRfqPartId]?.unitPriceUsd
          ? parseFloat(quotes[p.groupedRfqPartId].unitPriceUsd) : null,
        leadTimeDays: quotes[p.groupedRfqPartId]?.leadTimeDays
          ? parseInt(quotes[p.groupedRfqPartId].leadTimeDays) : null,
        notes: quotes[p.groupedRfqPartId]?.notes || null,
        quoteBreakdown: {
          includesManufacturing: quotes[p.groupedRfqPartId]?.includesManufacturing ?? false,
          includesMaterial: quotes[p.groupedRfqPartId]?.includesMaterial ?? false,
          includesDelivery: quotes[p.groupedRfqPartId]?.includesDelivery ?? false,
        },
      })),
    };
    const res = await fetch(`/api/vendor-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const d = await res.json();
      setError(d.error || "Submission failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-sm w-full m-4">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              This link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Mechximize — Vendor Portal</p>
        <h1 className="text-lg font-bold">Request for Quotation</h1>
        <p className="text-sm text-slate-300 mt-0.5">
          {data.rfq.publicId} · Order {data.rfq.orderDisplayId}
        </p>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Info card */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold">{data.vendor.name}</p>
                <p className="text-xs text-muted-foreground">Vendor</p>
              </div>
              <Badge className={data.rfq.locked ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}>
                {data.rfq.locked ? "Locked" : data.rfq.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Due: {new Date(data.rfq.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            {data.rfq.coverNote && (
              <p className="text-sm text-slate-700 bg-slate-50 rounded p-2 border">{data.rfq.coverNote}</p>
            )}
          </CardContent>
        </Card>

        {/* Success state */}
        {submitted && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Quote submitted successfully</p>
                <p className="text-xs text-green-700">
                  {data.submittedAt
                    ? `Submitted on ${new Date(data.submittedAt).toLocaleDateString("en-IN")}`
                    : "Your response has been recorded"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote form */}
        {!data.rfq.locked && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Parts ({data.parts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 divide-y">
                {data.parts.map((entry) => (
                  <div key={entry.groupedRfqPartId} className="pt-4 first:pt-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold font-mono">{entry.part.publicId}</p>
                          {entry.part.partName && (
                            <p className="text-xs text-muted-foreground">{entry.part.partName}</p>
                          )}
                          <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                            {entry.part.materialName && <span>Material: {entry.part.materialName}</span>}
                            <span>Qty: {entry.part.quantity}</span>
                          </div>
                        </div>
                      </div>
                      {entry.hasDrawing && (
                        <a
                          href={`/api/vendor-portal/${token}/drawing/${entry.part.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors flex-shrink-0"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View Drawing
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={quotes[entry.groupedRfqPartId]?.unitPriceUsd ?? ""}
                          onChange={(e) => setQuoteField(entry.groupedRfqPartId, "unitPriceUsd", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lead Time (days)</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 14"
                          value={quotes[entry.groupedRfqPartId]?.leadTimeDays ?? ""}
                          onChange={(e) => setQuoteField(entry.groupedRfqPartId, "leadTimeDays", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Part Notes (optional)</Label>
                        <Input
                          placeholder="Any remarks for this part..."
                          value={quotes[entry.groupedRfqPartId]?.notes ?? ""}
                          onChange={(e) => setQuoteField(entry.groupedRfqPartId, "notes", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Price Includes</Label>
                        <div className="flex gap-4">
                          {([
                            { key: "includesManufacturing", label: "Manufacturing Cost" },
                            { key: "includesMaterial", label: "Material Cost" },
                            { key: "includesDelivery", label: "Delivery Cost" },
                          ] as const).map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={quotes[entry.groupedRfqPartId]?.[key] ?? false}
                                onChange={(e) => setQuoteField(entry.groupedRfqPartId, key, e.target.checked)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-xs">Overall Notes / Terms (optional)</Label>
                <Textarea
                  value={overallNotes}
                  onChange={(e) => setOverallNotes(e.target.value)}
                  placeholder="Payment terms, delivery conditions, general remarks..."
                  rows={3}
                />
              </CardContent>
            </Card>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting..." : submitted ? "Update Quote" : "Submit Quote"}
            </Button>
          </form>
        )}

        {data.rfq.locked && (
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              This RFQ is locked and no longer accepting responses.
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground pb-8">
          Mechximize — For any queries, reply to the email you received.
        </p>
      </div>
    </div>
  );
}
