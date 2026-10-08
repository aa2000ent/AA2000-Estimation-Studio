import React, { useState } from 'react';
import {
  extractSectionRequirements,
  type FloorPlanAnalyzeResult,
  type FloorPlanSection,
  type SectionRequirementsResult,
} from '../../services/api/estimationFlow';
import type { SystemType } from './CreateSurveyForm';
import { SectionRequirementsPanel } from './EstimationAiPanels';
import SaveEstimationModal from './SaveEstimationModal';
import type {
  EstimationFlowAiContext,
  SaveEstimationFn,
} from '../../services/estimationWizardSnapshot';

interface PlanSection {
  id: string;
  name: string;
  category: string;
  area?: number;
  unit?: string;
  confidence?: number;
  selected: boolean;
  /** Original section payload from /api/floorplan/analyze (API #2 input). */
  raw?: FloorPlanSection;
}

interface ItemSuggestion {
  id: string;
  item: string;
  area: string;
  quantity: number;
}

interface Props {
  onBackToDocument?: () => void;
  onViewEstimate?: () => void;
  onCreateAnother?: () => void;
  isDark?: boolean;
  /** Result of POST /api/floorplan/analyze — extracted sections drive the UI. */
  result?: FloorPlanAnalyzeResult | null;
  /** Persists the floor-plan analysis to the database (wizard form in a modal). */
  onSaveEstimation?: SaveEstimationFn;
  /** Systems picked before the analysis — prefills the save form. */
  initialSystemTypes?: SystemType[];
}

function buildSections(
  result: FloorPlanAnalyzeResult | null | undefined
): PlanSection[] {
  if (!result?.pages || result.pages.length === 0) {
    return [];
  }

  const sections: PlanSection[] = [];
  result.pages.forEach(page => {
    const groups: [string, typeof page.sections][] = [
      ['Rooms / Sections', page.sections],
      ['Corridors', page.corridors],
      ['Vertical Circulation', page.verticalCirculation],
      ['Utility Areas', page.utilityAreas],
    ];
    groups.forEach(([category, items]) => {
      (items || []).forEach(item => {
        sections.push({
          id: item.sectionId,
          name: item.label || item.sectionId,
          category,
          area: item.area,
          unit: item.unit,
          confidence:
            item.confidence !== undefined
              ? item.confidence <= 1
                ? Math.round(item.confidence * 100)
                : Math.round(item.confidence)
              : undefined,
          selected: false,
          raw: item,
        });
      });
    });
  });
  return sections;
}

const SAMPLE_SECTIONS: PlanSection[] = [
  { id: 'lobby', name: 'Lobby', category: 'Rooms / Sections', selected: false },
  { id: 'office', name: 'Office', category: 'Rooms / Sections', selected: false },
  { id: 'meeting', name: 'Meeting Room', category: 'Rooms / Sections', selected: false },
  { id: 'storage', name: 'Storage', category: 'Rooms / Sections', selected: false },
];

