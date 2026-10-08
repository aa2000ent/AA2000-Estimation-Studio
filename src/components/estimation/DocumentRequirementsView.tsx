import React, { useState } from 'react';
import type { EstimationAnalyzeResult } from '../../services/api/estimationFlow';
import type { SaveEstimationFn } from '../../services/estimationWizardSnapshot';
import type { SystemType } from './CreateSurveyForm';
import { EstimationAnalysisResultPanel } from './EstimationAiPanels';
import SaveEstimationModal from './SaveEstimationModal';

interface Props {
  /** Result of POST /service/estimation/ai/analyze — extracted requirements drive the UI. */
  result: EstimationAnalyzeResult;
  fileName?: string;
  docType?: 'tor' | 'proposal';
  onBackToDocument?: () => void;
  onReanalyze?: () => void;
  /** Persists the estimation to the database; shown only when provided. */
  onSaveEstimation?: SaveEstimationFn;
  /** Systems picked before the analysis — prefills the save form. */
  initialSystemTypes?: SystemType[];
  isDark?: boolean;
}

/**
 * Same interface as the floorplan analysis module
 * (FloorPlanSelectionSectionView) — header, summary stats, stepper, context
 * card, notice banner, result panel, action footer — but the floor-plan
 * section-selection step is skipped: the document goes straight from
 * /service/estimation/ai/analyze to this review step.
 *
 * "Save to Database" opens SaveEstimationModal (the Manual Estimation
 * wizard's client-details + system-selection form) before persisting.
 */
export default function DocumentRequirementsView({
  result,
  fileName,
  docType = 'tor',
  onBackToDocument,
  onReanalyze,
  onSaveEstimation,
  initialSystemTypes,
  isDark = false,
}: Props) {
  const summary = result.summary;
  const materialLines = (result.materials || []).flatMap(c => c.items ?? []).length;
  const scopeItems = (result.scopeOfWorks || []).length;
  const conf = result.confidenceScore;

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const docLabel = docType === 'proposal' ? 'Technician proposal' : 'Terms of Reference';
  const contextMeta = [
    docLabel,
    scopeItems > 0 ? `${scopeItems} scope items` : undefined,
    materialLines > 0 ? `${materialLines} material lines` : undefined,
    conf !== undefined ? `${Math.round(conf)}% confidence` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const currency = summary?.currency || 'PHP';
  const totalEstimate =
    summary?.totalEstimatedCost !== undefined
      ? `${currency} ${summary.totalEstimatedCost.toLocaleString()}`
      : '—';
  const timeline =
    summary?.timeline?.totalDays !== undefined ? `${summary.timeline.totalDays} days` : '—';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ── REVIEW: EXTRACTED REQUIREMENTS (API #3) — section selection skipped ── */}
      <div className="space-y-6 animate-fade-in-up">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Extracted requirements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {fileName
              ? `Identified in “${fileName}” via /service/estimation/ai/analyze.`
              : 'Identified from the uploaded document via /service/estimation/ai/analyze.'}
          </p>
        </div>

        {/* Analysis Summary (real API result) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Confidence</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {conf !== undefined ? `${Math.round(conf)}%` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Estimate</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{totalEstimate}</p>
          </div>
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Timeline</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{timeline}</p>
          </div>
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Requirements</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{materialLines + scopeItems}</p>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {materialLines} material lines · {scopeItems} scope items
            </p>
          </div>
        </div>

        {/* Stepper Progress Bar — section selection skipped, straight to Review */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
          <span>1. Documents</span>
          <span>2. Analysis</span>
          <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
            3. Review
          </span>
          <span>4. Summary</span>
        </div>

        {/* Analyzed document context (same card as the floor-plan module's section context) */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          <p className="font-black text-slate-900 dark:text-white break-words">
            {fileName || `${docLabel} document`}
          </p>
          {contextMeta && (
            <p className="font-semibold mt-0.5 text-slate-500 dark:text-slate-400">{contextMeta}</p>
          )}
        </div>

        {/* Saved confirmation */}
        {saved && (
          <div className="p-3.5 px-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
            {saveMessage} The project is now pending validation in the Estimation workspace.
          </div>
        )}

        {/* Notice Banner */}
        <div className="p-3.5 px-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
          Requirements below were identified by the AI from this document. Review them, then go back
          to adjust the upload or run the analysis again.
        </div>

        {/* Extracted requirements (API #3 result) */}
        <EstimationAnalysisResultPanel result={result} isDark={isDark} />

        {/* Action Buttons Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={() => onBackToDocument && onBackToDocument()}
            className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
          >
            Back to Document
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onReanalyze && onReanalyze()}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Analyze Again
            </button>

            {onSaveEstimation && !saved && (
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Save to Database
              </button>
            )}

            {saved && (
              <span className="px-5 py-2.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                ✓ Saved to Database
              </span>
            )}
          </div>
        </div>

        {/* Save dialog (wizard form) */}
        {onSaveEstimation && (
          <SaveEstimationModal
            open={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            onSave={onSaveEstimation}
            ai={{ mode: 'ai', estimation: result }}
            fileName={fileName}
            initialSystemTypes={initialSystemTypes}
            onSaved={res => {
              setSaved(true);
              setSaveMessage(
                res.projId ? `Saved to the database (Project #${res.projId}).` : 'Saved to the database.'
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
