// Estimation flow API clients — the three endpoints documented in
// api-specs.md. Thin transport only: builds requests, unwraps the standard
// { success, data, error } envelope, and throws user-facing messages.
// All AI work (OCR, vision, BOQ, catalog pricing) happens server-side.

import { apiClient } from './index';

const AI_REQUEST_TIMEOUT_MS = 180000;
const MAX_FLOORPLAN_FILES = 6;
const MAX_FLOORPLAN_FILE_BYTES = 12 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

// Backend contract: success -> { success: true,  data: <payload> }
//                 failure -> { success: false, data: '', error: '<reason>' }
interface EstimationFlowBackendResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const FLOORPLAN_ANALYZE_ENDPOINT = '/api/floorplan/analyze';
export const SECTION_REQUIREMENTS_ENDPOINT =
  '/service/estimation/ai/section/requirements';
export const ESTIMATION_ANALYZE_ENDPOINT = '/service/estimation/ai/analyze';

/** Advisory fileType derived from the file name; bytes are sniffed server-side. */
export function fileTypeFromName(name: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(name || '');
  if (!match) return undefined;
  const ext = match[1].toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext) ? ext : undefined;
}

async function postJson<T>(
  url: string,
  payload: unknown,
  fallbackError: string
): Promise<T> {
  const response = await apiClient.post<EstimationFlowBackendResponse<T>>(
    url,
    payload,
    { timeoutMs: AI_REQUEST_TIMEOUT_MS }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || fallbackError);
  }

  const body = response.data;
  if (!body.success) {
    throw new Error(body.error || fallbackError);
  }
  if (body.data === undefined || body.data === null) {
    throw new Error('The AI service returned an empty response.');
  }

  return body.data;
}

// ---------------------------------------------------------------------------
// API #1 — Floor Plan Analysis (POST /api/floorplan/analyze)
// ---------------------------------------------------------------------------

export interface FloorPlanSection {
  sectionId: string;
  type: string;
  subType?: string;
  label: string;
  confidence?: number;
  polygon?: { x: number; y: number }[];
  bbox?: { x: number; y: number; width: number; height: number };
  area?: number;
  unit?: string;
  dimensions?: { width?: number; height?: number; unit?: string };
  annotations?: string[];
  features?: Record<string, unknown>;
  systemsDetected?: Record<string, unknown>;
}

export interface FloorPlanPage {
  pageNumber: number;
  floorNumber?: number;
  scale?: { value?: number; unit?: string };
  dimensions?: { width?: number; height?: number; unit?: string };
  sections?: FloorPlanSection[];
  corridors?: FloorPlanSection[];
  verticalCirculation?: FloorPlanSection[];
  utilityAreas?: FloorPlanSection[];
}

export interface FloorPlanAnalyzeResult {
  requestId?: string;
  analyzedAt?: string;
  processingTimeMs?: number;
  fileInfo?: {
    fileName?: string;
    pages?: number;
    pageSize?: { width?: number; height?: number; unit?: string };
    scale?: { value?: number; unit?: string; detected?: boolean };
    orientation?: string;
  };
  confidenceScore?: number;
  pages?: FloorPlanPage[];
  summary?: {
    totalRooms?: number;
    totalCorridors?: number;
    totalArea?: number;
    unit?: string;
    roomTypes?: Record<string, number>;
    systemsCoverage?: Record<
      string,
      { roomsCovered?: number; cameraCount?: number }
    >;
  };
  recommendations?: unknown[];
}

export interface FloorPlanProjectContext {
  buildingType?: string;
  floors?: number;
  systemTypes?: string[];
  projectId?: string;
}

export interface FloorPlanAnalyzeOptions {
  extractDimensions?: boolean;
  extractAnnotations?: boolean;
  detectSystems?: boolean;
  classifyRooms?: boolean;
  outputFormat?: string;
  coordinateSystem?: string;
  confidenceThreshold?: number;
}

// Optional TOR / Proposal document text attached in the wizard (Create
// Estimation flow) and sent to every analysis endpoint as supplemental
// context for the AI (server caps: 4 docs, 6 KB each).

export interface SupplementalDocument {
  name: string;
  content: string;
}

