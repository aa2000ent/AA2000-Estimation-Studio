import React, { useState } from 'react';
import type { User, AIScanGroup, Project } from '../../App';
import TORComparisonView from '../ai-sidebar/TORComparisonView';

interface Props {
  user?: User;
  projects?: Project[];
  onCreateProject?: (project: Project, keepOnHome?: boolean) => void;
  onSelectProject?: (project: Project) => void;
  onSaveAIScan?: (scan: AIScanGroup) => Promise<void>;
  onNavigateToCreate?: () => void;
  isDark?: boolean;
}

export default function EstimationHub({ user, onNavigateToCreate, onSaveAIScan, isDark }: Props) {
  const [selectedMode, setSelectedMode] = useState<'manual' | 'ai' | null>(null);
  const [, setIsDocScanning] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Estimation Hub
            </h1>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              2 METHODS • MANUAL ESTIMATION • AI DOCUMENT READER
            </p>
          </div>
        </div>

        {/* AI-Powered Badge */}
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] text-slate-700 dark:text-slate-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>AI-Powered</span>
        </div>
      </div>

      {/* INITIAL SELECTION CARDS VIEW (No outer background card) */}
      {selectedMode === null ? (
        <div className="space-y-8 flex-1 flex flex-col justify-center py-4">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Select Estimation Method
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Choose how you would like to generate or build your project estimation and Bill of Quantities (BOQ).
            </p>
          </div>

          {/* 2 Hero Clickable Cards (Directly on page background) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
            {/* Manual Estimation Card */}
            <div
              onClick={() => setSelectedMode('manual')}
              className="group border-2 border-slate-200 dark:border-slate-800 hover:border-blue-600 dark:hover:border-blue-500 bg-white dark:bg-[#131B2E] hover:bg-blue-50/20 dark:hover:bg-blue-950/20 rounded-3xl p-8 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform">
                  📝
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Manual Estimation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-2">
                    Build a detailed Bill of Quantities (BOQ) step-by-step by entering project details, selecting security systems, and specifying room counts.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Step-by-step survey &amp; building wizard</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Full control over quantities &amp; specs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Custom labor rates &amp; man-hour calculator</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full py-3.5 bg-blue-600 group-hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer text-center"
              >
                Select Manual Estimation →
              </button>
            </div>

            {/* AI Estimation Card */}
            <div
              onClick={() => setSelectedMode('ai')}
              className="group border-2 border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-400 bg-white dark:bg-[#131B2E] hover:bg-amber-50/20 dark:hover:bg-amber-950/20 rounded-3xl p-8 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform">
                  ✨
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    AI Document Reader &amp; Analyzer
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-2">
                    Upload floor plan blueprints, Terms of Reference (TOR), or proposals. AI automatically extracts specifications, identifies rooms, and generates BOQs.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>Automated blueprint &amp; floor plan vision</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>TOR specification compliance audit</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>Instant Philippine catalog price matching</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full py-3.5 bg-amber-500 group-hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer text-center"
              >
                Select AI Estimation →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* MODE SELECTED VIEW */
        <div className="space-y-6 flex-1 flex flex-col">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 px-5 shadow-xs">
            <button
              onClick={() => setSelectedMode(null)}
              className="flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Choose Estimation Method</span>
            </button>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 uppercase tracking-wider">
              {selectedMode === 'manual' ? 'Manual Estimation Mode' : 'AI Document Reader Mode'}
            </span>
          </div>

          {/* Main Container */}
          <div className="flex-1 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            {selectedMode === 'manual' ? (
              <div className="space-y-8">
                {/* Controls Bar (With + Start Manual Estimation Wizard button on top right) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                      MANUAL ESTIMATION
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Create and manage your BOQ manually.
                    </p>
                  </div>

                  {/* Start Manual Estimation Wizard Button transferred here */}
                  {onNavigateToCreate && (
                    <button
                      onClick={onNavigateToCreate}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <span className="text-sm font-black">+</span>
                      <span>Start Manual Estimation Wizard</span>
                    </button>
                  )}
                </div>

                {/* 3-Step Overview Cards with generous spacing */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                  {/* Step 1 */}
                  <div className="border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 rounded-2xl p-5 flex items-start gap-4 hover:border-blue-400 transition-all">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                      1
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Project Details</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-relaxed font-medium">
                        Enter building type, location, floors, and assign technicians.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 rounded-2xl p-5 flex items-start gap-4 hover:border-blue-400 transition-all">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                      2
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">System Selection</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-relaxed font-medium">
                        Choose which security systems to include in the estimation.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 rounded-2xl p-5 flex items-start gap-4 hover:border-blue-400 transition-all">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                      3
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Generate BOQ</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-relaxed font-medium">
                        Review and export the complete Bill of Quantities.
                      </p>
                    </div>
                  </div>
                </div>

                {/* When to use manual estimation info box */}
                <div className="border border-blue-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl p-6 sm:p-7 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v.192c0 .484-.332.893-.81 1.012a12.036 12.036 0 01-2.88 0c-.478-.119-.81-.528-.81-1.012V18m5.25-10.875a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
                    </svg>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      WHEN TO USE MANUAL ESTIMATION
                    </h2>
                  </div>

                  <ul className="space-y-3 pl-1">
                    {[
                      'You have a site survey report with room-by-room breakdowns',
                      'Client has provided verbal requirements without floor plans',
                      'You need full control over quantities and specifications',
                      'Verifying or adjusting AI-generated estimates',
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 font-black shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              /* Document AI Reader View */
              <div className="h-full">
                <TORComparisonView
                  userRole={user?.role}
                  onSaveAIScan={onSaveAIScan}
                  onScanningChange={setIsDocScanning}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
