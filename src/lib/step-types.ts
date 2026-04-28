// Shared step/block type definitions and constants
// Mirrors muop's DrawingModuleType + dqms_v3's BlockType

export type BlockType = "MATERIAL" | "MANUFACTURING" | "INSPECTION" | "POST_PROCESSING" | "REWORK" | "EMAIL";

export type BlockStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "FAILED";

export interface CheckEntry {
  checked: boolean;
  timestamp?: string;
}

// MATERIAL step data
export interface MaterialStepData {
  type: "MATERIAL";
  sourceType: "VENDOR" | "CLIENT";
  vendorId?: string;
  vendorName?: string;
  scheduledDate?: string;
  actualReceivedDate?: string;
  notes?: string;
  pickupScheduled: CheckEntry;
  materialReceived: CheckEntry;
  deliveryChallanReceived: CheckEntry;
}

// MANUFACTURING step data
export interface ManufacturingStepData {
  type: "MANUFACTURING";
  vendorId?: string;
  vendorName?: string;
  scheduledStartDate?: string;
  vendorCommitmentDate?: string;
  notes?: string;
  materialReceivedByVendor: CheckEntry;
  materialInspectedByVendor: CheckEntry;
  manufacturingInitiated: CheckEntry;
  manufacturingCompleted: CheckEntry;
  inspectedByVendor: CheckEntry;
  dispatched: CheckEntry;
}

// INSPECTION step data
export type InspectionType = "DIMENSIONAL" | "VISUAL" | "CMM" | "HARDNESS" | "SURFACE_ROUGHNESS" | "MATERIAL_CERTIFICATION" | "FUNCTIONAL" | "OTHER";

export interface InspectionStepData {
  type: "INSPECTION";
  inspectionType: InspectionType;
  vendorId?: string;
  vendorName?: string;
  scheduledDate?: string;
  actualDate?: string;
  notes?: string;
  slotBooked: CheckEntry & { slotDateTime?: string };
  materialReceivedByVendor: CheckEntry;
  inspectionCompleted: CheckEntry;
  reportShared: CheckEntry;
  dispatched: CheckEntry;
}

// POST_PROCESSING step data
export type PostProcessingType = "ANODIZING" | "CHROME_PLATING" | "ZINC_PLATING" | "BLACK_OXIDE" | "POWDER_COATING" | "HEAT_TREATMENT" | "NITRIDING" | "PASSIVATION" | "ELECTROPLATING" | "SANDBLASTING" | "OTHER";

export interface PostProcessingStepData {
  type: "POST_PROCESSING";
  processType: PostProcessingType;
  vendorId?: string;
  vendorName?: string;
  scheduledDate?: string;
  actualDate?: string;
  notes?: string;
  materialReceivedByVendor: CheckEntry;
  postProcessingCompleted: CheckEntry;
  dispatched: CheckEntry;
}

// REWORK step data
export interface ReworkStepData {
  type: "REWORK";
  vendorId?: string;
  vendorName?: string;
  scheduledDate?: string;
  notes?: string;
  capaCompleted: CheckEntry & { reportUrl?: string };
  materialReceivedByVendor: CheckEntry;
  reworkInitiated: CheckEntry;
  reworkCompleted: CheckEntry;
  inspectedByVendor: CheckEntry;
  dispatched: CheckEntry;
}

export type StepData =
  | MaterialStepData
  | ManufacturingStepData
  | InspectionStepData
  | PostProcessingStepData
  | ReworkStepData;

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  MATERIAL: "Material",
  MANUFACTURING: "Manufacturing",
  INSPECTION: "Inspection",
  POST_PROCESSING: "Post Processing",
  REWORK: "Rework",
  EMAIL: "Email Trigger",
};

