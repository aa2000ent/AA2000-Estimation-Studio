import { useState, useMemo } from 'react';
import type { User, Project } from '../../App';

interface Props {
  user: User;
  companyProject: Project;
  projects: Project[];
  onBack: () => void;
  onSelectProject: (project: Project) => void;
  onNewSurvey: (companyName: string) => void;
  onDeleteProject?: (id: string) => void;
}

const statusConfig: Record<string, { color: string; bg: string; bar: string }> = {
  'In Progress': { color: '#2563EB', bg: 'rgba(37,99,235,0.08)', bar: '#2563EB' },
  'Pending': { color: '#1E3A8A', bg: 'rgba(30,58,138,0.08)', bar: '#1E3A8A' },
  'Completed': { color: '#059669', bg: 'rgba(5,150,105,0.08)', bar: '#059669' },
  'Finalized - Approved': { color: '#059669', bg: 'rgba(5,150,105,0.08)', bar: '#059669' },
  'Finalized - Rejected': { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', bar: '#DC2626' },
  'Finalized': { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', bar: '#7C3AED' },
};

function StatusBadge({ status, isMissing }: { status: string; isMissing?: boolean }) {
  const cfg = isMissing
    ? { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' }
    : statusConfig[status] || Object.entries(statusConfig).find(([key]) => status && status.includes(key))?.[1] || {
        color: '#64748B', bg: 'rgba(100,116,139,0.08)',
      };
  return (
    <span
      className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {isMissing ? 'Missing' : (status || 'Pending')}
    </span>
  );
}

export default function CompanyDetail({
  user,
  companyProject,
  projects,
  onBack,
  onSelectProject,
  onNewSurvey,
  onDeleteProject,
}: Props) {
  const isAdmin = user.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<'assignments' | 'missing' | 'approval' | 'finalize' | 'complete'>('assignments');

  // Find all projects/surveys belonging to this company name
  const companyProjects = useMemo(() => {
    const clean = (s?: string) => (s || '').trim().toLowerCase();
    const cName = clean(companyProject.name);
    const cClient = clean(companyProject.clientName);
    const matched = projects.filter(
      p =>
        p.id !== companyProject.id &&
        p.buildingType !== 'Other' && // Do not include company folders in project tabs
        (clean(p.clientName) === cName ||
         clean(p.clientName) === cClient ||
         clean(p.name) === cName ||
         (cName && clean(p.clientName) && (cName.includes(clean(p.clientName)) || clean(p.clientName).includes(cName))))
    );
    if (matched.length === 0 && companyProject.buildingType !== 'Other') {
      return [companyProject];
    }
    return matched;
  }, [projects, companyProject]);

  // Filter projects by tabs
  const filteredProjects = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    switch (activeTab) {
      case 'missing':
        return companyProjects.filter(p => {
          const isNotComplete = p.status !== 'Completed' && !p.status?.includes('Finalized');
          const isMissed = !p.startDate || p.startDate < today;
          return isNotComplete && isMissed;
        });
      case 'approval':
        return companyProjects.filter(p => p.status === 'Finalized');
      case 'finalize':
        return companyProjects.filter(p => p.status === 'Finalized - Approved' || p.status === 'Finalized - Rejected');
      case 'complete':
        return companyProjects.filter(p => p.status === 'Completed');
      case 'assignments':
      default:
        return companyProjects.filter(p => {
          const isNotComplete = p.status !== 'Completed' && !p.status?.includes('Finalized');
          return isNotComplete;
        });
    }
  }, [companyProjects, activeTab]);

  const countAssignments = useMemo(() => {
    return companyProjects.filter(p => {
      const isNotComplete = p.status !== 'Completed' && !p.status?.includes('Finalized');
      return isNotComplete;
    }).length;
  }, [companyProjects]);

  const countMissing = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return companyProjects.filter(p => {
      const isNotComplete = p.status !== 'Completed' && !p.status?.includes('Finalized');
      const isMissed = !p.startDate || p.startDate < today;
      return isNotComplete && isMissed;
    }).length;
  }, [companyProjects]);

  const countApproval = useMemo(() => {
    return companyProjects.filter(p => p.status === 'Finalized').length;
  }, [companyProjects]);

  const countFinalize = useMemo(() => {
    return companyProjects.filter(p => p.status === 'Finalized - Approved' || p.status === 'Finalized - Rejected').length;
  }, [companyProjects]);

  const countComplete = useMemo(() => {
    return companyProjects.filter(p => p.status === 'Completed').length;
  }, [companyProjects]);

  return (
    <div className="px-8 pt-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Back navigation & Header action */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Companies
        </button>

        {isAdmin && (
          <button
            onClick={() => onNewSurvey(companyProject.name)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all shadow-sm"
            style={{ background: '#1E3A8A' }}
          >
            + New Project / Survey
          </button>
        )}
      </div>

      {/* Company Banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 text-white shadow-lg border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6"
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 50%, #2563EB 100%)',
        }}
      >
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase bg-white/20 text-white">
              Company Portfolio
            </span>
            <span className="text-[10px] text-white/70 font-semibold">• Active</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">{companyProject.name}</h1>
          <p className="text-xs text-blue-100 leading-relaxed font-medium">
            {companyProject.clientName}
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-semibold text-blue-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>📍</span> 
              <span>{companyProject.location || 'No Location'}</span>
              {(companyProject.location || (companyProject.latitude && companyProject.longitude)) && (
                <a
                  href={
                    companyProject.latitude && companyProject.longitude
                      ? `https://www.google.com/maps/search/?api=1&query=${companyProject.latitude},${companyProject.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyProject.location || '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase bg-white/20 text-white hover:bg-white/30 rounded-full transition-all border border-white/10 shrink-0 inline-block align-middle"
                >
                  View Map
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>📞</span> {companyProject.clientPhone || 'No Contact'}
            </div>
            {user.role === 'ADMIN' && (
              <div className="flex items-center gap-1.5">
                <span>✉️</span> {companyProject.clientEmail || 'No Email'}
              </div>
            )}
          </div>
        </div>

        {/* stats indicators */}
        <div className="relative z-10 shrink-0 flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
          <div className="text-center text-white">
            <p className="text-3xl font-black">{companyProjects.length}</p>
            <p className="text-[8px] font-extrabold uppercase tracking-widest text-blue-100 mt-1">Projects</p>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-blue-400 opacity-20 blur-3xl pointer-events-none translate-x-20 translate-y-20" />
      </div>

      {/* Tabs list & Project counts */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <div className="flex border-b border-slate-100 pb-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${
                activeTab === 'assignments'
                  ? 'border-[#1E3A8A] text-[#1E3A8A]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Assignments ({countAssignments})
            </button>
            <button
              onClick={() => setActiveTab('missing')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${
                activeTab === 'missing'
                  ? 'border-[#DC2626] text-[#DC2626]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Missing ({countMissing})
            </button>
            <button
              onClick={() => setActiveTab('approval')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${
                activeTab === 'approval'
                  ? 'border-[#7C3AED] text-[#7C3AED]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Approval Pipeline ({countApproval})
            </button>
            <button
              onClick={() => setActiveTab('finalize')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${
                activeTab === 'finalize'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Finalize Review ({countFinalize})
            </button>
            <button
              onClick={() => setActiveTab('complete')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${
                activeTab === 'complete'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Complete ({countComplete})
            </button>
          </div>
        </div>

        {/* Projects List */}
        <div className="mt-6">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-xl">
                📋
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-600">No projects found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isAdmin ? 'Add a new project to get started' : 'No items under this category'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map(project => {
                const today = new Date().toISOString().split('T')[0];
                const isProjectMissing = (() => {
                  const isNotComplete = project.status !== 'Completed' && !project.status?.includes('Finalized');
                  const isMissed = !project.startDate || project.startDate < today;
                  return isNotComplete && isMissed;
                })();

                const statusBar = isProjectMissing
                  ? '#DC2626'
                  : Object.entries(statusConfig).find(([key]) => project.status?.includes(key))?.[1]?.bar || '#64748B';

                return (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project)}
                    className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-2 h-10 rounded-full shrink-0" style={{ background: statusBar }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800 truncate">{project.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {project.location} {project.buildingType ? `· ${project.buildingType}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Created: {project.startDate || (project.createdAt ? project.createdAt.split('T')[0] : '—')}
                          {(() => {
                            if (!project.createdAt) return null;
                            try {
                              const d = new Date(project.createdAt);
                              if (!isNaN(d.getTime())) {
                                return ` · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                              }
                            } catch {}
                            return null;
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <StatusBadge status={project.status} isMissing={isProjectMissing} />
                      {isAdmin && onDeleteProject && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const confirm = window.confirm(`Are you sure you want to delete project/survey "${project.name}"?`);
                            if (confirm) {
                              onDeleteProject(project.id);
                            }
                          }}
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Project/Survey"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
