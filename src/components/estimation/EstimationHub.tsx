import { useState, useEffect } from 'react';
import type { User, AIScanGroup, Project } from '../../App';
import TORComparisonView from '../ai-sidebar/TORComparisonView';

interface Props {
  user?: User;
  projects?: Project[];
  onCreateProject?: (project: Project, keepOnHome?: boolean) => void;
  onSelectProject?: (project: Project) => void;
  onSaveAIScan?: (scan: AIScanGroup) => void;
  onNavigateToCreate?: () => void;
  isDark?: boolean;
}

const ALL_TABS = [
  {
    key: 'manual',
    label: 'Manual Estimation',
    shortLabel: 'Manual',
    icon: (active: boolean) => (
      <svg className="w-4 h-4" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    color: '#2563EB',
    colorDark: '#60A5FA',
    bg: '#EFF6FF',
    bgDark: 'rgba(37,99,235,0.12)',
    description: 'Step-by-step wizard to build a detailed BOQ manually by entering room counts, system types, and project specs.',
  },
  {
    key: 'document',
    label: 'Document AI Reader',
    shortLabel: 'Doc Reader',
    icon: (active: boolean) => (
      <svg className="w-4 h-4" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
    ),
    color: '#059669',
    colorDark: '#34D399',
    bg: '#ECFDF5',
    bgDark: 'rgba(5,150,105,0.12)',
    description: 'Upload TOR, RFP, and Proposal documents. AI compares specifications, highlights missing requirements, and audits equipment quantities.',
  },
];

export default function EstimationHub({ user, onNavigateToCreate, onSaveAIScan, isDark }: Props) {
  const isAdmin = user?.role === 'ADMIN';
  const isTechnician = user?.role === 'TECHNICIAN';
  // Admins & Technicians see both tabs; other roles only see Doc Reader
  const availableTabs = (isAdmin || isTechnician)
    ? ALL_TABS
    : ALL_TABS.filter(t => t.key === 'document');

  const [activeTab, setActiveTab] = useState<'manual' | 'document'>(
    (isAdmin || isTechnician) ? 'manual' : 'document'
  );
  const [, setIsDocScanning] = useState(false);

  // Safeguard: non-admin/non-technician roles are restricted to 'document'
  useEffect(() => {
    if (!isAdmin && !isTechnician && activeTab !== 'document') {
      setActiveTab('document');
    }
  }, [isAdmin, isTechnician, activeTab]);

  const activeTabDef = availableTabs.find(t => t.key === activeTab) || availableTabs[0];
  const activeColor = isDark ? activeTabDef.colorDark : activeTabDef.color;
  const activeBg = isDark ? activeTabDef.bgDark : activeTabDef.bg;

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: isDark ? '#0B0F19' : '#ffffff' }}
    >
      {/* Header */}
      <div
        className="px-6 pt-5 pb-0 shrink-0 border-b"
        style={{ borderColor: isDark ? '#1E293B' : '#e2e8f0' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563EB)' }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-black" style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>Estimation Hub</h1>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isDark ? '#475569' : '#94A3B8' }}>
                  {isAdmin
                    ? '2 Methods · Manual Estimation · AI Document Reader'
                    : isTechnician
                    ? 'Manual Estimation · AI Document Reader'
                    : 'Document AI Reader & Specifications Auditor'}
                </p>
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
              borderColor: isDark ? '#1E293B' : '#e2e8f0',
              color: isDark ? '#64748B' : '#64748B',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            AI-Powered
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {availableTabs.map(tab => {
            const active = activeTab === tab.key;
            const tabColor = isDark ? tab.colorDark : tab.color;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer"
                style={active
                  ? { color: tabColor, borderColor: tabColor }
                  : { color: isDark ? '#475569' : '#94A3B8', borderColor: 'transparent' }
                }
              >
                <span style={{ color: active ? tabColor : (isDark ? '#334155' : '#CBD5E1') }}>{tab.icon(active)}</span>
                {tab.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab description strip */}
      <div
        className="px-6 py-2.5 shrink-0 flex items-center gap-2.5 border-b text-xs transition-all"
        style={{
          background: activeBg,
          borderColor: isDark ? '#1E293B' : '#f1f5f9',
        }}
      >
        <span style={{ color: activeColor }}>{activeTabDef.icon(true)}</span>
        <p className="font-medium" style={{ color: activeColor }}>{activeTabDef.description}</p>
        {(isAdmin || isTechnician) && activeTab === 'manual' && onNavigateToCreate && (
          <button
            onClick={onNavigateToCreate}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all shrink-0 cursor-pointer"
            style={{ background: isDark ? activeTabDef.color : activeTabDef.color }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Start Manual Estimation
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Manual tab — Admin & Technician */}
        {(isAdmin || isTechnician) && activeTab === 'manual' && (
          <div
            className="h-full overflow-y-auto px-6 py-8"
            style={{ background: isDark ? '#0B0F19' : '#ffffff' }}
          >
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Step cards */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { step: '1', title: 'Project Details', desc: 'Enter building type, location, floors, and assign technicians.' },
                  { step: '2', title: 'System Selection', desc: 'Choose which security systems to include in the estimation.' },
                  { step: '3', title: 'Generate BOQ', desc: 'Review and export the complete Bill of Quantities.' },
                ].map(s => (
                  <div
                    key={s.step}
                    className="rounded-2xl p-4 border"
                    style={{
                      background: isDark ? '#131B2E' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37,99,235,0.25)' : '#BFDBFE',
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center mb-3">{s.step}</div>
                    <p className="text-xs font-bold mb-1" style={{ color: isDark ? '#93C5FD' : '#1E3A8A' }}>{s.title}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: isDark ? '#60A5FA' : '#2563EB' }}>{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* When to use section */}
              <div
                className="rounded-2xl p-5 border"
                style={{
                  background: isDark ? '#131B2E' : '#F8FAFC',
                  borderColor: isDark ? '#1E293B' : '#E2E8F0',
                }}
              >
                <h3
                  className="text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: isDark ? '#94A3B8' : '#475569' }}
                >
                  When to use Manual Estimation
                </h3>
                <ul className="space-y-1.5">
                  {[
                    'You have a site survey report with room-by-room breakdowns',
                    'Client has provided verbal requirements without floor plans',
                    'You need full control over quantities and specifications',
                    'Verifying or adjusting AI-generated estimates',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]" style={{ color: isDark ? '#64748B' : '#475569' }}>
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: isDark ? '#60A5FA' : '#3B82F6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {onNavigateToCreate && (
                <button
                  onClick={onNavigateToCreate}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}
                >
                  <svg className="w-4 h-4 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Start Manual Estimation Wizard
                </button>
              )}
            </div>
          </div>
        )}

        {/* Document AI tab - Visible to Accounting, Procurement, and Admin */}
        {activeTab === 'document' && (
          <div className="h-full overflow-hidden">
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
