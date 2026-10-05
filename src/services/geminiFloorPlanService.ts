// Floor plan estimation service — thin backend adapter.
//
// The pipeline (TOR OCR -> vision analysis -> BOQ generation -> AA2000 catalog
// pricing -> deterministic totals) runs on the server in
// AA2000Backend_Server/services/Applications/ESTIMATION/floorPlan, and the
// endpoint returns the BOQ as markdown. This module forwards the uploads and
// parses that markdown, so no model API key is exposed to the browser.
//
// The FloorPlanEstimation shape is unchanged: FloorPlanView, EstimationSummary
// and QuotationModal consume it exactly as before.

import {
  requestFloorPlanEstimation,
  type FloorPlanBuildingInfo,
} from './api/floorPlanAi';
import { parseFloorPlanMarkdown } from './floorPlanMarkdown';

export type { FloorPlanBuildingInfo };

export interface FloorPlanEstimation {
  observations: string;
  confidenceScore: number;
  quotationReferenceCode?: string;
  quotationHeader?: {
    attentionTo: string;
    thru: string;
    emailAdd: string;
    contactNo: string;
    company: string;
    address: string;
    projectSite: string;
    projectTitle: string;
    quoteDate: string;
    validityPeriod: string;
  };
  deviceSummary?: {
    facpBrand: string;
    systemType: string;
    totalUnitsText: string;
    buildingProfile: string;
    workingSchedule: string;
    remarks: string;
  };
  generalRequirements?: {
    itemNumber: number;
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  scopeOfWorks?: {
    itemNumber: number;
    description: string;
    unit: string;
    qty?: number;
    unitPrice?: number;
    totalPrice: number;
  }[];
  costBreakdown?: {
    itemATotal: number;
    itemBTotal: number;
    subTotal: number;
    discount: number;
    subTotalWithDiscount: number;
    vat12Percent: number;
    grandTotalAmount: number;
  };
  scheduleOfPayment?: {
    itemCode: string;
    milestone: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  termsAndConditions?: string[];
  manpower: {
    role: string;
    headcount: number;
    hours: number;
    manDays: number;
    ratePerDay?: number;
    totalCost?: number;
  }[];
  consumables: {
    name: string;
    category: string;
    brand?: string;
    /** Catalog identity the price came from, when the item matched the catalog. */
    catalogModel?: string;
    catalogCode?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    srp?: number;
    contractorPrice?: number;
    dealerPrice?: number;
    totalPrice?: number;
  }[];
  fees: {
    type: string;
    amount: number;
    description: string;
  }[];
  constraints: {
    physical: string;
    electrical: string;
    installation: string;
  };
  /** Uploads the backend skipped (wrong type or over the per-request limit). */
  rejectedFiles?: {
    filename: string;
    reason: string;
  }[];
  /**
   * The BOQ exactly as the backend emitted it, before parsing. Kept for audit
   * and debugging; not part of the quotation itself.
   */
  rawMarkdown?: string;
}

/**
 * Estimates a BOQ from floor-plan sheets and TOR/spec documents.
 *
 * The backend returns the BOQ as markdown; parseFloorPlanMarkdown turns it back
 * into this object, so the contract seen by FloorPlanView, EstimationSummary
 * and QuotationModal is unchanged.
 *
 * @param imageFiles floor-plan images and/or TOR PDFs (as selected in the UI)
 * @param surveyType comma-separated system keys, or the auto-detect list
 * @param buildingInfo project/client context
 * @param torFileNames names of the files the UI flagged as TOR/spec, so the
 *        backend routes them through OCR instead of the vision pass
 */
export async function analyzeFloorPlan(
  imageFiles: File[],
  surveyType: string,
  buildingInfo: FloorPlanBuildingInfo,
  torFileNames: string[] = []
): Promise<FloorPlanEstimation> {
  const files = (imageFiles || []).filter(Boolean);
  if (files.length === 0) {
    throw new Error('Attach at least one floor plan or TOR document.');
  }

  const markdown = await requestFloorPlanEstimation({
    files,
    surveyType,
    info: buildingInfo || {},
    torFileNames,
  });

  const estimation = parseFloorPlanMarkdown(markdown);
  if (!estimation) {
    throw new Error('The estimation service returned an unreadable BOQ.');
  }
  estimation.rawMarkdown = markdown;

  return estimation;
}