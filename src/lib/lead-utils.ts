export const LEAD_STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUOTATION_IN_PROGRESS: "Quotation",
  RFQ_SENT: "RFQ Sent",
  QUOTED: "Quoted",
  CLIENT_PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  LEAD: "bg-slate-100 text-slate-700 border-slate-200",
  QUOTATION_IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  RFQ_SENT: "bg-blue-100 text-blue-700 border-blue-200",
  QUOTED: "bg-purple-100 text-purple-700 border-purple-200",
  CLIENT_PROPOSAL_SENT: "bg-indigo-100 text-indigo-700 border-indigo-200",
  WON: "bg-emerald-100 text-emerald-700 border-emerald-200",
  LOST: "bg-red-100 text-red-600 border-red-200",
};

export const LEAD_PIPELINE_STATUSES = [
  "LEAD",
  "QUOTATION_IN_PROGRESS",
  "RFQ_SENT",
  "QUOTED",
  "CLIENT_PROPOSAL_SENT",
];

export const ALL_LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS);

// Valid manual next-status transitions for leads
export const LEAD_MANUAL_NEXT: Record<string, string[]> = {
  LEAD: ["QUOTATION_IN_PROGRESS", "LOST"],
  QUOTATION_IN_PROGRESS: ["RFQ_SENT", "CLIENT_PROPOSAL_SENT", "LOST"],
  RFQ_SENT: ["QUOTED", "QUOTATION_IN_PROGRESS", "LOST"],
  QUOTED: ["CLIENT_PROPOSAL_SENT", "LOST"],
  CLIENT_PROPOSAL_SENT: ["WON", "LOST"],
};
