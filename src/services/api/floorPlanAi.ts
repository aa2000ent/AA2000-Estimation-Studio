// Floor-plan BOQ API client.
// Thin transport only: builds the multipart request for POST
// /floor-plan-ai-analysis and returns the backend's FloorPlanEstimation.
// All AI work (OCR, vision, BOQ, catalog pricing) happens server-side, so no
// model API key is exposed to the browser.

import { apiClient } from './index';

/** Building context forwarded to the backend prompt builders. */
export interface FloorPlanBuildingInfo {
  buildingType?: string;
  floors?: number;
  location?: string;
  projectName?: string;
  surveyScope?: string;
  torContent?: string;
  selectedBrand?: string;
  clientName?: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  systemTypes?: string[];
}

// Backend contract: success -> { success: true,  data: "<markdown BOQ>" }
//                 failure -> { success: false, data: '', error: "<reason>" }
interface FloorPlanBackendResponse {
  success: boolean;
  data?: string;
  error?: string;
}

export const FLOORPLAN_ENDPOINT = '/floor-plan-ai-analysis';

const FLOORPLAN_REQUEST_TIMEOUT_MS = 180000;
const MAX_PLAN_FILES = 6;
const MAX_DOCUMENT_FILES = 6;

export function isFloorPlanImage(file: File): boolean {
  return /\.(png|jpe?g)$/i.test(file.name);
}

export function isFloorPlanDocument(file: File): boolean {
  return /\.(pdf|docx)$/i.test(file.name);
}

export interface FloorPlanRequest {
  files: File[];
  surveyType: string;
  info: FloorPlanBuildingInfo;
  /** File names the UI flagged as TOR/spec, so the backend OCRs them. */
  torFileNames?: string[];
}

/**
 * Runs a floor-plan estimation on the backend.
 * @returns the BOQ as markdown, ready for parseFloorPlanMarkdown().
 * @throws Error with a user-facing message when the request fails.
 */
export async function requestFloorPlanEstimation(
  request: FloorPlanRequest
): Promise<string> {
  const planFiles = request.files.filter(isFloorPlanImage).slice(0, MAX_PLAN_FILES);
  const documentFiles = request.files.filter(isFloorPlanDocument).slice(0, MAX_DOCUMENT_FILES);

  if (planFiles.length === 0 && documentFiles.length === 0) {
    throw new Error('Attach at least one floor plan or TOR document.');
  }

  const payload = {
    surveyType: request.surveyType,
    info: request.info,
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  if (request.torFileNames?.length) {
    formData.append('torFileNames', request.torFileNames.join(','));
  }
  planFiles.forEach((file, index) => {
    formData.append('plans', file, file.name || `plan_${index + 1}.png`);
  });
  documentFiles.forEach((file, index) => {
    formData.append('documents', file, file.name || `document_${index + 1}.pdf`);
  });

  const response = await apiClient.postForm<FloorPlanBackendResponse>(
    FLOORPLAN_ENDPOINT,
    formData,
    { timeoutMs: FLOORPLAN_REQUEST_TIMEOUT_MS }
  );

  if (!response.success) {
    throw new Error(
      response.error?.message || 'Failed to reach the estimation service.'
    );
  }

  const body = response.data;
  if (!body?.success) {
    throw new Error(body?.error || 'Floor plan estimation failed.');
  }
  if (typeof body.data !== 'string' || !body.data.trim()) {
    throw new Error('The estimation service returned an empty response.');
  }

  return body.data;
}