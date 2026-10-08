// Maps the Create Estimation wizard (Manual / AI-Assisted flows) onto the
// estimationSnapshot schema accepted by POST /service/estimation/post/save/estimation.
// The snapshot whitelist lives in the backend (ESTIMATION/estimationSnapshot.js):
// only fields declared there may be written, or the save is rejected with 400.
import type {
  EstimationAnalyzeResult,
  FloorPlanAnalyzeResult,
  FloorPlanSection,
  SectionRequirementsResult,
} from './api/estimationFlow';
import type { SurveyFormData } from '../components/estimation/CreateSurveyForm';
import type {
  EstimationManpowerEntry,
  EstimationConsumableEntry,
  EstimationAdditionalFeeEntry,
} from '../types';

/** AI output collected by the wizard, handed to the save path alongside the form data. */
export interface EstimationFlowAiContext {
  mode: 'manual' | 'ai';
  /**
   * API #3 (Estimation Analysis) result — the project-wide BOQ. Present for the
   * manual flow when the user chose "Yes — use AI analysis", and for the
   * AI-assisted flow when the chained analysis ran (auto after #2, or on demand).
   * When present it wins over the section-level rows for manpower/materials/fees.
   */
  estimation?: EstimationAnalyzeResult | null;
  /** AI-Assisted flow — API #1 result. */
  floorPlan?: FloorPlanAnalyzeResult | null;
  selectedSection?: FloorPlanSection | null;
  /** AI-Assisted flow — API #2 result (fallback rows when #3 never ran). */
  sectionRequirements?: SectionRequirementsResult | null;
}

/**
 * Save callback shared by the Create Estimation wizard and the AI Estimation
 * "Save to Database" form: takes the collected client details + system
 * selection together with the AI context and persists the estimation.
 */
export type SaveEstimationFn = (
  data: SurveyFormData,
  ai: EstimationFlowAiContext
) => Promise<{ success: boolean; message?: string; projId?: number }>;

/** Local cache shape written to aa2000_estimation_<id> and reloaded by the Cost Estimation screen. */
export interface WizardEstimationCache {
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks: {
    id: string;
    itemNumber: number;
    description: string;
    unit: string;
    totalPrice: number;
  }[];
  constraints: { physical: string; electrical: string; installation: string };
  priceTier: string;
  aiBaseline: Record<string, unknown> | null;
  technicianNotes: string;
  discrepancyJustifications: null;
  updatedAt: string;
}

