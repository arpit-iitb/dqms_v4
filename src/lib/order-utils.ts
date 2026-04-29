export const SO_STATUS_LABELS: Record<string, string> = {
  ORDER_CONFIRMED: "Order Confirmed",
  IN_PRODUCTION: "In Production",
  INSPECTION: "Inspection",
  READY_FOR_DISPATCH: "Ready for Dispatch",
  DISPATCHED: "Dispatched",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const SO_STATUS_COLORS: Record<string, string> = {
  ORDER_CONFIRMED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  IN_PRODUCTION: "bg-cyan-100 text-cyan-700 border-cyan-200",
  INSPECTION: "bg-orange-100 text-orange-700 border-orange-200",
  READY_FOR_DISPATCH: "bg-teal-100 text-teal-700 border-teal-200",
  DISPATCHED: "bg-green-100 text-green-700 border-green-200",
  COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-red-100 text-red-600 border-red-200",
};

export const PRODUCTION_STATUSES = [
  "ORDER_CONFIRMED",
  "IN_PRODUCTION",
  "INSPECTION",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
];

export const ALL_SO_STATUSES = Object.keys(SO_STATUS_LABELS);

// Valid manual next-status transitions for sales orders
export const SO_MANUAL_NEXT: Record<string, string[]> = {
  ORDER_CONFIRMED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["INSPECTION", "READY_FOR_DISPATCH", "CANCELLED"],
  INSPECTION: ["READY_FOR_DISPATCH", "IN_PRODUCTION", "CANCELLED"],
  READY_FOR_DISPATCH: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["COMPLETED"],
};

export function isOverdue(deliveryDate: string | null, status: string): boolean {
  if (!deliveryDate) return false;
  if (["COMPLETED", "DISPATCHED", "CANCELLED"].includes(status)) return false;
  return new Date(deliveryDate) < new Date();
}

export function isDueWithinDays(deliveryDate: string | null, status: string, days: number): boolean {
  if (!deliveryDate) return false;
  if (["COMPLETED", "DISPATCHED", "CANCELLED"].includes(status)) return false;
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
