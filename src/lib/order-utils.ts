export const ORDER_STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUOTATION_IN_PROGRESS: "Quotation",
  RFQ_SENT: "RFQ Sent",
  QUOTED: "Quoted",
  CLIENT_PROPOSAL_SENT: "Proposal Sent",
  ORDER_CONFIRMED: "Order Confirmed",
  IN_PRODUCTION: "In Production",
  INSPECTION: "Inspection",
  READY_FOR_DISPATCH: "Ready for Dispatch",
  DISPATCHED: "Dispatched",
  COMPLETED: "Completed",
  LOST: "Lost",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  LEAD: "bg-slate-100 text-slate-700 border-slate-200",
  QUOTATION_IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  RFQ_SENT: "bg-blue-100 text-blue-700 border-blue-200",
  QUOTED: "bg-purple-100 text-purple-700 border-purple-200",
  CLIENT_PROPOSAL_SENT: "bg-indigo-100 text-indigo-700 border-indigo-200",
  ORDER_CONFIRMED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  IN_PRODUCTION: "bg-cyan-100 text-cyan-700 border-cyan-200",
  INSPECTION: "bg-orange-100 text-orange-700 border-orange-200",
  READY_FOR_DISPATCH: "bg-teal-100 text-teal-700 border-teal-200",
  DISPATCHED: "bg-green-100 text-green-700 border-green-200",
  COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
  LOST: "bg-red-100 text-red-600 border-red-200",
  CANCELLED: "bg-red-100 text-red-600 border-red-200",
};

export const PRE_SALES_STATUSES = [
  "LEAD", "QUOTATION_IN_PROGRESS", "RFQ_SENT", "QUOTED", "CLIENT_PROPOSAL_SENT",
];

export const PRODUCTION_STATUSES = [
  "ORDER_CONFIRMED", "IN_PRODUCTION", "INSPECTION",
  "READY_FOR_DISPATCH", "DISPATCHED",
];

export const ALL_STATUSES = Object.keys(ORDER_STATUS_LABELS);

export function isOverdue(deliveryDate: string | null, status: string): boolean {
  if (!deliveryDate) return false;
  if (["COMPLETED", "DISPATCHED", "CANCELLED", "LOST"].includes(status)) return false;
  return new Date(deliveryDate) < new Date();
}

export function isDueWithinDays(deliveryDate: string | null, status: string, days: number): boolean {
  if (!deliveryDate) return false;
  if (["COMPLETED", "DISPATCHED", "CANCELLED", "LOST"].includes(status)) return false;
  const diff = new Date(deliveryDate).getTime() - Date.now();
  return diff > 0 && diff < days * 86400000;
}

// Generate N/2 update schedule from orderDate to deliveryDate
export function buildUpdateSchedule(orderDate: string, deliveryDate: string): string[] {
  const start = new Date(orderDate).getTime();
  const end = new Date(deliveryDate).getTime();
  const totalDays = Math.round((end - start) / 86400000);
  const interval = Math.max(2, Math.floor(totalDays / 4));
  const dates: string[] = [];
  for (let d = interval; d < totalDays; d += interval) {
    const date = new Date(start + d * 86400000);
    dates.push(date.toISOString());
  }
  return dates;
}