const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `wiz-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const hasValue = (v: string | number | undefined) =>
  v !== undefined && v !== null && String(v).trim() !== '';

const FEE_TYPES: EstimationAdditionalFeeEntry['type'][] = [
  'Travel Fee',
  'Congestion Fee',
  'Short Notice Fee',
  'Overtime Fee',
  'Weekend Fee',
  'Holiday Fee',
  'Permit Fee',
  'Other',
];

/** Tolerates unknown fee types from the model (coerced onto the form union). */
function coerceFeeType(type?: string): EstimationAdditionalFeeEntry['type'] {
  const match = FEE_TYPES.find(
    t => t.toLowerCase() === String(type || '').trim().toLowerCase()
  );
  return match ?? 'Other';
}

/** API #3 manpower -> Cost Estimation manpower rows (form shape end to end). */
function mapAnalysisManpower(est?: EstimationAnalyzeResult | null): EstimationManpowerEntry[] {
  return (est?.manpower ?? []).map(entry => {
    const headcount = Math.max(1, num(entry.headcount) || 1);
    const manDays = Math.max(1, num(entry.manDays) || 1);
    // hours = hours per person over the job; fall back to man-days x 8 / crew.
    const hours = num(entry.hours) || Math.ceil((manDays * 8) / headcount);
    return {
      id: uid(),
      role: entry.role || 'Technician',
      headcount,
      hours,
      manDays,
      dayRate: num(entry.dayRate),
      totalCost: num(entry.totalCost),
    };
  });
}

/** API #3 materials -> Cost Estimation consumable rows (one row per item, tiers kept). */
function mapAnalysisConsumables(est?: EstimationAnalyzeResult | null): EstimationConsumableEntry[] {
  const rows: EstimationConsumableEntry[] = [];
  (est?.materials ?? []).forEach(category => {
    (category.items ?? []).forEach(item => {
      const srp = num(item.srp) || num(item.unitPrice);
      rows.push({
        id: uid(),
        name: item.description || item.model || category.category || 'Material',
        brand: item.brand || undefined,
        category: category.category || 'Materials',
        quantity: Math.max(1, num(item.quantity) || 1),
        unit: item.unit || 'unit',
        srp: srp || undefined,
        contractorPrice: num(item.contractorPrice) || undefined,
        dealerPrice: num(item.dealerPrice) || undefined,
        unitPrice: num(item.unitPrice) || srp,
        totalPrice: num(item.totalPrice),
        productId: item.catalog?.prod_Code || undefined,
      });
    });
  });
  return rows;
}

/** API #3 fees -> the Cost Estimation additional fees table. */
function mapAnalysisFees(est?: EstimationAnalyzeResult | null): EstimationAdditionalFeeEntry[] {
  return (est?.fees ?? [])
    .map(fee => ({
      id: uid(),
      type: coerceFeeType(fee.type),
      amount: num(fee.amount),
      description: fee.description || '',
    }))
    .filter(fee => fee.amount !== 0 || fee.description);
}

/** API #2 manpower rows -> Cost Estimation rows (falls back to the crew mix). */
function mapSectionManpower(req?: SectionRequirementsResult | null): EstimationManpowerEntry[] {
  const rows = req?.manpower ?? [];
  if (rows.length) {
    return rows.map(entry => {
      const headcount = Math.max(1, num(entry.headcount) || 1);
      const manDays = Math.max(1, num(entry.manDays) || 1);
      const hours = num(entry.hours) || Math.ceil((manDays * 8) / headcount);
      return {
        id: uid(),
        role: entry.role || 'Technician',
        headcount,
        hours,
        manDays,
        dayRate: num(entry.dayRate),
        totalCost: num(entry.totalCost),
      };
    });
  }

  const crew = Object.entries(req?.laborEstimates?.crewMix ?? {});
  const totalHours = num(req?.laborEstimates?.totalHours);
  const crewTotal = crew.reduce((sum, [, count]) => sum + num(count), 0) || 1;

  return crew
    .filter(([, count]) => num(count) > 0)
    .map(([role, count]) => {
      const hours = totalHours ? Math.round((totalHours * num(count)) / crewTotal) : 0;
      return {
        id: uid(),
        role,
        headcount: Math.max(1, num(count) || 1),
        hours,
        manDays: hours ? Math.max(1, Math.round(hours / 8)) : 0,
        dayRate: 0,
        totalCost: 0,
      };
    });
}

/** API #2 itemized materials -> consumable rows (falls back to category rollups). */
function mapSectionConsumables(req?: SectionRequirementsResult | null): EstimationConsumableEntry[] {
  const items = req?.materials ?? [];
  if (items.length) {
    return items.map(item => {
      const srp = num(item.srp) || num(item.unitPrice);
      return {
        id: uid(),
        name: item.name || item.description || 'Material',
        brand: item.brand || undefined,
        category: item.category || 'Materials',
        quantity: Math.max(1, num(item.quantity) || 1),
        unit: item.unit || 'unit',
        srp: srp || undefined,
        contractorPrice: num(item.contractorPrice) || undefined,
        dealerPrice: num(item.dealerPrice) || undefined,
        unitPrice: num(item.unitPrice) || srp,
        totalPrice: num(item.totalPrice),
        productId: item.catalog?.prod_Code || undefined,
      };
    });
  }

  return (req?.materialSummary?.categories ?? [])
    .filter(category => category.category)
    .map(category => ({
      id: uid(),
      name: String(category.category),
      category: 'Materials',
      quantity: Math.max(1, num(category.itemCount) || 1),
      unit: 'lot',
      unitPrice: 0,
      totalPrice: num(category.estimatedCost),
    }));
}

/**
 * Readable site/system summary rows. These carry the project's building and
 * project-specific information into the snapshot (the whitelist has no dedicated
 * site-info field), so the DB row stays self-describing without the legacy survey wizard.
 */
function buildScopeRows(data: SurveyFormData, ai?: EstimationFlowAiContext) {
  const rows: WizardEstimationCache['scopeOfWorks'] = [];
  const push = (description: string) =>
    rows.push({
      id: uid(),
      itemNumber: rows.length + 1,
      description,
      unit: '1 LOT',
      totalPrice: 0,
    });

  const site: string[] = [];
  if (data.buildingType) site.push(data.buildingType);
  if (hasValue(data.floors)) site.push(`${data.floors} floor(s)`);
  if (hasValue(data.buildingLength) && hasValue(data.buildingWidth)) {
    site.push(`${data.buildingLength}m × ${data.buildingWidth}m`);
  }
  if (hasValue(data.floorHeight)) site.push(`${data.floorHeight}m floor height`);
  if (site.length) push(`Site: ${site.join(' · ')}`);

  if (data.systemTypes?.length) push(`Systems: ${data.systemTypes.join(', ')}`);
  if (data.surveyScope?.trim()) push(`Scope: ${data.surveyScope.trim()}`);

  // AI results, applied as editable rows on the Cost Estimation page.
  if (ai?.floorPlan) {
    const summary = ai.floorPlan.summary;
    const parts: string[] = [];
    if (summary?.totalRooms != null) parts.push(`${summary.totalRooms} rooms`);
    if (summary?.totalCorridors != null) parts.push(`${summary.totalCorridors} corridors`);
    if (summary?.totalArea != null) parts.push(`${num(summary.totalArea)} ${summary.unit || 'sqm'}`);
    if (ai.floorPlan.confidenceScore != null) parts.push(`${ai.floorPlan.confidenceScore}% confidence`);
    if (parts.length) push(`Floor plan: ${parts.join(' · ')}`);
  }

  if (ai?.sectionRequirements) {
    const requirement = ai.sectionRequirements;
    const categories = requirement.materialSummary?.categories?.length ?? 0;
    const crewRoles = Object.keys(requirement.laborEstimates?.crewMix ?? {}).length;
    push(
      `Requirements applied: ${requirement.sectionLabel || requirement.sectionId || 'selected section'} · ` +
        `${categories} material categories · ${crewRoles} crew roles`
    );
  }

  if (ai?.estimation) {
    const analysis = ai.estimation;
    const materialItems = (analysis.materials ?? []).reduce(
      (sum, category) => sum + (category.items?.length ?? 0),
      0
    );
    push(
      `AI analysis applied: ${analysis.manpower?.length ?? 0} manpower roles · ` +
        `${materialItems} material items` +
        (analysis.confidenceScore != null ? ` · ${analysis.confidenceScore}% confidence` : '')
    );
  }

  // Work items the AI extracted — form-shaped rows the user can edit directly.
  // Project-wide scope from #3 wins; the section scope (#2) is the fallback
  // when the chained estimation analysis never ran (mixing both would risk
  // double-counting overlapping work items).
  const aiScope =
    ai?.estimation?.scopeOfWorks ??
    (ai?.mode === 'ai' ? ai.sectionRequirements?.scopeOfWorks : undefined);
  (aiScope ?? []).forEach(item => {
    if (!item.description) return;
    rows.push({
      id: uid(),
      itemNumber: rows.length + 1,
      description: item.description,
      unit: item.unit || '1 LOT',
      totalPrice: num(item.totalPrice),
    });
  });

  return rows;
}

/** Builds everything the save path needs: mapped tables + the raw AI context. */
export function buildWizardEstimationCache(
  data: SurveyFormData,
  ai?: EstimationFlowAiContext
): WizardEstimationCache {
  const now = new Date().toISOString();

  const isManual = ai?.mode !== 'ai';
  // API #3 (project-wide) drives the rows whenever it ran — both flows. The
  // AI-assisted flow falls back to the section-level #2 rows when #3 was
  // skipped; the manual flow without AI has no rows at all.
  const estimation = ai?.estimation ?? null;
  const section = isManual ? null : (ai?.sectionRequirements ?? null);
  const manpower = estimation
    ? mapAnalysisManpower(estimation)
    : section
      ? mapSectionManpower(section)
      : [];
  const consumables = estimation
    ? mapAnalysisConsumables(estimation)
    : section
      ? mapSectionConsumables(section)
      : [];
  // #2 has no fees (section-level fees make no sense); #3 carries the form's fee rows.
  const fees = estimation ? mapAnalysisFees(estimation) : [];

  const responseConstraints = estimation?.constraints ?? section?.constraints ?? null;
  const constraints = {
    physical: responseConstraints?.physical || '',
    electrical: responseConstraints?.electrical || '',
    installation: responseConstraints?.installation || '',
  };

  const hasAi = Boolean(ai && (ai.estimation || ai.floorPlan || ai.sectionRequirements));
  const confidenceScore =
    estimation?.confidenceScore ?? section?.confidenceScore ?? ai?.floorPlan?.confidenceScore ?? null;
  const generatedAt =
    (estimation?.analyzedAt ?? section?.analyzedAt ?? ai?.floorPlan?.analyzedAt) || now;

  const sectionRecommendations = section?.recommendations ?? [];
  const aiNotes: string[] = [];
  if (estimation?.assumptions?.length) {
    aiNotes.push(`AI assumptions:\n${estimation.assumptions.map(item => `• ${item}`).join('\n')}`);
  }
  if (sectionRecommendations.length) {
    aiNotes.push(
      `AI recommendations:\n${sectionRecommendations
        .map(item =>
          `• ${[item.priority, item.system].filter(Boolean).join(' · ')}${item.action ? ` — ${item.action}` : ''}`
        )
        .join('\n')}`
    );
  }
  const technicianNotes = aiNotes.join('\n\n');

  return {
    manpower,
    consumables,
    fees,
    scopeOfWorks: buildScopeRows(data, ai),
    constraints,
    priceTier: 'srp',
    // The AI Baseline card in the Cost Estimation screen reads manpower/consumables
    // from here; `wizard` keeps the raw API responses plus structured site info.
    aiBaseline: hasAi
      ? {
          manpower,
          consumables,
          fees,
          constraints,
          confidenceScore,
          generatedAt,
          wizard: {
            mode: ai!.mode,
            siteInfo: {
              companyName: data.companyName,
              projectName: data.projectName,
              clientName: data.clientName,
              locationName: data.locationName,
              buildingType: data.buildingType,
              floors: hasValue(data.floors) ? Number(data.floors) : null,
              buildingLength: hasValue(data.buildingLength) ? Number(data.buildingLength) : null,
              buildingWidth: hasValue(data.buildingWidth) ? Number(data.buildingWidth) : null,
              floorHeight: hasValue(data.floorHeight) ? Number(data.floorHeight) : null,
              latitude: Number(data.latitude) || null,
              longitude: Number(data.longitude) || null,
              startDate: data.startDate,
              surveyScope: data.surveyScope,
              systemTypes: data.systemTypes,
            },
            estimation: ai!.estimation ?? null,
            floorPlan: ai!.floorPlan ?? null,
            selectedSection: ai!.selectedSection ?? null,
            sectionRequirements: ai!.sectionRequirements ?? null,
          },
        }
      : null,
    technicianNotes,
    discrepancyJustifications: null,
    updatedAt: now,
  };
}

export const wizardEstimationCacheKey = (projectId: string) => `aa2000_estimation_${projectId}`;

/** Writes the local Cost Estimation cache (offline fallback / immediate reload). */
export function cacheWizardEstimation(projectId: string, cache: WizardEstimationCache): void {
  try {
    localStorage.setItem(wizardEstimationCacheKey(projectId), JSON.stringify(cache));
  } catch {
    /* storage full or unavailable: the DB copy is the source of truth anyway */
  }
}
