// Client for the TOR / Proposal forensic audit (Estimation Hub "Doc Reader").
//
// The model call lives on the backend: the studio used to call Mistral directly
// with VITE_MISTRAL_API_KEY, which shipped the key to every browser that loaded
// the app. The backend also owns the deterministic normalisation of the audit,
// so the variance and confidence shown to staff cannot be altered by client
// code.

import { apiClient } from './index';

export type TorAuditMode = 'tor' | 'compare' | 'proposal';

export interface TorAuditRequest {
  mode: TorAuditMode;
  fileName: string;
  /** Text extracted from the TOR / technical specification document. */
  torText?: string;
  /** Text extracted from the technician's proposal, for a comparison audit. */
  proposalText?: string;
}

// Mirrors the backend contract in services/Applications/ESTIMATION/torAudit/result.js
// plus the catalog enrichment applied by torAudit/catalogPricing.js.
export interface TorAuditResult {
  totalTechnicianCost: number;
  totalAiRecommendedCost: number;
  varianceAmount: number;
  variancePercent: number;
  equipmentComparison: unknown[];
  manpowerComparison: unknown[];
  consumablesComparison?: unknown[];
  overallAuditRationale: string;
  confidenceScore: number;
  /** Present when the catalog lookup completed. */
  pricingSummary?: {
    linesPriced: number;
    catalogPriced: number;
    benchmarkPriced: number;
    unpricedLines: number;
    catalogEquipmentTotal: number;
    catalogMaterialsTotal: number;
  };
}

const TIMEOUT_MS = 300_000; // a full forensic audit of a proposal runs long

// The backend wraps the audit in its own envelope, so the HTTP body is
// `{ success, data: <audit> }`. ApiClient already returns that body as
// `response.data`, which means the audit itself sits at `response.data.data`.
interface TorAuditEnvelope {
  success?: boolean;
  data?: TorAuditResult;
  error?: string;
}

/**
 * @throws Error with a user-facing message when the audit fails.
 */
export async function requestTorAudit(request: TorAuditRequest): Promise<TorAuditResult> {
  const response = await apiClient.post<TorAuditEnvelope>('/service/estimation/ai/tor-audit', request, {
    timeoutMs: TIMEOUT_MS,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'The document audit could not be completed.');
  }

  const body = response.data;
  if (!body || body.success === false) {
    throw new Error(body?.error || 'The document audit could not be completed.');
  }

  const audit = body.data;
  if (!audit || typeof audit !== 'object' || !Array.isArray(audit.equipmentComparison)) {
    throw new Error('The audit service returned an unreadable result.');
  }

  return audit;
}
