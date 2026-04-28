"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, FileSpreadsheet, Search, IndianRupee, ChevronDown } from "lucide-react";

interface PartOption {
  id: string;
  publicId: string;
  partName: string | null;
  quantity: number;
  pricingLocked: boolean;
  clientUnitPriceUsd: number | null;
  totalPriceUsd: number | null;
  drawingId: string | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderDisplayId: string;
  onSuccess?: (estimateNumber: string) => void;
}

export function ZohoEstimateDialog({ open, onOpenChange, orderId, orderDisplayId, onSuccess }: Props) {
  const [parts, setParts] = useState<PartOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ estimateNumber: string; total: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load parts & customers when dialog opens
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError("");
    setSelectedPartIds(new Set());
    setSelectedCustomerId("");
    setSelectedCustomerName("");
    setCustomerSearch("");

    setLoadingParts(true);
    fetch(`/api/orders/${orderId}/zoho-estimate`)
      .then((r) => r.json())
      .then((data: PartOption[]) => {
        setParts(data);
        // Auto-select all locked parts
        setSelectedPartIds(new Set(data.filter((p) => p.pricingLocked).map((p) => p.id)));
      })
      .finally(() => setLoadingParts(false));

    setLoadingCustomers(true);
    fetch("/api/zoho/customers")
      .then((r) => r.json())
      .then((data: Customer[]) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, orderId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const togglePart = (id: string) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(c.name);
    setCustomerSearch(c.name);
    setCustomerDropdownOpen(false);
  };

  const totalAmount = parts
    .filter((p) => selectedPartIds.has(p.id) && p.totalPriceUsd != null)
    .reduce((sum, p) => sum + (p.totalPriceUsd ?? 0), 0);

  const lockedSelected = parts.filter((p) => selectedPartIds.has(p.id) && p.pricingLocked);

  const handleGenerate = async () => {
    setError("");
    if (!selectedCustomerId) { setError("Select a customer"); return; }
    if (lockedSelected.length === 0) { setError("Select at least one part with locked pricing"); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/zoho-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          partIds: [...selectedPartIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate estimate"); }
      else {
        setResult({ estimateNumber: data.estimateNumber, total: data.total });
        onSuccess?.(data.estimateNumber);
      }
    } catch {
      setError("Failed to generate estimate");
    }
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            Generate Zoho Estimate
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Estimate created successfully</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Estimate <span className="font-mono font-bold">{result.estimateNumber}</span>
                  {" · "}Total: ₹{result.total.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The Zoho estimate ID has been saved to order {orderDisplayId}.
            </p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Customer picker */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">Customer</p>
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex items-center border rounded-md px-3 h-9 gap-2 cursor-text bg-white"
                  onClick={() => setCustomerDropdownOpen(true)}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                    placeholder={loadingCustomers ? "Loading customers..." : "Search or select customer..."}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomerId("");
                      setSelectedCustomerName("");
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                  />
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${customerDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {customerDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2.5">
                        {loadingCustomers ? "Loading..." : "No customers found"}
                      </p>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedCustomerId === c.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-800"}`}
                          onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                        >
                          {c.name}
                          {c.email && <span className="ml-2 text-xs text-muted-foreground font-normal">{c.email}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedCustomerName && selectedCustomerId && (
                <p className="text-xs text-slate-500">
                  Selected: <span className="font-semibold text-slate-700">{selectedCustomerName}</span>
                </p>
              )}
            </div>

            {/* Parts selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Parts to include</p>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    const locked = parts.filter((p) => p.pricingLocked).map((p) => p.id);
                    setSelectedPartIds(new Set(locked));
                  }}
                >
                  Select all priced
                </button>
              </div>

              {loadingParts ? (
                <p className="text-xs text-muted-foreground py-2">Loading parts...</p>
              ) : parts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No parts found for this order.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                  {parts.map((p) => {
                    const isSelected = selectedPartIds.has(p.id);
                    const disabled = !p.pricingLocked;
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"} ${isSelected && !disabled ? "bg-blue-50/40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => togglePart(p.id)}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-800">{p.publicId}</span>
                            {p.partName && <span className="text-xs text-muted-foreground truncate">{p.partName}</span>}
                            {!p.pricingLocked && (
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">No locked pricing</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Qty: {p.quantity}</p>
                        </div>
                        {p.pricingLocked && p.clientUnitPriceUsd != null && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-slate-800">
                              ₹{p.clientUnitPriceUsd.toLocaleString("en-IN")} <span className="font-normal text-muted-foreground">/u</span>
                            </p>
                            {p.totalPriceUsd != null && (
                              <p className="text-xs text-emerald-700 font-semibold">
                                ₹{p.totalPriceUsd.toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Total */}
              {lockedSelected.length > 0 && (
                <div className="flex items-center justify-between pt-1 text-sm font-semibold border-t mt-1">
                  <span className="text-xs text-muted-foreground">{lockedSelected.length} part{lockedSelected.length !== 1 ? "s" : ""} selected</span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {totalAmount.toLocaleString("en-IN")} total
                  </span>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedCustomerId || lockedSelected.length === 0}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              {generating ? "Generating..." : "Generate Estimate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
