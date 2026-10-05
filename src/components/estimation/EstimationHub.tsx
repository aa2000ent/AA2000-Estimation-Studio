import React, { useState, useEffect } from 'react';
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
  const isAdmin = user?.role === 'ADMIN';
  const isTechnician = user?.role === 'TECHNICIAN';

  const [activeTab, setActiveTab] = useState<'manual' | 'document'>(
    (isAdmin || isTechnician) ? 'manual' : 'document'
  );
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'Newest' | 'Oldest'>('Newest');
  const [, setIsDocScanning] = useState(false);

  useEffect(() => {
    if (!isAdmin && !isTechnician && activeTab !== 'document') {
      setActiveTab('document');
    }
  }, [isAdmin, isTechnician, activeTab]);

  return (
    <div className="flex flex-col h-full min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* Estimation Hub Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563EB)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Estimation Hub</h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
              {isAdmin
                ? '2 Methods · Manual Estimation · AI Document Reader'
                : isTechnician
                ? 'Manual Estimation · AI Document Reader'
                : 'Document AI Reader & Specifications Auditor'}
            </p>
          </div>
        </div>

        {/* AI-Powered Badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border shrink-0"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: isDark ? '#1E293B' : '#e2e8f0',
            color: isDark ? '#64748B' : '#64748B',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          <span>AI-Powered</span>
        </div>
      </div>

      {/* Top Header Pill Container */}
      <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tab Pills */}
        <div className="flex items-center gap-2">
          {(isAdmin || isTechnician) && (
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <span>Manual</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('document')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'document'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span>Doc Reader</span>
          </button>
        </div>

        {/* Separator + Start Manual Estimation Wizard Action Button */}
        {(isAdmin || isTechnician) && onNavigateToCreate && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={onNavigateToCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all cursor-pointer shadow-2xs"
            >
              <span className="text-sm font-black">+</span>
              <span>Start Manual Estimation Wizard</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
        {activeTab === 'manual' ? (
          <div className="space-y-8">
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  MANUAL ESTIMATION
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Create and manage your BOQ manually.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 transition-all w-48 sm:w-56"
                  />
                </div>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as 'Newest' | 'Oldest')}
                  className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="Newest">Newest</option>
                  <option value="Oldest">Oldest</option>
                </select>
              </div>
            </div>

            {/* 3-Step Overview Cards */}
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
  );
}
