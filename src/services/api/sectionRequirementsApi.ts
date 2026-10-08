import { apiClient } from './index';
import type { FloorPlanSection, FloorPlanProjectContext } from './floorPlanAnalyzeApi';

export interface SectionRequirementsOptions {
  includeCatalogMatches?: boolean;
  includeLaborEstimates?: boolean;
  includeMaterialAlternates?: boolean;
  includeCodeReferences?: boolean;
  market?: string;
  currency?: string;
}

export interface SectionRequirementsResponse {
  success: boolean;
  requestId?: string;
  analyzedAt?: string;
  sectionId?: string;
  sectionLabel?: string;
  sectionType?: string;
  area?: number;
  unit?: string;
  confidenceScore?: number;
  requirements?: Record<string, unknown>;
  laborEstimates?: {
    totalHours?: number;
    crewMix?: Record<string, number>;
    [key: string]: unknown;
  };
  materialSummary?: {
    categories?: Array<{ category: string; itemCount: number; estimatedCost: number }>;
    totalEstimatedCost?: number;
    currency?: string;
  };
  compliance?: {
    gaps?: Array<{ system: string; requirement: string; status: string; recommendation: string }>;
    overallCompliance?: number;
  };
  recommendations?: Array<{ priority: string; system: string; action: string; estimatedCost: number }>;
  error?: string;
}

/**
 * POST /api/floorplan/section/requirements
 * Extracts detailed system requirements for a specific floor plan section.
 */
export async function extractSectionRequirements(
  section: FloorPlanSection,
  projectContext?: FloorPlanProjectContext,
  analysisOptions?: SectionRequirementsOptions
): Promise<SectionRequirementsResponse> {
  const response = await apiClient.post<SectionRequirementsResponse>(
    '/api/floorplan/section/requirements',
    {
      section,
      projectContext,
      analysisOptions: {
        includeCatalogMatches: true,
        includeLaborEstimates: true,
        includeMaterialAlternates: true,
        includeCodeReferences: true,
        market: 'philippines',
        currency: 'PHP',
        ...analysisOptions,
      },
    },
    { timeoutMs: 120000 }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Section requirements extraction failed');
  }

  return response.data;
}
