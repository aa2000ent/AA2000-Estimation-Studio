import React from 'react';
import type { User, Project, SurveyType } from '../../App';
import { StatCalendar, StatBolt, StatClipboard, Check } from '../../utils/Icons';
import { useToast } from '../utils/Toast';
import EditProjectModal from './EditProjectModal';

const SURVEY_TYPES: {
  key: SurveyType;
  label: string;
  desc: string;
  gradient: string;
  glow: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'CCTV',
    label: 'CCTV',
    desc: 'Camera surveillance systems',
    gradient: 'linear-gradient(135deg, #1E3A8A, #3B82F6)',
    glow: 'rgba(59,130,246,0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    key: 'FIRE_ALARM',
    label: 'Fire Alarm',
    desc: 'Detection & alarm systems',
    gradient: 'linear-gradient(135deg, #B91C1C, #EF4444)',
    glow: 'rgba(239,68,68,0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
  {
    key: 'FIRE_PROTECTION',
    label: 'Fire Protection',
    desc: 'Suppression & sprinkler systems',
    gradient: 'linear-gradient(135deg, #D97706, #F59E0B)',
    glow: 'rgba(245,158,11,0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    key: 'ACCESS_CONTROL',
    label: 'Access Control',
    desc: 'Door security & biometrics',
    gradient: 'linear-gradient(135deg, #047857, #10B981)',
    glow: 'rgba(16,185,129,0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    key: 'BURGLAR_ALARM',
    label: 'Burglar Alarm',
    desc: 'Perimeter intrusion detection',
    gradient: 'linear-gradient(135deg, #6D28D9, #8B5CF6)',
    glow: 'rgba(139,92,246,0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    key: 'OTHER',
    label: 'Other Systems',
    desc: 'Turnstiles, barriers & more',
    gradient: 'linear-gradient(135deg, #334155, #64748B)',
    glow: 'rgba(100,116,139,0.15)',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function StatusBadge({ status }: { status: string }) {
  const isSurvey = status === 'Pending' || status === 'In Progress' || status === 'Finalized - Rejected';
  const isReview = status === 'Finalized';
  const isApproved = status === 'Completed' || status === 'Finalized - Approved';

  const label = isReview ? 'Awaiting Approval' : isApproved ? 'Approved' : 'Survey In Progress';
  const cfg = isReview 
    ? { color: '#CA8A04', bg: 'rgba(202,138,4,0.08)', dot: '#EAB308' }
    : isApproved 
    ? { color: '#16A34A', bg: 'rgba(22,163,74,0.08)', dot: '#22C55E' }
    : { color: '#2563EB', bg: 'rgba(37,99,235,0.08)', dot: '#3B82F6' };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <span className="status-dot" style={{ background: cfg.dot }} />
      {label}
    </span>
  );
}

interface Props {
  user: User;
  project: Project;
  onBack: () => void;
  onStartSurvey: (type: SurveyType) => void;
  onViewEstimation: () => void;
  onViewSurveySummary: () => void;
  onUpdateStatus: (projectId: string, status: string) => void;
  onUpdateProject?: (project: Project) => void;
}

export default function ProjectDetail({ user, project, onBack, onStartSurvey, onViewEstimation, onViewSurveySummary, onUpdateStatus, onUpdateProject }: Props) {
  const { confirm } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const activeSurveyTypes = React.useMemo(() => {
    if (!project.systemTypes || project.systemTypes.length === 0) {
      return SURVEY_TYPES;
    }

    return SURVEY_TYPES.filter(st => {
      return project.systemTypes?.some(sys => {
        if (st.key === 'CCTV' && sys === 'CCTV') return true;
        if (st.key === 'FIRE_ALARM' && sys === 'FDAS') return true;
        if (st.key === 'ACCESS_CONTROL' && sys === 'ACCESS_CONTROL') return true;
        if (st.key === 'BURGLAR_ALARM' && sys === 'BURGLAR_ALARM') return true;
        if (st.key === 'FIRE_PROTECTION' && sys === 'FIRE_PROTECTION') return true;
        
        if (st.key === 'OTHER') {
          const otherTypes = [
            'DOOR_LOCK', 'EAS_SYSTEM', 'FIXED_ARM_ELEVATOR', 'INTERCOM_NURSE_CALL',
            'PABX_PAGING', 'PARKING_BARRIER', 'POS_SYSTEM', 'ROOM_ALERT', 'XRAY_SECURITY'
          ];
          return otherTypes.includes(sys);
        }
        return false;
      });
    });
  }, [project.systemTypes]);

  const completedSurveys = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('aa2000_surveys') || '[]')
        .filter((s: any) => s.projectId === project.id);
    } catch (e) {
      return [];
    }
  }, [project.id]);

  const isCategoryCompleted = React.useCallback((type: string) => {
    return completedSurveys.some((s: any) => s.type === type);
  }, [completedSurveys]);

  const isSurveyFilled = React.useMemo(() => {
    return activeSurveyTypes.every(st => isCategoryCompleted(st.key));
  }, [activeSurveyTypes, isCategoryCompleted]);

  // All roles can conduct surveys; only Admin can approve/reject
  const canSurvey = true;

  const isEstimationDisabled = !isSurveyFilled;

  const showTechSubmitBanner = !project.status.includes('Finalized') && completedSurveys.length > 0;

  const handleFinalizeSubmit = async () => {
    const ok = await confirm("Are you sure you want to finalize this project survey and submit it to the Admin? You will not be able to edit the survey details after submitting.");
    if (ok) {
      onUpdateStatus(project.id, 'Finalized');
      onBack();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-12" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-6 py-4 bg-gradient-to-r from-white to-blue-50 border-b border-slate-200 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            {user.role === 'ADMIN' && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Edit all project details"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Project
              </button>
            )}
            <StatusBadge status={project.status} />
            <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {project.id}</span>
          </div>
        </div>
      </header>

      {isEditing && (
        <EditProjectModal
          project={project}
          onClose={() => setIsEditing(false)}
          onSave={(updated) => {
            onUpdateProject?.(updated);
            setIsEditing(false);
          }}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Financial & Admin Approval Banner */}
        {(user.role === 'ADMIN' || user.role === 'ACCOUNTING') && project.status === 'Finalized' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in-up">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Awaiting Financial & Admin Approval</h3>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400 font-semibold">
                Please review the ground-validated survey and cost estimation, then approve or request adjustments.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => onUpdateStatus(project.id, 'Finalized - Rejected')}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer"
              >
                Reject / Request Edit
              </button>
              <button
                onClick={() => onUpdateStatus(project.id, 'Finalized - Approved')}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 cursor-pointer"
              >
                Approve Project
              </button>
            </div>
          </div>
        )}

        {/* Reopen banner — for approved/rejected surveys that need to be accessed/edited again */}
        {(user.role === 'ADMIN' || user.role === 'ACCOUNTING') && (project.status === 'Finalized - Approved' || project.status === 'Finalized - Rejected') && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                {project.status === 'Finalized - Approved' ? 'Project Survey Approved & Locked' : 'Project Survey Rejected'}
              </h3>
              <p className="text-[11px] leading-relaxed text-slate-400 font-semibold mt-0.5">
                Reopen this project to allow further adjustments.
              </p>
            </div>
            <button
              onClick={() => onUpdateStatus(project.id, 'Finalized')}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm shadow-blue-100 cursor-pointer"
            >
              Reopen Survey
            </button>
          </div>
        )}

        {/* Hero card */}
        <div
          className="rounded-3xl p-6 mb-8 bg-white border border-slate-100 shadow-sm relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-[#0F172A]">{project.name}</h1>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{project.clientName}</p>

              <div className="mt-6 space-y-4">
                {/* Location */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-[#1E3A8A] shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-2 flex-wrap">
                      <span>{project.location}</span>
                      {(project.location || (project.latitude && project.longitude)) && (
                        <a
                          href={
                            project.latitude && project.longitude
                              ? `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`
                              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.location || '')}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 text-[9px] font-bold uppercase bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-all border border-blue-100 shrink-0 inline-flex items-center gap-0.5"
                        >
                          View Map
                        </a>
                      )}
                    </p>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap items-center gap-6">
                  {/* Client Contact Phone */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-[#1E3A8A]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.47-5.112-3.758-6.58-6.58l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H3.562A2.25 2.25 0 001.312 4.5v2.25z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Client Contact</p>
                      <p className="text-xs font-semibold text-slate-600">{project.clientPhone || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Client Email (Admin Only) */}
                  {user.role === 'ADMIN' && (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-[#1E3A8A]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Client Email</p>
                        <p className="text-xs font-semibold text-slate-600">{project.clientEmail || 'Not set'}</p>
                      </div>
                    </div>
                  )}

                  {/* Building type */}
                  {project.buildingType && (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-[#1E3A8A]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Building</p>
                        <p className="text-xs font-semibold text-slate-600">{project.buildingType} · {project.floors} floor(s)</p>
                      </div>
                    </div>
                  )}

                  {/* Start date */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100 text-[#1E3A8A]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Start Date</p>
                      <p className="text-xs font-semibold text-slate-600">{project.startDate || 'Not set'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs — all roles see survey report + estimation; fill button appears once survey is complete */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onViewSurveySummary}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all shrink-0"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
                VIEW SURVEY REPORT
              </button>
              <button
                onClick={onViewEstimation}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs text-white transition-all shrink-0 justify-center shadow-sm hover:opacity-90 cursor-pointer"
                style={{ background: '#1E3A8A' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                COST ESTIMATION
              </button>
            </div>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="bg-white rounded-3xl p-6 mb-8 border border-slate-100 shadow-sm animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-black tracking-wider text-slate-800 uppercase">Project Survey Workflow</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Current Phase Progress</p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                Current status: {
                  project.status === 'Pending' || project.status === 'In Progress' || project.status === 'Finalized - Rejected'
                    ? 'Survey In Progress'
                    : project.status === 'Finalized'
                    ? 'Awaiting Approval'
                    : 'Approved'
                }
              </span>
            </div>
          </div>

          <div className="relative mt-8 mb-4 px-4">
            {/* Connecting lines */}
            <div className="absolute top-[20px] left-8 right-8 h-1 bg-slate-100 z-0 rounded-full" />
            <div 
              className={`absolute top-[20px] left-8 h-1 z-0 transition-all duration-700 rounded-full ${
                project.status === 'Completed' || project.status === 'Finalized - Approved'
                  ? 'bg-emerald-500'
                  : 'bg-blue-600'
              }`} 
              style={{ 
                width: `${
                  (project.status === 'Pending' || project.status === 'In Progress' || project.status === 'Finalized - Rejected'
                    ? '0px'
                    : project.status === 'Finalized'
                    ? 'calc(50% - 1rem)'
                    : 'calc(100% - 2rem)')
                }` 
              }}
            />

            <div className="relative z-10 flex justify-between">
              {[
                { label: 'Survey In Progress', desc: 'Conducting site survey & drafting specification', icon: '', stage: 'Surveying' },
                { label: 'Awaiting Approval', desc: 'Finalized, awaiting admin review', icon: '', stage: 'Finalized' },
                { label: 'Approved', desc: 'Survey approved & locked', icon: '', stage: 'Completed' },
              ].map((step, idx) => {
                const currentStageIndex = 
                  project.status === 'Pending' || project.status === 'In Progress' || project.status === 'Finalized - Rejected' ? 0 :
                  project.status === 'Finalized' ? 1 : 2;

                const isApprovedState = currentStageIndex === 2;
                const isCompleted = idx < currentStageIndex || (idx === 2 && isApprovedState);
                const isActive = idx === currentStageIndex && !isApprovedState;
                
                return (
                  <div key={step.label} className="flex flex-col items-center text-center flex-1">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 border-2 ${
                        isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100' :
                        isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 scale-110' :
                        'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.label === 'Survey In Progress' ? <StatBolt className="w-4 h-4" /> : step.label === 'Awaiting Approval' ? <StatClipboard className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </div>
                    <p className={`text-[11px] font-black mt-3 transition-colors duration-300 uppercase tracking-tight ${
                      isCompleted ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 max-w-[120px] leading-tight">
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>



        {/* Technician Completion / Finalize Banner */}
        {showTechSubmitBanner && (
          <div className="flex justify-end mt-8">
            <button
              onClick={handleFinalizeSubmit}
              className="px-8 py-2.5 rounded-full font-bold text-xs text-white bg-[#1E3A8A] hover:opacity-90 transition-all shadow-sm cursor-pointer"
            >
              Submit
            </button>
          </div>
        )}
      </main>
    </div>
  );
}