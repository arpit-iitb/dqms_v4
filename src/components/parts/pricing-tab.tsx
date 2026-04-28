"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Lock, ExternalLink, IndianRupee, Clock, Copy, AlertCircle,
} from "lucide-react";

interface VendorQuote {
  id: string;
  rfqPublicId: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  unitPriceUsd: number | null;
  leadTimeDays: number | null;
  notes: string | null;
  submittedAt: string | null;
}

interface PricingModel {
  id: string;
  selectedGroupedQuoteId: string | null;
  selectedVendorName: string | null;
  selectedLeadTimeDays: number | null;
  vendorUnitPriceUsd: number;
  marginPercent: number;
  clientUnitPriceUsd: number;
  quantity: number;
  totalPriceUsd: number;
  locked: boolean;
  clientQuote: ClientQuote | null;
}

interface ClientQuote {
  id: string;
  accessToken: string;
  unitPriceUsd: number;
  quantity: number;
  totalPriceUsd: number;
  leadTimeDays: number;
  status: string;
}

interface Props {
  partId: string;
  onUpdate?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function PricingTab({ partId, onUpdate }: Props) {
  const [quotes, setQuotes] = useState<VendorQuote[]>([]);
  const [pricing, setPricing] = useState<PricingModel | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [marginPercent, setMarginPercent] = useState<string>("20");
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [copied, setCopied] = useState(false);


  const load = useCallback(async () => {
    const [qRes, pRes] = await Promise.all([
      fetch(`/api/parts/${partId}/quotes`),
      fetch(`/api/parts/${partId}/pricing`),
    ]);
    const [qData, pData] = await Promise.all([qRes.json(), pRes.json()]);
    setQuotes(qData.quotes ?? []);
    const p: PricingModel | null = pData.pricing ?? null;
    setPricing(p);
    if (p) {
      setMarginPercent(String(p.marginPercent));
      setSelectedQuoteId(p.selectedGroupedQuoteId ?? "");
    } else if ((qData.quotes ?? []).length > 0) {
      setSelectedQuoteId((qData.quotes as VendorQuote[])[0].id);
    }
    setLoading(false);
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);
  const unitPrice = selectedQuote?.unitPriceUsd ?? 0;
  const margin = parseFloat(marginPercent) || 0;
  const clientUnit = parseFloat((unitPrice * (1 + margin / 100)).toFixed(2));

  const handleSave = async () => {
    if (!selectedQuote && !pricing) return;
    setSaving(true);
    await fetch(`/api/parts/${partId}/pricing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupedPartQuoteId: selectedQuote?.id ?? pricing?.selectedGroupedQuoteId,
        vendorName: selectedQuote?.vendorName ?? pricing?.selectedVendorName,
        unitPriceUsd: selectedQuote?.unitPriceUsd ?? pricing?.vendorUnitPriceUsd,
        leadTimeDays: selectedQuote?.leadTimeDays ?? pricing?.selectedLeadTimeDays,
        marginPercent: margin,
      }),
    });
    setSaving(false);
    load();
    onUpdate?.();
  };

  const handleLock = async () => {
    if (!confirm("Lock pricing? This cannot be undone.")) return;
    setLocking(true);
    await fetch(`/api/parts/${partId}/pricing/lock`, { method: "POST" });
    setLocking(false);
    load();
    onUpdate?.();
  };

  const handleGenerateQuote = async () => {
    setGeneratingQuote(true);
    await fetch(`/api/parts/${partId}/pricing/client-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setGeneratingQuote(false);
    load();
  };

  const copyLink = () => {
    if (!pricing?.clientQuote) return;
    const url = `${window.location.origin}/client-portal/${pricing.clientQuote.accessToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Vendor Quotes */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">Vendor Quotes Received</p>
        {quotes.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
            <IndianRupee className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No vendor quotes yet.</p>
            <p className="text-xs mt-1">Send an RFQ from the RFQ tab and wait for responses.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => {
              const isSelected = selectedQuoteId === q.id;
              return (
                <Card
                  key={q.id}
                  className={`cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50/30 ring-1 ring-blue-300" : "hover:border-slate-300"} ${pricing?.locked ? "cursor-default" : ""}`}
                  onClick={() => { if (!pricing?.locked) setSelectedQuoteId(q.id); }}
                >
                  <CardContent className="p-3 flex items-center gap-4">
                    <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? "border-blue-500" : "border-slate-300"}`}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{q.vendorName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{q.vendorCode}</span>
                        <span className="text-xs text-muted-foreground">· RFQ {q.rfqPublicId}</span>
                      </div>
                      {q.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{q.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900">
                        ₹{q.unitPriceUsd?.toLocaleString("en-IN") ?? "—"} <span className="text-xs font-normal text-muted-foreground">/ unit</span>
                      </p>
                      {q.leadTimeDays != null && (
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />{q.leadTimeDays} days
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pricing Calculator */}
      {(quotes.length > 0 || pricing) && (
        <div className="border rounded-lg p-4 space-y-4 bg-slate-50/50">
          <p className="text-sm font-semibold text-slate-700">Pricing</p>

          {pricing?.locked && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <Lock className="h-3.5 w-3.5 flex-shrink-0" />
              Pricing is locked. Selected vendor: <span className="font-semibold">{pricing.selectedVendorName ?? "—"}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Vendor Price (unit)</p>
              <p className="font-mono font-semibold text-slate-800">
                ₹{(selectedQuote?.unitPriceUsd ?? pricing?.vendorUnitPriceUsd ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Margin %</p>
              {pricing?.locked ? (
                <p className="font-mono font-semibold text-slate-800">{pricing.marginPercent}%</p>
              ) : (
                <Input
                  type="number"
                  min="0"
                  max="500"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Client Price (unit)</p>
              <p className="font-mono font-bold text-blue-700 text-base">
                ₹{(pricing?.locked ? pricing.clientUnitPriceUsd : clientUnit).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total (× {pricing?.quantity ?? 1} qty)</p>
              <p className="font-mono font-bold text-emerald-700 text-base">
                ₹{(pricing?.locked
                  ? pricing.totalPriceUsd
                  : parseFloat((clientUnit * (pricing?.quantity ?? 1)).toFixed(2))
                ).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {!pricing?.locked && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || (!selectedQuote && !pricing)}
                className="flex-1"
              >
                {saving ? "Saving..." : pricing ? "Update Pricing" : "Save Pricing"}
              </Button>
              {pricing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLock}
                  disabled={locking}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  {locking ? "Locking..." : "Lock"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Client Quote */}
      {pricing?.locked && (
        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Client Quote</p>
          {pricing.clientQuote ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-slate-700">Quote generated</span>
                  <Badge className={STATUS_COLORS[pricing.clientQuote.status] ?? ""}>
                    {pricing.clientQuote.status}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyLink} className="flex-1">
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {copied ? "Copied!" : "Copy Client Link"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/client-portal/${pricing.clientQuote!.accessToken}`, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
              {pricing.clientQuote.status === "ACCEPTED" && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Client has accepted this quote.
                </div>
              )}
              {pricing.clientQuote.status === "REJECTED" && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5" /> Client has rejected this quote.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Generate a shareable link to send to the client for quote approval.
              </p>
              <Button size="sm" onClick={handleGenerateQuote} disabled={generatingQuote} className="w-full">
                <ExternalLink className="h-4 w-4 mr-1" />
                {generatingQuote ? "Generating..." : "Generate Client Quote Link"}
              </Button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
