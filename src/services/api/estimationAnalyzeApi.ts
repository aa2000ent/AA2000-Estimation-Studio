import { apiClient } from './index';

export interface SiteInfoPayload {
  buildingType?: string;
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

export interface ClientContextPayload {
  companyName?: string;
  projectName?: string;
  clientName?: string;
  clientEmail?: string;
  clientContactNumber?: string;
  budgetTier?: string;
  prioritySystems?: string[];
  existingInfrastructure?: boolean;
  existingDetails?: string;
}

export interface EstimationAnalysisOptions {
  includeLaborBreakdown?: boolean;
  includeMaterialAlternates?: boolean;
  includePhaseSchedule?: boolean;
  confidenceThreshold?: number;
  currency?: string;
  market?: string;
}

export interface EstimationAnalysisResponse {
  success: boolean;
  requestId?: string;
  analyzedAt?: string;
  confidenceScore?: number;
  assumptions?: string[];
  summary?: {
    totalEstimatedCost: number;
    currency: string;
    breakdown?: {
      materials: number;
      labor: number;
      equipment: number;
      consumables: number;
      contingency: number;
    };
    timeline?: {
      totalDays: number;
      phases: Array<{ phase: string; days: number }>;
    };
  };
  manpower?: Array<{
    role: string;
    headcount: number;
    hoursPerDay: number;
    dayRate: number;
    totalDays: number;
    totalCost: number;
    responsibilities?: string;
  }>;
  labor?: Array<{
    activity: string;
    systemTypes: string[];
    crewComposition?: Record<string, number>;
    estimatedHours: number;
    unit?: string;
    ratePerHour: number;
    totalCost: number;
    details?: string;
  }>;
  materials?: Array<{
    category: string;
    items: Array<{
      description: string;
      model?: string;
      brand?: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
      source?: string;
    }>;
    subtotal: number;
  }>;
  equipment?: unknown[];
  alternates?: unknown[];
  phaseSchedule?: unknown[];
  risks?: unknown[];
  error?: string;
}

/**
 * POST /api/estimation/analyze
 * Analyzes detailed site information and service-specific configurations to recommend manpower, labor, materials, and costs.
 */
export async function analyzeEstimation(
  siteInfo: SiteInfoPayload,
  systems: Record<string, unknown>,
  clientContext?: ClientContextPayload,
  analysisOptions?: EstimationAnalysisOptions
): Promise<EstimationAnalysisResponse> {
  const response = await apiClient.post<EstimationAnalysisResponse>(
    '/api/estimation/analyze',
    {
      siteInfo,
      systems,
      clientContext,
      analysisOptions: {
        includeLaborBreakdown: true,
        includeMaterialAlternates: true,
        includePhaseSchedule: true,
        confidenceThreshold: 50,
        currency: 'PHP',
        market: 'philippines',
        ...analysisOptions,
      },
    },
    { timeoutMs: 120000 }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Estimation analysis failed');
  }

  return response.data;
}
