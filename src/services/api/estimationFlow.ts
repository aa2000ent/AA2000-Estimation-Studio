// Estimation flow API clients — the three endpoints documented in
// api-specs.md. Thin transport only: builds requests, unwraps the standard
// { success, data, error } envelope, and throws user-facing messages.
// All AI work (OCR, vision, BOQ, catalog pricing) happens server-side.

import { apiClient } from './index';

const AI_REQUEST_TIMEOUT_MS = 180000;
// The live /api/floorplan/analyze takes one drawing per call and allows 5 calls a
// minute per session, so one analysis covers at most 5 floor plans.
export const MAX_FLOORPLAN_FILES = 5;
export const MAX_FLOORPLAN_FILE_BYTES = 12 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

function isLocalEstimationApiMockEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mockEstimationApi') === '1'
  );
}

async function waitForMockResponse(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Request cancelled', 'AbortError');
  }
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Request cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function logMockMode(): void {
  console.info(
    '[Estimation flow] Local API mock is enabled. Remove ?mockEstimationApi=1 to use the backend.'
  );
}

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
  fallbackError: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await apiClient.post<EstimationFlowBackendResponse<T>>(
    url,
    payload,
    { timeoutMs: AI_REQUEST_TIMEOUT_MS, signal }
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
  /** The title the user gave the floor plan this page came from (e.g. "Ground Floor"). */
  title?: string;
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

/** Descriptive title the user gives each uploaded plan (e.g. "Ground Floor"), sent to the AI as context. */
export interface FloorPlanLabel {
  fileName: string;
  title: string;
}

export const MAX_FLOOR_PLAN_TITLE_LENGTH = 80;

export interface FloorPlanAnalyzeRequest {
  files: File[];
  /** Titles matched to the uploads by fileName. */
  labels?: FloorPlanLabel[];
  fileType?: string;
  projectContext?: FloorPlanProjectContext;
  analysisOptions?: FloorPlanAnalyzeOptions;
  supplementalDocuments?: SupplementalDocument[];
}

/**
 * Mock mode only: one page per uploaded file, each carrying its title, so the
 * demo shows how titles flow through. The real server tags pages itself.
 */
function withMockPageTitles(
  result: FloorPlanAnalyzeResult,
  files: File[],
  labels: FloorPlanLabel[]
): FloorPlanAnalyzeResult {
  const template = result.pages?.[0];
  if (!template) return result;
  return {
    ...result,
    pages: files.map((file, index) => {
      const title = labels.find(label => label.fileName === file.name)?.title;
      const suffix = `-p${index + 1}`;
      const tag = (list?: FloorPlanSection[]) =>
        list?.map(section => ({ ...section, sectionId: `${section.sectionId}${suffix}` }));
      return {
        ...template,
        pageNumber: index + 1,
        floorNumber: index,
        ...(title ? { title } : {}),
        sections: tag(template.sections),
        corridors: tag(template.corridors),
      };
    }),
  };
}

export async function analyzeFloorPlan(
  request: FloorPlanAnalyzeRequest,
  signal?: AbortSignal
): Promise<FloorPlanAnalyzeResult> {
  const files = request.files.slice(0, MAX_FLOORPLAN_FILES);
  if (files.length === 0) {
    throw new Error('Attach at least one floor plan file.');
  }

  const tooLongTitle = (request.labels || []).find(l => l.title.length > MAX_FLOOR_PLAN_TITLE_LENGTH);
  if (tooLongTitle) {
    throw new Error(`Floor plan titles must be ${MAX_FLOOR_PLAN_TITLE_LENGTH} characters or fewer.`);
  }

  const oversized = files.find(f => f.size > MAX_FLOORPLAN_FILE_BYTES);
  if (oversized) {
    throw new Error(`"${oversized.name}" exceeds the 12 MB file limit.`);
  }

  if (isLocalEstimationApiMockEnabled()) {
    logMockMode();
    await waitForMockResponse(1800, signal);
    return withMockPageTitles({
      requestId: 'local-mock-floorplan',
      analyzedAt: new Date().toISOString(),
      processingTimeMs: 1800,
      fileInfo: {
        fileName: files.map(file => file.name).join(', '),
        pages: files.length,
        scale: { value: 1, unit: 'cm', detected: true },
        orientation: 'landscape',
      },
      confidenceScore: 92,
      pages: [
        {
          pageNumber: 1,
          floorNumber: 1,
          dimensions: { width: 42, height: 28, unit: 'm' },
          sections: [
            {
              sectionId: 'mock-lobby',
              type: 'room',
              subType: 'lobby',
              label: 'Main Lobby',
              confidence: 0.96,
              area: 84,
              unit: 'sqm',
              dimensions: { width: 12, height: 7, unit: 'm' },
              bbox: { x: 0.08, y: 0.1, width: 0.3, height: 0.25 },
              annotations: ['Reception', 'Main entrance'],
              systemsDetected: { CCTV: true, FDAS: true, ACCESS_CONTROL: true },
            },
            {
              sectionId: 'mock-office',
              type: 'room',
              subType: 'office',
              label: 'Open Office',
              confidence: 0.93,
              area: 168,
              unit: 'sqm',
              dimensions: { width: 21, height: 8, unit: 'm' },
              bbox: { x: 0.4, y: 0.1, width: 0.48, height: 0.3 },
              annotations: ['Workstations: 24'],
              systemsDetected: { CCTV: true, FDAS: true },
            },
            {
              sectionId: 'mock-server-room',
              type: 'room',
              subType: 'server_room',
              label: 'Server Room',
              confidence: 0.97,
              area: 36,
              unit: 'sqm',
              dimensions: { width: 6, height: 6, unit: 'm' },
              bbox: { x: 0.08, y: 0.48, width: 0.2, height: 0.22 },
              annotations: ['Restricted access', 'Cooling required'],
              systemsDetected: { CCTV: true, FDAS: true, ACCESS_CONTROL: true },
            },
          ],
          corridors: [
            {
              sectionId: 'mock-corridor',
              type: 'corridor',
              label: 'Main Corridor',
              confidence: 0.9,
              area: 52,
              unit: 'sqm',
              bbox: { x: 0.3, y: 0.42, width: 0.55, height: 0.08 },
            },
          ],
        },
      ],
      summary: {
        totalRooms: 3,
        totalCorridors: 1,
        totalArea: 340,
        unit: 'sqm',
        roomTypes: { lobby: 1, office: 1, server_room: 1 },
        systemsCoverage: {
          CCTV: { roomsCovered: 3, cameraCount: 8 },
          FDAS: { roomsCovered: 3 },
          ACCESS_CONTROL: { roomsCovered: 2 },
        },
      },
      recommendations: [
        'Use controlled access for the server room.',
        'Provide camera coverage at the lobby entrance and main corridor.',
      ],
    }, files, request.labels || []);
  }

  const titleFor = (file: File) =>
    (request.labels || []).find(label => label.fileName === file.name)?.title.trim() || '';

  const analyzeOne = async (file: File): Promise<FloorPlanAnalyzeResult> => {
    const formData = new FormData();
    // The endpoint takes exactly one drawing per call, in `file`.
    formData.append('file', file, file.name || 'floorplan');

    const fileType = (files.length === 1 && request.fileType ? request.fileType : fileTypeFromName(file.name) || 'pdf')
      .toLowerCase()
      .replace('.', '');
    formData.append('fileType', fileType);
    const title = titleFor(file);
    if (title) formData.append('floorPlanTitle', title);
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
    >(FLOORPLAN_ANALYZE_ENDPOINT, formData, { timeoutMs: AI_REQUEST_TIMEOUT_MS, signal });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Floor plan analysis failed.');
    }

    const body = response.data;
    if (!body.success) {
      throw new Error(body.error || 'Floor plan analysis failed.');
    }
    // /api/floorplan/analyze answers with the result itself (api-specs.md); older
    // servers wrapped it in `data`. Accept both.
    const result = body.data ?? ((body as unknown as FloorPlanAnalyzeResult).pages ? (body as unknown as FloorPlanAnalyzeResult) : undefined);
    if (!result) {
      throw new Error('Floor plan analysis returned an empty response.');
    }

    return result;
  };

  // One request per floor plan, one after the other. The API allows one request
  // a second, so there is a short pause between plans.
  const results: FloorPlanAnalyzeResult[] = [];
  for (let index = 0; index < files.length; index += 1) {
    if (index > 0) await waitForMockResponse(1100, signal);
    try {
      results.push(await analyzeOne(files[index]));
    } catch (error) {
      if (files.length === 1 || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      const message = error instanceof Error ? error.message : 'Floor plan analysis failed.';
      throw new Error(`"${files[index].name}": ${message}`);
    }
  }
  return results.length === 1 ? results[0] : mergeFloorPlanResults(results);
}

/**
 * Joins the per-plan results into one: pages are renumbered in upload order
 * (each keeps its title), section ids get a per-plan prefix so they stay
 * unique, and the summary totals are summed.
 */
function mergeFloorPlanResults(results: FloorPlanAnalyzeResult[]): FloorPlanAnalyzeResult {
  const prefixIds = (list: FloorPlanSection[] | undefined, plan: number) =>
    list?.map(section => ({ ...section, sectionId: `f${plan}-${section.sectionId}` }));

  let pageNumber = 0;
  const pages: FloorPlanPage[] = results.flatMap((result, index) =>
    (result.pages ?? []).map(page => ({
      ...page,
      pageNumber: ++pageNumber,
      sections: prefixIds(page.sections, index + 1),
      corridors: prefixIds(page.corridors, index + 1),
      verticalCirculation: prefixIds(page.verticalCirculation, index + 1),
      utilityAreas: prefixIds(page.utilityAreas, index + 1),
    }))
  );

  const sum = (pick: (result: FloorPlanAnalyzeResult) => number | undefined) =>
    results.reduce((total, result) => total + (pick(result) ?? 0), 0);

  const roomTypes: Record<string, number> = {};
  const coverage: Record<string, { roomsCovered?: number; cameraCount?: number }> = {};
  for (const result of results) {
    for (const [type, count] of Object.entries(result.summary?.roomTypes ?? {})) {
      roomTypes[type] = (roomTypes[type] ?? 0) + count;
    }
    for (const [system, detail] of Object.entries(result.summary?.systemsCoverage ?? {})) {
      const merged = coverage[system] ?? {};
      if (detail.roomsCovered !== undefined) merged.roomsCovered = (merged.roomsCovered ?? 0) + detail.roomsCovered;
      if (detail.cameraCount !== undefined) merged.cameraCount = (merged.cameraCount ?? 0) + detail.cameraCount;
      coverage[system] = merged;
    }
  }

  const first = results[0];
  return {
    requestId: first.requestId,
    analyzedAt: results[results.length - 1].analyzedAt,
    processingTimeMs: sum(result => result.processingTimeMs),
    fileInfo: {
      ...first.fileInfo,
      fileName: results.map(result => result.fileInfo?.fileName).filter(Boolean).join(', '),
      pages: pages.length,
    },
    confidenceScore: Math.round(sum(result => result.confidenceScore) / results.length),
    pages,
    summary: {
      totalRooms: sum(result => result.summary?.totalRooms),
      totalCorridors: sum(result => result.summary?.totalCorridors),
      totalArea: sum(result => result.summary?.totalArea),
      unit: first.summary?.unit,
      roomTypes,
      systemsCoverage: coverage,
    },
    recommendations: results.flatMap(result => result.recommendations ?? []),
  };
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
  floorPlans?: FloorPlanLabel[];
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

  if (isLocalEstimationApiMockEnabled()) {
    logMockMode();
    await waitForMockResponse(1400);
    return {
      requestId: 'local-mock-section-requirements',
      analyzedAt: new Date().toISOString(),
      sectionId: request.section.sectionId,
      sectionLabel: request.section.label,
      sectionType: request.section.type,
      area: request.section.area ?? 84,
      unit: request.section.unit ?? 'sqm',
      confidenceScore: 91,
      requirements: {
        CCTV: {
          required: true,
          coverage: 'Full coverage at entrances and public circulation areas',
          cameraCount: 3,
          cameraSpecs: ['4 MP IP dome camera', 'PoE', 'WDR'],
          standards: ['ONVIF Profile S'],
        },
        FDAS: {
          required: true,
          coverage: 'Addressable smoke detection with audible/visual alarm',
          standards: ['Philippine Fire Code'],
        },
        ACCESS_CONTROL: {
          required: true,
          coverage: 'Card reader at the controlled entry',
        },
      },
      laborEstimates: {
        totalHours: 40,
        crewMix: { Technician: 2, Supervisor: 1 },
      },
      manpower: [
        {
          role: 'ELV Technician',
          headcount: 2,
          hours: 16,
          manDays: 2,
          dayRate: 1800,
          totalCost: 7200,
          responsibilities: 'Install devices, cabling, and terminations.',
        },
        {
          role: 'Site Supervisor',
          headcount: 1,
          hours: 8,
          manDays: 1,
          dayRate: 2500,
          totalCost: 2500,
          responsibilities: 'Coordinate installation and testing.',
        },
      ],
      materials: [
        {
          name: '4 MP IP Dome Camera',
          category: 'CCTV',
          brand: 'Generic',
          quantity: 3,
          unit: 'pcs',
          srp: 8500,
          unitPrice: 8500,
          totalPrice: 25500,
          source: 'local mock',
        },
        {
          name: 'Cat6 UTP Cable',
          category: 'Cabling',
          quantity: 150,
          unit: 'm',
          srp: 32,
          unitPrice: 32,
          totalPrice: 4800,
          source: 'local mock',
        },
      ],
      scopeOfWorks: [
        { itemNumber: 1, description: 'Supply and install CCTV devices.', unit: 'lot' },
        { itemNumber: 2, description: 'Test, commission, and document the system.', unit: 'lot' },
      ],
      constraints: {
        physical: 'Coordinate ceiling access with the building administrator.',
        electrical: 'Confirm PoE switch capacity before installation.',
        installation: 'Perform disruptive work outside business hours.',
      },
      materialSummary: {
        categories: [
          { category: 'CCTV', itemCount: 1, estimatedCost: 25500 },
          { category: 'Cabling', itemCount: 1, estimatedCost: 4800 },
        ],
        totalEstimatedCost: 30300,
        currency: 'PHP',
      },
      compliance: {
        gaps: [
          {
            system: 'CCTV',
            requirement: 'Confirm retention period with the client.',
            status: 'To confirm',
            recommendation: 'Document the approved retention period before commissioning.',
          },
        ],
        overallCompliance: 88,
      },
      recommendations: [
        {
          priority: 'high',
          system: 'CCTV',
          action: 'Verify camera views on site before final mounting.',
          estimatedCost: 0,
        },
      ],
    };
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
  floorPlans?: FloorPlanLabel[];
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
  request: EstimationAnalyzeRequest,
  signal?: AbortSignal
): Promise<EstimationAnalyzeResult> {
  if (isLocalEstimationApiMockEnabled()) {
    logMockMode();
    await waitForMockResponse(1600, signal);
    return {
      requestId: 'local-mock-estimation',
      analyzedAt: new Date().toISOString(),
      confidenceScore: 89,
      assumptions: [
        'Existing containment pathways are reusable where they are in good condition.',
        'Final device positions will be confirmed during the site walk.',
      ],
      summary: {
        totalEstimatedCost: 74350,
        currency: 'PHP',
        breakdown: {
          materials: 42300,
          labor: 9700,
          fees: 4000,
          equipment: 6000,
          consumables: 2100,
          contingency: 0.16,
        },
        timeline: {
          totalDays: 8,
          phases: [
            { phase: 'Site coordination and preparation', days: 1 },
            { phase: 'Installation and cabling', days: 5 },
            { phase: 'Testing, commissioning, and handover', days: 2 },
          ],
        },
      },
      manpower: [
        {
          role: 'ELV Technician',
          headcount: 2,
          hours: 40,
          manDays: 5,
          dayRate: 1800,
          totalCost: 18000,
          responsibilities: 'Install, terminate, and test field devices.',
        },
        {
          role: 'Site Supervisor',
          headcount: 1,
          hours: 16,
          manDays: 2,
          dayRate: 2500,
          totalCost: 5000,
          responsibilities: 'Coordinate site work and acceptance testing.',
        },
      ],
      labor: [
        {
          activity: 'Device installation and commissioning',
          systemTypes: ['CCTV', 'FDAS', 'ACCESS_CONTROL'],
          crewComposition: { Technician: 2, Supervisor: 1 },
          estimatedHours: 56,
          unit: 'hours',
          ratePerHour: 500,
          totalCost: 28000,
          details: 'Includes installation, configuration, and testing.',
        },
      ],
      materials: [
        {
          category: 'CCTV',
          subtotal: 25500,
          items: [
            {
              name: '4 MP IP Dome Camera',
              description: 'Indoor PoE camera with WDR',
              quantity: 3,
              unit: 'pcs',
              unitPrice: 8500,
              totalPrice: 25500,
            },
          ],
        },
        {
          category: 'Cabling',
          subtotal: 16800,
          items: [
            {
              name: 'Cat6 UTP Cable',
              quantity: 150,
              unit: 'm',
              unitPrice: 32,
              totalPrice: 4800,
            },
            {
              name: 'Installation accessories and containment',
              quantity: 1,
              unit: 'lot',
              unitPrice: 12000,
              totalPrice: 12000,
            },
          ],
        },
      ],
      fees: [
        { type: 'Testing and commissioning', amount: 2500 },
        { type: 'Documentation and handover', amount: 1500 },
      ],
      scopeOfWorks: [
        { itemNumber: 1, description: 'Supply and install the proposed ELV systems.', unit: 'lot' },
        { itemNumber: 2, description: 'Test, commission, and hand over the installed systems.', unit: 'lot' },
      ],
      constraints: {
        physical: 'Coordinate ceiling access and work permits with the site representative.',
        electrical: 'Verify spare PoE and circuit capacity before installation.',
        installation: 'Schedule noisy work outside normal operating hours.',
      },
      equipment: [{ name: 'Network cable certifier', quantity: 1 }],
      alternates: [{ item: 'IP dome camera', alternate: 'Equivalent ONVIF-compatible model' }],
      phaseSchedule: [
        { phase: 'Preparation', days: 1 },
        { phase: 'Installation', days: 5 },
        { phase: 'Testing and handover', days: 2 },
      ],
      risks: [
        {
          risk: 'Existing pathways may be congested.',
          probability: 'medium',
          impact: 'medium',
          mitigation: 'Inspect routes before mobilization and agree on alternate pathways.',
        },
      ],
    };
  }

  return postJson<EstimationAnalyzeResult>(
    ESTIMATION_ANALYZE_ENDPOINT,
    request,
    'Estimation analysis failed.',
    signal
  );
}