export interface FloorPlanAnalyzeRequest {
  files: File[];
  fileType?: string;
  projectContext?: FloorPlanProjectContext;
  analysisOptions?: FloorPlanAnalyzeOptions;
  supplementalDocuments?: SupplementalDocument[];
}

export async function analyzeFloorPlan(
  request: FloorPlanAnalyzeRequest
): Promise<FloorPlanAnalyzeResult> {
  const files = request.files.slice(0, MAX_FLOORPLAN_FILES);
  if (files.length === 0) {
    throw new Error('Attach at least one floor plan file.');
  }

  const oversized = files.find(f => f.size > MAX_FLOORPLAN_FILE_BYTES);
  if (oversized) {
    throw new Error(`"${oversized.name}" exceeds the 12 MB file limit.`);
  }

  const formData = new FormData();
  // Single file uses `file`; multi-sheet sets use `files[]` per api-specs.md.
  const field = files.length === 1 ? 'file' : 'files[]';
  files.forEach((file, index) => {
    formData.append(field, file, file.name || `floorplan_${index + 1}`);
  });

  const fileType = request.fileType || fileTypeFromName(files[0].name);
  if (fileType) formData.append('fileType', fileType);
  if (request.projectContext) {
    formData.append('projectContext', JSON.stringify(request.projectContext));
  }
  if (request.analysisOptions) {
    formData.append('analysisOptions', JSON.stringify(request.analysisOptions));
  }
  if (request.supplementalDocuments && request.supplementalDocuments.length > 0) {
    formData.append('supplementalDocuments', JSON.stringify(request.supplementalDocuments));
  }

  const response = await apiClient.postForm<
    EstimationFlowBackendResponse<FloorPlanAnalyzeResult>
  >(FLOORPLAN_ANALYZE_ENDPOINT, formData, { timeoutMs: AI_REQUEST_TIMEOUT_MS });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Floor plan analysis failed.');
  }

  const body = response.data;
  if (!body.success) {
    throw new Error(body.error || 'Floor plan analysis failed.');
  }
  if (!body.data) {
    throw new Error('Floor plan analysis returned an empty response.');
  }

  return body.data;
}

// ---------------------------------------------------------------------------
// API #2 — Section Requirements Extraction
// (POST /service/estimation/ai/section/requirements)
// ---------------------------------------------------------------------------

// Shared Cost Estimation form shapes — returned by both API #2 and API #3 so
// the wizard can drop AI results straight into the page's tables.

export interface FormManpowerRow {
  role?: string;
  headcount?: number;
  /** Hours per person over the job. */
  hours?: number;
  /** Total person-days (headcount x working days). */
  manDays?: number;
  dayRate?: number;
  totalCost?: number;
  responsibilities?: string;
}

export interface FormMaterialItem {
  name?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  quantity?: number;
  unit?: string;
  /** List price — the tier source when the model omits unitPrice. */
  srp?: number;
  contractorPrice?: number;
  dealerPrice?: number;
  unitPrice?: number;
  totalPrice?: number;
  source?: string;
  catalog?: {
    prod_Code?: string;
    prod_Name?: string;
    brand?: string;
    prod_price?: number;
  };
}

export interface FormScopeRow {
  itemNumber?: number;
  description?: string;
  unit?: string;
  totalPrice?: number;
}

export interface FormConstraints {
  physical?: string;
  electrical?: string;
  installation?: string;
}

export interface FormFeeRow {
  type?: string;
  amount?: number;
  description?: string;
}

export interface SectionRequirementEntry {
  required?: boolean;
  coverage?: string;
  cameraCount?: number;
  cameraSpecs?: unknown[];
  cabling?: Record<string, unknown>;
  standards?: string[];
  codeReferences?: string[];
  [key: string]: unknown;
}

export interface SectionRequirementsResult {
  requestId?: string;
  analyzedAt?: string;
  sectionId?: string;
  sectionLabel?: string;
  sectionType?: string;
  area?: number;
  unit?: string;
  confidenceScore?: number;
  requirements?: Record<string, SectionRequirementEntry>;
  laborEstimates?: {
    totalHours?: number;
    crewMix?: Record<string, number>;
    [key: string]: unknown;
  };
  manpower?: FormManpowerRow[];
  materials?: FormMaterialItem[];
  scopeOfWorks?: FormScopeRow[];
  constraints?: FormConstraints;
  materialSummary?: {
    categories?: {
      category?: string;
      itemCount?: number;
      estimatedCost?: number;
    }[];
    totalEstimatedCost?: number;
    currency?: string;
  };
  compliance?: {
    gaps?: {
      system?: string;
      requirement?: string;
      status?: string;
      recommendation?: string;
    }[];
    overallCompliance?: number;
  };
  recommendations?: {
    priority?: string;
    system?: string;
    action?: string;
    estimatedCost?: number;
  }[];
}

