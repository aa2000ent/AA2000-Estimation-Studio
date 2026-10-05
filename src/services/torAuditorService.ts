// TOR / Proposal forensic audit — Estimation Hub "Doc Reader".
//
// This used to call Mistral directly from the browser with VITE_MISTRAL_API_KEY,
// which shipped the model key to every browser that loaded the studio. The audit
// now runs on the backend (POST /service/estimation/ai/tor-audit), which also
// owns the deterministic normalisation: the variance, the forced-zero baseline
// and the confidence score are arithmetic, not model output, and they should not
// be editable by whoever has the browser open.
//
// The two exported functions keep their original signatures, so
// TORComparisonView is unchanged.

import { requestTorAudit, type TorAuditResult } from './api/torAuditAi';

/**
 * Catalog fields resolved server-side against the AA2000 product table.
 *
 * `name` is never overwritten by the catalog: it is the audit evidence, quoted
 * from the document. The catalog columns are reference data shown alongside it.
 */
export interface CatalogPriced {
  brand?: string;
  catalogModel?: string;
  catalogCode?: string;
  catalogDescription?: string;
  /** SRP resolved by the backend (the catalog's prod_price). */
  srp?: number;
  contractorPrice?: number;
  dealerPrice?: number;
  /** srp x pricedQuantity. */
  extendedPrice?: number;
  pricedQuantity?: number;
  pricedUnit?: string;
  pricingSource?: 'catalog' | 'market_benchmark' | 'model_estimate' | 'default_market';
  pricingConfidence?: number;
  /** True only when the catalog, not the model, supplied the price. */
  catalogPriced?: boolean;
}

export interface EquipmentComparisonEntry extends CatalogPriced {
  name: string;
  technicianQty: number;
  aiQty: number;
  variance: number;
  unitPrice?: number;
  totalPrice?: number;
  rationale: string;
}

export interface ManpowerComparisonEntry {
  role: string;
  technicianHours: number;
  aiHours: number;
  variance: number;
  unitPrice?: number;
  totalPrice?: number;
  rationale: string;
}

export interface ConsumablesComparisonEntry extends CatalogPriced {
  name: string;
  technicianQty: number;
  aiQty: number;
  variance: number;
  unitPrice?: number;
  totalPrice?: number;
  rationale: string;
}

/** How much of the audit the catalog actually covers. */
export interface AuditPricingSummary {
  linesPriced: number;
  catalogPriced: number;
  benchmarkPriced: number;
  unpricedLines: number;
  catalogEquipmentTotal: number;
  catalogMaterialsTotal: number;
}

export interface AuditDetails {
  totalTechnicianCost: number;
  totalAiRecommendedCost: number;
  varianceAmount: number;
  variancePercent: number;
  equipmentComparison: EquipmentComparisonEntry[];
  manpowerComparison: ManpowerComparisonEntry[];
  consumablesComparison?: ConsumablesComparisonEntry[];
  overallAuditRationale: string;
  /** 0-100, computed server-side and clamped. */
  confidenceScore: number;
  /**
   * Catalog coverage of the itemized lines. Absent when pricing could not run.
   * The audit totals above are NOT derived from this — they are owned by the
   * backend's variance rules, which cover labour as well as materials.
   */
  pricingSummary?: AuditPricingSummary;

  /**
   * How each document's text was obtained, when a file was uploaded alongside
   * it. `source: 'ocr'` means the document was a scan with no text layer, so the
   * figures below came from OCR and are less exact than parsed text.
   */
  documentExtraction?: AuditDocumentExtraction;
}

/** Backend view of document extraction, mirrored from the audit response. */
export interface AuditDocumentExtraction {
  tor?: AuditDocumentExtractionSide;
  proposal?: AuditDocumentExtractionSide;
}

export interface AuditDocumentExtractionSide {
  source: 'client' | 'ocr';
  chars: number;
  filename?: string;
  provider?: string;
  model?: string;
  error?: string;
  reason?: string;
}

/**
 * Audits a TOR document, optionally against a technician proposal.
 *
 * @param fileName - Name of the TOR/technical specification document
 * @param fileText - Extracted text content from the TOR document
 * @param options.technicianProposalText - Extracted proposal text, for a comparison
 * @param options.torFile - Original TOR file, used server-side for OCR when the
 *   document is a scan and `fileText` came back empty
 * @returns AuditDetails with cost comparison and rationale
 */
export async function auditTorDocument(
  fileName: string,
  fileText: string,
  options: {
    technicianProposalText?: string;
    baselineCost?: number;
    torFile?: File | null;
    proposalFile?: File | null;
  } = {}
): Promise<AuditDetails> {
  const proposalText = options.technicianProposalText?.trim() || '';
  // Mode is explicit rather than inferred: a comparison with only one side
  // present would let the model invent a baseline and report variance against
  // it. The backend enforces this too.
  const mode = proposalText ? 'compare' : 'tor';

  return requestTorAudit({
    mode,
    fileName,
    torText: fileText,
    proposalText: proposalText || undefined,
    torFile: options.torFile,
    proposalFile: options.proposalFile,
  }) as Promise<AuditDetails>;
}

/**
 * Analyzes a standalone Technician Proposal (no TOR required) and returns
 * cost breakdown, equipment list, manpower, consumables, and AI recommendations.
 *
 * @param fileName - Name of the Technician Proposal document
 * @param fileText - Extracted text content from the Technician Proposal
 * @param file - Original proposal file, used server-side for OCR when the
 *   document is a scan and `fileText` came back empty
 * @returns AuditDetails with analysis and AI recommendations
 */
export async function analyzeProposalOnly(
  fileName: string,
  fileText: string,
  file?: File | null
): Promise<AuditDetails> {
  return requestTorAudit({
    mode: 'proposal',
    fileName,
    // The proposal text belongs in `proposalText`, not `torText`. The backend
    // rejects a proposal-mode request whose proposal side is empty, so sending
    // it as the TOR made this mode fail with "A technician proposal is
    // required" on every call.
    proposalText: fileText,
    proposalFile: file,
  }) as Promise<AuditDetails>;
}

export type { TorAuditResult };
