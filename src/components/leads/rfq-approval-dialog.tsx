"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Lock,
  AlertTriangle,
  Calendar,
  IndianRupee,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PartQuote {
  id: string;
  groupedRfqPartId: string;
  vendorRfqId: string;
  unitPriceUsd: number | null;
  leadTimeDays: number | null;
  notes: string | null;
  selected: boolean;
}

interface RfqVendor {
  id: string;
  vendorId: string;
  submittedAt: string | null;
  vendor: { name: string };
  partQuotes: PartQuote[];
}

interface RfqPart {
  id: string;
  partId: string;
  part: { publicId: string; partName: string | null; quantity?: number };
}

export interface GroupedRFQForApproval {
  id: string;
  publicId: string;
  status: string;
  dueDate: string;
  coverNote: string | null;
  locked: boolean;
  vendors: RfqVendor[];
  parts: RfqPart[];
}

interface Selection {
  partId: string;
  groupedRfqPartId: string;
  groupedPartQuoteId: string;
  vendorRfqId: string;
  marginPercent: number;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function RfqApprovalDialog({
  rfq,
  leadId,
  onApproved,
  open,
  onOpenChange,
}: {
  rfq: GroupedRFQForApproval;
  leadId: string;
  onApproved: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Which vendor quote is selected for each rfqPart.id
  const [selectedQuotes, setSelectedQuotes] = useState<
    Record<string, { quoteId: string; vendorRfqId: string }>
  >({});

  const [globalMargin, setGlobalMargin] = useState(20);
  const [perPartMarginEnabled, setPerPartMarginEnabled] = useState(false);
  const [partMargins, setPartMargins] = useState<Record<string, number>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Only vendors who have submitted quotes
  const submittedVendors = useMemo(
    () => rfq.vendors.filter((v) => v.submittedAt),
    [rfq.vendors]
  );

  // Build a lookup: rfqPartId -> vendorRfqId -> quote
  const quoteMap = useMemo(() => {
    const map: Record<string, Record<string, PartQuote>> = {};
    for (const vendor of submittedVendors) {
      for (const pq of vendor.partQuotes) {
        if (!map[pq.groupedRfqPartId]) map[pq.groupedRfqPartId] = {};
        map[pq.groupedRfqPartId][vendor.id] = pq;
      }
    }
    return map;
  }, [submittedVendors]);

  const getMargin = (rfqPartId: string) =>
    perPartMarginEnabled && partMargins[rfqPartId] != null
      ? partMargins[rfqPartId]
      : globalMargin;

  // Compute live totals
  const summaryData = useMemo(() => {
    let totalVendorCost = 0;
    let totalClientCost = 0;
    let selectedCount = 0;

    for (const rp of rfq.parts) {
      const sel = selectedQuotes[rp.id];
      if (!sel) continue;
      const quote = quoteMap[rp.id]?.[sel.vendorRfqId];
      if (!quote || quote.unitPriceUsd == null) continue;

      const qty = rp.part.quantity ?? 1;
      const margin = getMargin(rp.id);
      const vendorTotal = quote.unitPriceUsd * qty;
      const clientUnit = quote.unitPriceUsd * (1 + margin / 100);
      const clientTotal = clientUnit * qty;

      totalVendorCost += vendorTotal;
      totalClientCost += clientTotal;
      selectedCount++;
    }

    return {
      selectedCount,
      totalParts: rfq.parts.length,
      totalVendorCost: parseFloat(totalVendorCost.toFixed(2)),
      totalClientCost: parseFloat(totalClientCost.toFixed(2)),
      totalMarginValue: parseFloat(
        (totalClientCost - totalVendorCost).toFixed(2)
      ),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuotes, globalMargin, partMargins, perPartMarginEnabled, rfq.parts, quoteMap]);

  const allSelected = summaryData.selectedCount === rfq.parts.length;

  const handleApprove = async () => {
    if (!allSelected) {
      setError("Please select a vendor for every part before approving.");
      return;
    }

    setSubmitting(true);
    setError("");

    const selections: Array<{
      partId: string;
      groupedPartQuoteId: string;
      marginPercent: number;
    }> = [];

    for (const rp of rfq.parts) {
      const sel = selectedQuotes[rp.id];
      if (!sel) continue;
      selections.push({
        partId: rp.partId,
        groupedPartQuoteId: sel.quoteId,
        marginPercent: getMargin(rp.id),
      });
    }

    try {
      const res = await fetch(
        `/api/leads/${leadId}/rfq/${rfq.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selections }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to approve");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        onApproved();
      }, 1500);
    } catch {
      setError("Failed to approve RFQ");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compare & Approve - {rfq.publicId}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due{" "}
              {new Date(rfq.dueDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            {rfq.coverNote && (
              <span className="truncate max-w-xs">{rfq.coverNote}</span>
            )}
          </div>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              All pricing locked successfully!
            </p>
            <p className="text-xs text-muted-foreground">
              {summaryData.selectedCount} parts priced. Total client value:{" "}
              {summaryData.totalClientCost.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Comparison Table */}
            {submittedVendors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  No vendors have submitted quotes yet.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[160px]">
                        Part
                      </th>
                      {submittedVendors.map((v) => (
                        <th
                          key={v.id}
                          className="text-center px-3 py-2 font-medium text-slate-600 min-w-[140px]"
                        >
                          {v.vendor.name}
                        </th>
                      ))}
                      {perPartMarginEnabled && (
                        <th className="text-center px-3 py-2 font-medium text-slate-600 min-w-[80px]">
                          Margin %
                        </th>
                      )}
                      <th className="text-center px-3 py-2 font-medium text-slate-600 min-w-[120px]">
                        Client Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.parts.map((rp) => {
                      const sel = selectedQuotes[rp.id];
                      const margin = getMargin(rp.id);
                      const qty = rp.part.quantity ?? 1;

                      // Compute client price for selected quote
                      let clientUnitPrice: number | null = null;
                      let clientTotal: number | null = null;
                      if (sel) {
                        const q = quoteMap[rp.id]?.[sel.vendorRfqId];
                        if (q?.unitPriceUsd != null) {
                          clientUnitPrice = parseFloat(
                            (q.unitPriceUsd * (1 + margin / 100)).toFixed(2)
                          );
                          clientTotal = parseFloat(
                            (clientUnitPrice * qty).toFixed(2)
                          );
                        }
                      }

                      return (
                        <tr key={rp.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs font-semibold">
                              {rp.part.publicId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {rp.part.partName ?? "Unnamed"} | Qty: {qty}
                            </div>
                          </td>
                          {submittedVendors.map((v) => {
                            const quote = quoteMap[rp.id]?.[v.id];
                            const isSelected = sel?.vendorRfqId === v.id;

                            if (!quote || quote.unitPriceUsd == null) {
                              return (
                                <td
                                  key={v.id}
                                  className="text-center px-3 py-2 text-muted-foreground"
                                >
                                  --
                                </td>
                              );
                            }

                            return (
                              <td
                                key={v.id}
                                className={`text-center px-3 py-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-blue-50 ring-2 ring-inset ring-blue-400 rounded"
                                    : "hover:bg-slate-50"
                                }`}
                                onClick={() =>
                                  setSelectedQuotes((prev) => ({
                                    ...prev,
                                    [rp.id]: {
                                      quoteId: quote.id,
                                      vendorRfqId: v.id,
                                    },
                                  }))
                                }
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <input
                                    type="radio"
                                    name={`quote-${rp.id}`}
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedQuotes((prev) => ({
                                        ...prev,
                                        [rp.id]: {
                                          quoteId: quote.id,
                                          vendorRfqId: v.id,
                                        },
                                      }))
                                    }
                                    className="accent-blue-600"
                                  />
                                  <div>
                                    <div className="font-semibold text-xs">
                                      {quote.unitPriceUsd.toLocaleString(
                                        "en-IN",
                                        { minimumFractionDigits: 2 }
                                      )}
                                    </div>
                                    {quote.leadTimeDays != null && (
                                      <div className="text-xs text-muted-foreground">
                                        {quote.leadTimeDays}d lead
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          {perPartMarginEnabled && (
                            <td className="text-center px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                value={partMargins[rp.id] ?? globalMargin}
                                onChange={(e) =>
                                  setPartMargins((prev) => ({
                                    ...prev,
                                    [rp.id]: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="h-7 w-16 text-xs text-center mx-auto"
                              />
                            </td>
                          )}
                          <td className="text-center px-3 py-2">
                            {clientUnitPrice != null && clientTotal != null ? (
                              <div>
                                <div className="text-xs font-semibold text-emerald-700">
                                  {clientUnitPrice.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}{" "}
                                  /u
                                </div>
                                <div className="text-xs text-emerald-600 font-medium">
                                  Total:{" "}
                                  {clientTotal.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                --
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Margin Controls */}
            <div className="flex items-center gap-4 flex-wrap border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium whitespace-nowrap">
                  Global Margin %
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={globalMargin}
                  onChange={(e) =>
                    setGlobalMargin(parseFloat(e.target.value) || 0)
                  }
                  className="h-7 w-20 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={perPartMarginEnabled}
                  onChange={(e) => setPerPartMarginEnabled(e.target.checked)}
                  className="rounded"
                />
                Per-part margin override
              </label>
            </div>

            {/* Summary Bar */}
            {summaryData.selectedCount > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border rounded-lg p-3 bg-white">
                <div>
                  <p className="text-xs text-muted-foreground">Selected</p>
                  <p className="text-sm font-semibold">
                    {summaryData.selectedCount} / {summaryData.totalParts} parts
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendor Cost</p>
                  <p className="text-sm font-semibold flex items-center gap-0.5">
                    <IndianRupee className="h-3 w-3" />
                    {summaryData.totalVendorCost.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client Cost</p>
                  <p className="text-sm font-semibold text-emerald-700 flex items-center gap-0.5">
                    <IndianRupee className="h-3 w-3" />
                    {summaryData.totalClientCost.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margin Value</p>
                  <p className="text-sm font-semibold text-blue-700 flex items-center gap-0.5">
                    <IndianRupee className="h-3 w-3" />
                    {summaryData.totalMarginValue.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={submitting || !allSelected}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Lock className="h-3.5 w-3.5 mr-1" />
              {submitting ? "Locking..." : "Approve & Lock All Pricing"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