export const BLOCK_TYPE_COLORS: Record<BlockType, string> = {
  MATERIAL: "bg-amber-100 text-amber-700 border-amber-200",
  MANUFACTURING: "bg-blue-100 text-blue-700 border-blue-200",
  INSPECTION: "bg-orange-100 text-orange-700 border-orange-200",
  POST_PROCESSING: "bg-purple-100 text-purple-700 border-purple-200",
  REWORK: "bg-red-100 text-red-700 border-red-200",
  EMAIL: "bg-slate-100 text-slate-600 border-slate-200",
};

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  DIMENSIONAL: "Dimensional",
  VISUAL: "Visual",
  CMM: "CMM",
  HARDNESS: "Hardness",
  SURFACE_ROUGHNESS: "Surface Roughness",
  MATERIAL_CERTIFICATION: "Material Certification",
  FUNCTIONAL: "Functional",
  OTHER: "Other",
};

export const POST_PROCESSING_TYPE_LABELS: Record<PostProcessingType, string> = {
  ANODIZING: "Anodizing",
  CHROME_PLATING: "Chrome Plating",
  ZINC_PLATING: "Zinc Plating",
  BLACK_OXIDE: "Black Oxide",
  POWDER_COATING: "Powder Coating",
  HEAT_TREATMENT: "Heat Treatment",
  NITRIDING: "Nitriding",
  PASSIVATION: "Passivation",
  ELECTROPLATING: "Electroplating",
  SANDBLASTING: "Sandblasting",
  OTHER: "Other",
};

// Get all check entries from step data for progress calculation
export function getStepChecks(stepData: StepData | null): { done: number; total: number } {
  if (!stepData) return { done: 0, total: 0 };
  const checks: boolean[] = [];
  const collect = (entry: CheckEntry) => checks.push(entry.checked);

  switch (stepData.type) {
    case "MATERIAL":
      [stepData.pickupScheduled, stepData.materialReceived, stepData.deliveryChallanReceived].forEach(collect);
      break;
    case "MANUFACTURING":
      [stepData.materialReceivedByVendor, stepData.materialInspectedByVendor, stepData.manufacturingInitiated,
        stepData.manufacturingCompleted, stepData.inspectedByVendor, stepData.dispatched].forEach(collect);
      break;
    case "INSPECTION":
      [stepData.slotBooked, stepData.materialReceivedByVendor, stepData.inspectionCompleted,
        stepData.reportShared, stepData.dispatched].forEach(collect);
      break;
    case "POST_PROCESSING":
      [stepData.materialReceivedByVendor, stepData.postProcessingCompleted, stepData.dispatched].forEach(collect);
      break;
    case "REWORK":
      [stepData.capaCompleted, stepData.materialReceivedByVendor, stepData.reworkInitiated,
        stepData.reworkCompleted, stepData.inspectedByVendor, stepData.dispatched].forEach(collect);
      break;
  }
  return { done: checks.filter(Boolean).length, total: checks.length };
}

// Build default stepData for a new block
export function defaultStepData(type: BlockType): StepData | null {
  const c = (): CheckEntry => ({ checked: false });
  switch (type) {
    case "MATERIAL":
      return { type: "MATERIAL", sourceType: "VENDOR", pickupScheduled: c(), materialReceived: c(), deliveryChallanReceived: c() };
    case "MANUFACTURING":
      return { type: "MANUFACTURING", materialReceivedByVendor: c(), materialInspectedByVendor: c(), manufacturingInitiated: c(), manufacturingCompleted: c(), inspectedByVendor: c(), dispatched: c() };
    case "INSPECTION":
      return { type: "INSPECTION", inspectionType: "DIMENSIONAL", slotBooked: c(), materialReceivedByVendor: c(), inspectionCompleted: c(), reportShared: c(), dispatched: c() };
    case "POST_PROCESSING":
      return { type: "POST_PROCESSING", processType: "ANODIZING", materialReceivedByVendor: c(), postProcessingCompleted: c(), dispatched: c() };
    case "REWORK":
      return { type: "REWORK", capaCompleted: c(), materialReceivedByVendor: c(), reworkInitiated: c(), reworkCompleted: c(), inspectedByVendor: c(), dispatched: c() };
    default:
      return null;
  }
}