export interface SectionRequirementsRequest {
  section: FloorPlanSection;
  projectContext?: FloorPlanProjectContext;
  supplementalDocuments?: SupplementalDocument[];
  analysisOptions?: {
    includeCatalogMatches?: boolean;
    includeLaborEstimates?: boolean;
    includeMaterialAlternates?: boolean;
    includeCodeReferences?: boolean;
    market?: string;
    currency?: string;
  };
}

export async function extractSectionRequirements(
  request: SectionRequirementsRequest
): Promise<SectionRequirementsResult> {
  if (!request.section?.sectionId) {
    throw new Error('Select a floor plan section first.');
  }

  return postJson<SectionRequirementsResult>(
    SECTION_REQUIREMENTS_ENDPOINT,
    request,
    'Section requirements extraction failed.'
  );
}

// ---------------------------------------------------------------------------
// API #3 — Estimation Analysis (POST /service/estimation/ai/analyze)
// ---------------------------------------------------------------------------

export interface EstimationSiteInfo {
  buildingType: string;
  floors?: number;
  buildingLength?: number;
  buildingWidth?: number;
  floorHeight?: number;
  totalFloorArea?: number;
  roomsCount?: number;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  surveyScope?: string;
  scheduleDate?: string;
  isNewBuilding?: boolean;
}

export interface EstimationSystemsPayload {
  CCTV?: Record<string, unknown>;
  FDAS?: Record<string, unknown>;
  ACCESS_CONTROL?: Record<string, unknown>;
  BURGLAR_ALARM?: Record<string, unknown>;
  FIRE_PROTECTION?: Record<string, unknown>;
  OTHER?: Record<string, unknown>;
}

export interface EstimationAnalyzeRequest {
  siteInfo: EstimationSiteInfo;
  systems: EstimationSystemsPayload;
  clientContext?: Record<string, unknown>;
  supplementalDocuments?: SupplementalDocument[];
  analysisOptions?: {
    includeLaborBreakdown?: boolean;
    includeMaterialAlternates?: boolean;
    includePhaseSchedule?: boolean;
    confidenceThreshold?: number;
    currency?: string;
    market?: string;
  };
}

export interface EstimationAnalyzeResult {
  requestId?: string;
  analyzedAt?: string;
  confidenceScore?: number;
  assumptions?: string[];
  summary?: {
    totalEstimatedCost?: number;
    currency?: string;
    breakdown?: {
      materials?: number;
      labor?: number;
      fees?: number;
      equipment?: number;
      consumables?: number;
      contingency?: number;
    };
    timeline?: {
      totalDays?: number;
      phases?: { phase?: string; days?: number }[];
    };
  };
  manpower?: FormManpowerRow[];
  labor?: {
    activity?: string;
    systemTypes?: string[];
    crewComposition?: Record<string, number>;
    estimatedHours?: number;
    unit?: string;
    ratePerHour?: number;
    totalCost?: number;
    details?: string;
  }[];
  materials?: {
    category?: string;
    items?: FormMaterialItem[];
    subtotal?: number;
  }[];
  fees?: FormFeeRow[];
  scopeOfWorks?: FormScopeRow[];
  constraints?: FormConstraints;
  equipment?: unknown[];
  alternates?: unknown[];
  phaseSchedule?: unknown[];
  risks?: {
    risk?: string;
    probability?: string;
    impact?: string;
    mitigation?: string;
  }[];
}

export async function analyzeEstimation(
  request: EstimationAnalyzeRequest
): Promise<EstimationAnalyzeResult> {
  return postJson<EstimationAnalyzeResult>(
    ESTIMATION_ANALYZE_ENDPOINT,
    request,
    'Estimation analysis failed.'
  );
}
