import { apiClient } from './index';

export interface FloorPlanProjectContext {
  buildingType?: string;
  floors?: number;
  systemTypes?: string[];
  projectId?: string;
}

export interface FloorPlanAnalysisOptions {
  extractDimensions?: boolean;
  extractAnnotations?: boolean;
  detectSystems?: boolean;
  classifyRooms?: boolean;
  outputFormat?: string;
  coordinateSystem?: string;
  confidenceThreshold?: number;
}

export interface FloorPlanSection {
  sectionId: string;
  type: string;
  subType: string;
  label: string;
  confidence: number;
  polygon?: Array<{ x: number; y: number }>;
  bbox?: { x: number; y: number; width: number; height: number };
  area?: number;
  unit?: string;
  annotations?: string[];
  features?: Record<string, unknown>;
  systemsDetected?: Record<string, unknown>;
}

export interface FloorPlanAnalysisResponse {
  success: boolean;
  requestId?: string;
  analyzedAt?: string;
  processingTimeMs?: number;
  confidenceScore?: number;
  pages?: Array<{
    pageNumber: number;
    floorNumber?: number;
    dimensions?: { width: number; height: number; unit: string };
    sections: FloorPlanSection[];
    corridors?: unknown[];
    verticalCirculation?: unknown[];
    utilityAreas?: unknown[];
  }>;
  summary?: {
    totalRooms: number;
    totalCorridors: number;
    totalArea: number;
    unit: string;
    roomTypes?: Record<string, number>;
    systemsCoverage?: Record<string, unknown>;
  };
  recommendations?: unknown[];
  error?: string;
}

/**
 * POST /api/floorplan/analyze
 * Extracts structured sections from floor plan images/PDFs.
 */
export async function analyzeFloorPlan(
  file: File,
  fileType: 'pdf' | 'png' | 'jpg' | 'jpeg' | 'dwg' | 'dxf',
  projectContext?: FloorPlanProjectContext,
  analysisOptions?: FloorPlanAnalysisOptions
): Promise<FloorPlanAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('fileType', fileType);

  if (projectContext) {
    formData.append('projectContext', JSON.stringify(projectContext));
  }
  if (analysisOptions) {
    formData.append('analysisOptions', JSON.stringify(analysisOptions));
  }

  const response = await apiClient.postForm<FloorPlanAnalysisResponse>(
    '/api/floorplan/analyze',
    formData,
    { timeoutMs: 120000 }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Floor plan analysis failed');
  }

  return response.data;
}