export default function FloorPlanSelectionSectionView({
  onBackToDocument,
  onViewEstimate,
  onCreateAnother,
  isDark = false,
  result = null,
  onSaveEstimation,
  initialSystemTypes,
}: Props) {
  // Wizard steps: 2 = Select areas, 3 = Review, 4 = Summary, 5 = Saved
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);

  // Step 2 State — real sections extracted by /api/floorplan/analyze
  const [sections, setSections] = useState<PlanSection[]>(() =>
    result?.pages && result.pages.length > 0
      ? buildSections(result)
      : SAMPLE_SECTIONS.map(s => ({ ...s }))
  );

  // Step 3 State
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([
    { id: 's1', item: 'CCTV camera', area: 'Office', quantity: 2 },
    { id: 's2', item: 'CCTV camera', area: 'Meeting Room', quantity: 2 },
  ]);

  // API #2 — POST /service/estimation/ai/section/requirements
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqResult, setReqResult] = useState<SectionRequirementsResult | null>(null);
  const [analyzedSectionId, setAnalyzedSectionId] = useState<string | null>(null);

  // Save-to-database (wizard client details + system selection, in a modal)
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dbSaved, setDbSaved] = useState(false);
  const [dbSaveMessage, setDbSaveMessage] = useState('');

  // Single-select: only one section may be analyzed at a time.
  const toggleSection = (id: string) => {
    if (reqLoading) return;
    setSections(prev =>
      prev.map(s => ({ ...s, selected: s.id === id ? !s.selected : false }))
    );
    setReqError('');
  };

  const selectedSections = sections.filter(s => s.selected);
  const selectedCount = selectedSections.length;
  const isSample = !result;

  const handleAnalyzeSections = async () => {
    const section = selectedSections[0];
    if (!section || selectedCount !== 1 || reqLoading) return;

    // Already analyzed this section — reopen the results without a new call.
    if (reqResult && analyzedSectionId === section.id) {
      setStep(3);
      return;
    }

    setReqLoading(true);
    setReqError('');
    try {
      const requirements = await extractSectionRequirements({
        section: section.raw ?? {
          sectionId: section.id,
          type: 'room',
          label: section.name,
          area: section.area,
          unit: section.unit,
        },
        analysisOptions: {
          includeCatalogMatches: true,
          includeLaborEstimates: true,
          includeMaterialAlternates: true,
          includeCodeReferences: true,
          market: 'philippines',
          currency: 'PHP',
        },
      });
      setReqResult(requirements);
      setAnalyzedSectionId(section.id);

      // Seed the review table from the identified materials.
      const seeded: ItemSuggestion[] = (requirements.materials || []).map((m, i) => ({
        id: `m-${i}`,
        item: m.name || m.description || 'Material',
        area: section.name,
        quantity: m.quantity ?? 1,
      }));
      setSuggestions(
        seeded.length > 0
          ? seeded
          : [{ id: 's1', item: 'CCTV camera', area: section.name, quantity: 2 }]
      );

      setStep(3);
    } catch (err) {
      setReqError(
        err instanceof Error ? err.message : 'Section requirements extraction failed.'
      );
    } finally {
      setReqLoading(false);
    }
  };

  const totalQuantity = suggestions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

  // Section that produced the current requirements result (step 3+)
  const analyzedSection = sections.find(s => s.id === analyzedSectionId);
  const analyzedLabel =
    reqResult?.sectionLabel || analyzedSection?.name || selectedSections[0]?.name || 'Selected section';
  const analyzedArea = reqResult?.area ?? analyzedSection?.area;
  const analyzedUnit = reqResult?.unit || analyzedSection?.unit || 'sqm';
  const analyzedMeta = [
    reqResult?.sectionType || analyzedSection?.category,
    analyzedArea !== undefined ? `${Math.round(analyzedArea * 10) / 10} ${analyzedUnit}` : undefined,
    reqResult?.confidenceScore !== undefined
      ? `${Math.round(reqResult.confidenceScore)}% confidence`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  // What gets persisted: API #1 (+ API #2 rows when a section was analyzed).
  const dbFileName = result?.fileInfo?.fileName;
  const dbAiContext: EstimationFlowAiContext = {
    mode: 'ai',
    floorPlan: result ?? null,
    selectedSection: analyzedSection?.raw ?? null,
    sectionRequirements: reqResult,
    estimation: null,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ── STEP 2: SELECT FLOOR-PLAN SECTIONS ── */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Select floor-plan sections
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {isSample
                ? 'Sample layout — upload a floor plan to extract real sections. Select one section to analyze.'
                : 'Sections extracted via /api/floorplan/analyze. Select one section — requirements are extracted for it via /service/estimation/ai/section/requirements.'}
            </p>
          </div>

          {/* Analysis Summary (real API result) */}
          {result && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Confidence</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {result.confidenceScore !== undefined ? `${Math.round(result.confidenceScore)}%` : '—'}
                </p>
              </div>
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sections</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{sections.length}</p>
              </div>
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Rooms / Corridors</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {result.summary?.totalRooms ?? '—'} / {result.summary?.totalCorridors ?? '—'}
                </p>
              </div>
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Area</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {result.summary?.totalArea !== undefined
                    ? `${Math.round(result.summary.totalArea * 10) / 10} ${result.summary.unit || 'sqm'}`
                    : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              2. Select areas
            </span>
            <span>3. Review</span>
            <span>4. Summary</span>
          </div>

          {/* 2-Column Layout: Blueprint Box Left, Checkbox List Right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blueprint Diagram Box */}
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {result?.fileInfo?.fileName || 'Office-floor-plan.pdf'}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isSample
                    ? 'Ground floor • Sample extracted layout'
                    : `${result?.fileInfo?.pages || result?.pages?.length || 1} page(s) • ${sections.length} sections extracted`}
                </p>
              </div>

              {/* Blueprint Frame with extracted section boxes */}
              <div className="border-4 border-slate-400 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-6 select-none my-2 max-h-[420px] overflow-y-auto">
                {sections.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center py-8">
                    No sections were detected in this floor plan.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {sections.map(section => (
                      <div
                        key={section.id}
                        onClick={() => toggleSection(section.id)}
                        className={`min-h-20 sm:min-h-24 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all duration-200 ${
                          section.selected
                            ? 'bg-blue-100 dark:bg-blue-950/80 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                            : 'bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {section.selected && (
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">✓</span>
                        )}
                        <span className="text-xs font-bold leading-tight break-words">{section.name}</span>
                        {(section.area !== undefined || section.confidence !== undefined) && (
                          <span className="text-[10px] font-semibold opacity-70 mt-0.5">
                            {section.area !== undefined
                              ? `${Math.round(section.area * 10) / 10} ${section.unit || 'sqm'}`
                              : ''}
                            {section.area !== undefined && section.confidence !== undefined ? ' • ' : ''}
                            {section.confidence !== undefined ? `${section.confidence}%` : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Detected Sections Checkbox List Right */}
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
                  Detected sections
                </h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-6">
                  {selectedCount} of {sections.length} selected — one at a time
                </p>

                {/* Radio Items (single selection) */}
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {sections.map(section => (
                    <label
                      key={section.id}
                      onClick={() => toggleSection(section.id)}
                      className="flex items-start gap-3 cursor-pointer select-none group"
                    >
                      <input
                        type="radio"
                        name="floorplan-section"
                        checked={section.selected}
                        onChange={() => {}}
                        disabled={reqLoading}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`text-sm font-bold transition-colors block ${
                            section.selected
                              ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                              : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                          }`}
                        >
                          {section.name}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {section.category}
                          {section.area !== undefined
                            ? ` · ${Math.round(section.area * 10) / 10} ${section.unit || 'sqm'}`
                            : ''}
                          {section.confidence !== undefined ? ` · ${section.confidence}%` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                  {sections.length === 0 && (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      No sections detected. Try another floor plan.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
                Select one section on the plan or in this list — only one can be analyzed at a time.
              </p>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => onBackToDocument && onBackToDocument()}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back to Document
            </button>

            <button
              type="button"
              onClick={handleAnalyzeSections}
              disabled={selectedCount !== 1 || reqLoading}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
                selectedCount === 1 && !reqLoading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              {reqLoading ? 'Extracting Requirements…' : 'Analyze Section'}
            </button>
          </div>

          {/* Section requirements progress (API #2) */}
          {reqLoading && (
            <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/90 via-blue-50/40 to-indigo-50/30 p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Extracting Section Requirements
                      <span className="ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 uppercase tracking-wider">
                        Neural Engine
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Identifying systems, materials, manpower &amp; compliance rules for “
                      {selectedSections[0]?.name}”…
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-blue-700 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
                  POST /service/estimation/ai/section/requirements
                </span>
              </div>
            </div>
          )}

          {/* Requirements extraction error */}
          {reqError && !reqLoading && (
            <div className="p-3.5 px-4 bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 font-semibold leading-relaxed flex items-start justify-between gap-3">
              <span>{reqError}</span>
              <button
                type="button"
                onClick={handleAnalyzeSections}
                className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: SECTION REQUIREMENTS (API #2) ── */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Section requirements
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Identified for “{analyzedLabel}” via /service/estimation/ai/section/requirements.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span>2. Select areas</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              3. Review
            </span>
            <span>4. Summary</span>
          </div>

          {/* Analyzed section context */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
            <p className="font-black text-slate-900 dark:text-white">{analyzedLabel}</p>
            {analyzedMeta && (
              <p className="font-semibold mt-0.5 text-slate-500 dark:text-slate-400">{analyzedMeta}</p>
            )}
          </div>

          {/* Notice Banner */}
          <div className="p-3.5 px-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Requirements below were identified by the AI for this section. Review them, then
            continue to the summary.
          </div>

          {/* Identified requirements (API #2 result) */}
          {reqResult ? (
            <SectionRequirementsPanel result={reqResult} isDark={isDark} />
          ) : (
            <div className="p-3.5 px-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold">
              No requirements were returned for this section. Go back and run the analysis again.
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              Continue to Summary
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: ESTIMATE SUMMARY ── */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Estimate summary
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Review the scope before saving.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span>2. Select areas</span>
            <span>3. Review</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              4. Summary
            </span>
          </div>

          {/* Summary Card */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Office Security Installation
              </h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">
                Floor Plan • {result?.fileInfo?.fileName || 'Office-floor-plan.pdf'}
              </p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                Selected section: {analyzedLabel}
              </p>
            </div>

            {/* Items Breakdown Table */}
            <div className="border-t border-b border-slate-100 dark:border-slate-800 py-4 space-y-3">
              <div className="grid grid-cols-12 text-xs font-bold text-slate-400 dark:text-slate-500 pb-1">
                <span className="col-span-6">Item</span>
                <span className="col-span-4">Area</span>
                <span className="col-span-2 text-right">Qty</span>
              </div>
              {suggestions.map(s => (
                <div key={s.id} className="grid grid-cols-12 text-xs font-semibold text-slate-800 dark:text-slate-200 py-1 border-t border-slate-50 dark:border-slate-800/50">
                  <span className="col-span-6">{s.item}</span>
                  <span className="col-span-4 text-slate-500">{s.area}</span>
                  <span className="col-span-2 text-right font-bold">{s.quantity}</span>
                </div>
              ))}
            </div>

            {/* Pricing Pending Banner */}
            <div className="space-y-1">
              <h3 className="text-lg font-black text-blue-600 dark:text-blue-400">
                Pricing pending
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Use the approved AA2000 catalog to finalize prices.
              </p>
            </div>
          </div>

          {/* Saved-to-database confirmation */}
          {dbSaved && dbSaveMessage && (
            <div className="p-3.5 px-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
              {dbSaveMessage} The project is now pending validation in the Estimation workspace.
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back to Edit
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
              >
                Save Draft Estimate
              </button>

              {onSaveEstimation && !dbSaved && (
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                >
                  Save to Database
                </button>
              )}

              {dbSaved && (
                <span className="px-5 py-2.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                  ✓ Saved to Database
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: ESTIMATE SAVED (COMPLETION) ── */}
      {step === 5 && (
        <div className="space-y-6 animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Estimate saved
            </h1>
          </div>

          {/* Completion Card */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xs space-y-6">
            <div className="text-emerald-500 text-4xl font-black">
              ✓
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Your draft estimate is ready
              </h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                Office Security Installation
              </p>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                {suggestions.length} item types • {totalQuantity} total units • Pricing pending
              </p>
            </div>

            <div>
              <span className="px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                DRAFT SAVED — PREVIEW
              </span>
            </div>

            {/* Saved-to-database confirmation */}
            {dbSaved && dbSaveMessage && (
              <div className="p-3.5 px-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
                {dbSaveMessage} The project is now pending validation in the Estimation workspace.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              {onSaveEstimation && !dbSaved && (
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                >
                  Save to Database
                </button>
              )}

              {dbSaved && (
                <span className="px-5 py-2.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                  ✓ Saved to Database
                </span>
              )}

              <button
                type="button"
                onClick={() => onViewEstimate && onViewEstimate()}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
              >
                View Estimate
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onCreateAnother) onCreateAnother();
                  setStep(2);
                }}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
              >
                Create Another Estimate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save dialog (wizard client details + system selection) */}
      {onSaveEstimation && (
        <SaveEstimationModal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={onSaveEstimation}
          ai={dbAiContext}
          fileName={dbFileName}
          initialSystemTypes={initialSystemTypes}
          onSaved={res => {
            setDbSaved(true);
            setDbSaveMessage(
              res.projId ? `Saved to the database (Project #${res.projId}).` : 'Saved to the database.'
            );
          }}
        />
      )}
    </div>
  );
}
