import React, { useState } from 'react';
import type { User, Project as AppProject } from '../../App';

interface Props {
  user?: User;
  projects?: AppProject[];
  onSelectProject?: (project: AppProject) => void;
  onNavigateToCreate?: () => void;
}

type TabType = 'All' | 'Pending' | 'In Progress' | 'Completed';

export default function ApprovalPipeline({
  user,
  projects = [],
  onSelectProject,
  onNavigateToCreate,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'Newest' | 'Oldest'>('Newest');

  // Filter actual projects by tab and search
  const filteredProjects = projects.filter((p) => {
    // Map status category
    const isPending = p.status === 'Pending' || p.status === 'Finalized';
    const isInProgress = p.status === 'In Progress';
    const isCompleted = p.status === 'Completed' || p.status === 'Finalized - Approved';

    let matchesTab = true;
    if (activeTab === 'Pending') matchesTab = isPending;
    else if (activeTab === 'In Progress') matchesTab = isInProgress;
    else if (activeTab === 'Completed') matchesTab = isCompleted;

    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName && p.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  }).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return sortOrder === 'Newest' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header section with Filter tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Approval Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review and manage project approvals submitted through the estimation workflow.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((tab) => {
            const count = tab === 'All'
              ? projects.length
              : projects.filter(p => {
                  if (tab === 'Pending') return p.status === 'Pending' || p.status === 'Finalized';
                  if (tab === 'In Progress') return p.status === 'In Progress';
                  if (tab === 'Completed') return p.status === 'Completed' || p.status === 'Finalized - Approved';
                  return false;
                }).length;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white uppercase">
              Approval Pipeline
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase">
              AA2000 SECURITY • ESTIMATION PLATFORM
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'Newest' | 'Oldest')}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
            </select>
          </div>
        </div>

        {/* Empty State View */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center my-auto">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 animate-float-a">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              No projects awaiting approval
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              There are currently no projects requiring your review.
            </p>
          </div>
        ) : (
          /* Active Projects List View */
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 my-4 flex-1">
            {filteredProjects.map((project) => {
              const formattedDate = project.startDate || (project.createdAt ? project.createdAt.split('T')[0] : 'Today');
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject && onSelectProject(project)}
                  className="py-3.5 px-2 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer group"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      {project.clientName || 'General Client'} • {formattedDate} {project.location ? `• ${project.location}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                      {project.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectProject) onSelectProject(project);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating AI Estimator Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            if (onNavigateToCreate) onNavigateToCreate();
          }}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
        >
          <span>✨</span>
          <span>AI Estimator</span>
        </button>
      </div>
    </div>
  );
}
