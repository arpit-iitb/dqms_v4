"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  ArrowRightCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ZohoActionsPanelProps {
  entityType: "lead" | "salesOrder";
  entityId: string;
  zohoQuotationId?: string | null;
  zohoSalesOrderId?: string | null;
  displayId: string;
  onUpdate: () => void;
  /** Callback to open the existing Zoho Estimate dialog */
  onOpenEstimateDialog?: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ZohoActionsPanel({
  entityType,
  entityId,
  zohoQuotationId,
  zohoSalesOrderId,
  displayId,
  onUpdate,
  onOpenEstimateDialog,
}: ZohoActionsPanelProps) {
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [convertResult, setConvertResult] = useState<string | null>(null);

  // Manual link section
  const [manualOpen, setManualOpen] = useState(false);
  const [manualId, setManualId] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  /* ---------- Convert Estimate to Zoho Sales Order ---------- */

  const handleConvertToZohoSO = async () => {
    setConverting(true);
    setConvertError("");
    setConvertResult(null);
    try {
      const res = await fetch(`/api/leads/${entityId}/convert-to-zoho-salesorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setConvertError(data.error || "Failed to convert to Zoho Sales Order");
      } else {
        setConvertResult(data.zohoSalesOrderId);
        onUpdate();
      }
    } catch {
      setConvertError("Failed to convert to Zoho Sales Order");
    }
    setConverting(false);
  };

  /* ---------- Manual Link ---------- */

  const handleManualLink = async () => {
    if (!manualId.trim()) return;
    setSavingManual(true);

    const endpoint =
      entityType === "lead"
        ? `/api/leads/${entityId}`
        : `/api/orders/${entityId}`;

    const patchBody =
      entityType === "lead"
        ? { zohoQuotationId: manualId.trim() }
        : { zohoSalesOrderId: manualId.trim() };

    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      setManualId("");
      setManualOpen(false);
      onUpdate();
    } catch {
      // silently handle
    }
    setSavingManual(false);
  };

  /* ---------- Determine what to show ---------- */

  const hasEstimate = !!zohoQuotationId;
  const hasZohoSO = !!zohoSalesOrderId;

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Zoho Integration</span>
        </div>

        {/* Current state badges */}
        <div className="flex flex-wrap gap-2">
          {hasEstimate && (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Estimate: {zohoQuotationId}
            </Badge>
          )}
          {hasZohoSO && (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Sales Order: {zohoSalesOrderId}
            </Badge>
          )}
          {!hasEstimate && !hasZohoSO && (
            <span className="text-xs text-muted-foreground">No Zoho references linked yet.</span>
          )}
        </div>

        {/* Contextual actions */}
        <div className="flex flex-wrap gap-2">
          {/* For leads: Generate Estimate button (if no estimate yet) */}
          {entityType === "lead" && !hasEstimate && onOpenEstimateDialog && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenEstimateDialog}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              Generate Estimate
            </Button>
          )}

          {/* For leads: Convert to Zoho SO (if estimate exists but no Zoho SO) */}
          {entityType === "lead" && hasEstimate && !hasZohoSO && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleConvertToZohoSO}
              disabled={converting}
            >
              {converting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />
              )}
              {converting ? "Converting..." : "Convert to Zoho Sales Order"}
            </Button>
          )}

          {/* For leads: also allow re-generating estimate if one exists */}
          {entityType === "lead" && hasEstimate && onOpenEstimateDialog && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenEstimateDialog}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              Regenerate Estimate
            </Button>
          )}

          {/* For SOs without a Zoho SO ID: show Link button via manual section */}
          {entityType === "salesOrder" && !hasZohoSO && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManualOpen(!manualOpen)}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Link Zoho Sales Order
            </Button>
          )}
        </div>

        {/* Conversion result */}
        {convertResult && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-800">Zoho Sales Order created</p>
              <p className="text-xs text-green-700 font-mono">{convertResult}</p>
            </div>
          </div>
        )}

        {/* Conversion error */}
        {convertError && (
          <p className="text-xs text-red-600">{convertError}</p>
        )}

        {/* Collapsed Manual Link Section */}
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-slate-700 transition-colors"
            onClick={() => setManualOpen(!manualOpen)}
          >
            {manualOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Manual Link
          </button>

          {manualOpen && (
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-slate-100">
              <div className="space-y-1">
                <Label className="text-xs">
                  {entityType === "lead" ? "Zoho Estimate ID" : "Zoho Sales Order ID"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={entityType === "lead" ? "e.g. 460000000012345" : "e.g. 460000000012345"}
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleManualLink}
                    disabled={savingManual || !manualId.trim()}
                    className="h-8"
                  >
                    {savingManual ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
