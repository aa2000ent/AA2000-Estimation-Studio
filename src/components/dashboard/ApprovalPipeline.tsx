import React, { useState, useMemo, useEffect } from 'react';
import type { User, Project as AppProject } from '../../App';
import { computeStatusKpis, statusBucket, type StatusBucket } from '../../constants/status';

/** Maps a tab to the shared status bucket it shows, so tabs and KPIs cannot drift. */
const TAB_TO_BUCKET: Record<Exclude<TabType, 'All'>, StatusBucket> = {
  Rejected: 'rejected',
  Pending: 'pending',
  Active: 'active',
  Completed: 'completed',
};

function tabToBucket(tab: Exclude<TabType, 'All'>): StatusBucket {
  return TAB_TO_BUCKET[tab];
}

interface Props {
  user?: User;
  projects?: AppProject[];
  onSelectProject?: (project: AppProject) => void;
  onNavigateToCreate?: () => void;
}

type TabType = 'All' | 'Rejected' | 'Pending' | 'Active' | 'Completed';

const STATUS_BADGE_STYLES: Record<StatusBucket, { badge: string; dot: string }> = {
  pending: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50',
    dot: 'bg-amber-500',
  },
  active: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/50',
    dot: 'bg-blue-500',
  },
  completed: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50',
    dot: 'bg-emerald-500',
  },
  rejected: {
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/50',
    dot: 'bg-rose-500',
  },
};

export default function ApprovalPipeline({
  user,
  projects = [],
  onSelectProject,
  onNavigateToCreate,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'Newest' | 'Oldest'>('Newest');

  // Screen-fit pagination state
  const [pageSizeMode, setPageSizeMode] = useState<'auto' | number>('auto');
  const [autoPageSize, setAutoPageSize] = useState<number>(6);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Dynamically calculate how many cards fit in the screen without requiring long scrolling
  useEffect(() => {
    const calculateFittingCards = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Columns based on Tailwind responsive breakpoints:
      // xl / lg (>= 1024px): 3 columns
      // md (>= 768px): 2 columns
      // sm (< 768px): 1 column
      const cols = width >= 1024 ? 3 : width >= 768 ? 2 : 1;

      // Approximate height consumed by dashboard topbar, pipeline header,
      // search/controls bar, tabs, and pagination footer (~380px)
      const availableHeight = Math.max(200, height - 390);

      // Card height + gap is approximately 190-210px
      const approxRowHeight = 205;
      const rows = Math.max(1, Math.floor(availableHeight / approxRowHeight));

      const fit = cols * rows;
      setAutoPageSize(fit);
    };

    calculateFittingCards();
    window.addEventListener('resize', calculateFittingCards);
    return () => window.removeEventListener('resize', calculateFittingCards);
  }, []);

  // Effective page size: dynamic auto-fit or explicit choice
  const effectivePageSize = pageSizeMode === 'auto' ? autoPageSize : pageSizeMode;

  // Filter submitted projects with valid DB rows
  const submittedProjects = useMemo(
    () => projects.filter((p) => Boolean(p.dbProjId)),
    [projects]
  );

  // Status KPIs for tabs
  const tabKpis = useMemo(
    () => computeStatusKpis(submittedProjects),
    [submittedProjects]
  );

  // Filter actual projects by tab, search, and sort order
  const filteredProjects = useMemo(() => {
    return submittedProjects
      .filter((p) => {
        const matchesTab =
          activeTab === 'All' || statusBucket(p.status) === tabToBucket(activeTab);

        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !query ||
          p.name.toLowerCase().includes(query) ||
          (p.clientName && p.clientName.toLowerCase().includes(query)) ||
          (p.location && p.location.toLowerCase().includes(query));

        return matchesTab && matchesSearch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return sortOrder === 'Newest' ? timeB - timeA : timeA - timeB;
      });
  }, [submittedProjects, activeTab, searchQuery, sortOrder]);

  // Reset to first page whenever filtering/sorting/pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortOrder, effectivePageSize]);

  // Pagination bounds
  const totalItems = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  // Generate page numbers with ellipses
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safeCurrentPage <= 3) {
      pages.push(1, 2, 3, '...', totalPages);
    } else if (safeCurrentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safeCurrentPage, '...', totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 flex flex-col min-h-full">
      {/* ── Header section with Filter tabs ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Approval Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review and manage project approvals submitted through the estimation workflow.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-full">
          {(['All', 'Rejected', 'Pending', 'Active', 'Completed'] as const).map((tab) => {
            const tabCount = tab === 'All' ? tabKpis.total : tabKpis[tabToBucket(tab)];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between">
        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white uppercase">
              Project Cards
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase">
              {totalItems} {totalItems === 1 ? 'Project' : 'Projects'} in queue
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-56 pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Sort */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'Newest' | 'Oldest')}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              title="Sort Order"
            >
              <option value="Newest">Newest first</option>
              <option value="Oldest">Oldest first</option>
            </select>

            {/* Screen Fit / Page Size Selector */}
            <select
              value={pageSizeMode}
              onChange={(e) => {
                const val = e.target.value;
                setPageSizeMode(val === 'auto' ? 'auto' : Number(val));
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none cursor-pointer font-medium"
              title="Page Size"
            >
              <option value="auto">Fit Screen ({autoPageSize}/page)</option>
              <option value="4">4 per page</option>
              <option value="6">6 per page</option>
              <option value="8">8 per page</option>
              <option value="12">12 per page</option>
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
              No projects found
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {searchQuery
                ? 'No project cards match your search criteria.'
                : 'There are currently no projects in this approval bucket.'}
            </p>
          </div>
        ) : (
          /* Active Projects Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-2 flex-1 items-stretch content-start">
            {paginatedProjects.map((project) => {
              const formattedDate =
                project.startDate ||
                (project.createdAt ? project.createdAt.split('T')[0] : 'Today');

              const bucket = statusBucket(project.status) || 'pending';
              const statusStyle = STATUS_BADGE_STYLES[bucket];

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject && onSelectProject(project)}
                  className="group bg-white dark:bg-[#1A233A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/70 transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Card top: Status badge & ID */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${statusStyle.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {project.status || 'Pending'}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                        #{project.dbProjId ? `PRJ-${project.dbProjId}` : project.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Project Title */}
                    <h3
                      className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5"
                      title={project.name}
                    >
                      {project.name}
                    </h3>

                    {/* Client & Location */}
                    <div className="space-y-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <svg
                          className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                          {project.clientName || 'General Client'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <svg
                          className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="truncate">
                          {project.location || 'Location not specified'}
                        </span>
                      </div>
                    </div>

                    {/* System Types Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {project.systemTypes && project.systemTypes.length > 0 ? (
                        project.systemTypes.slice(0, 3).map((st) => (
                          <span
                            key={st}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                          >
                            {st}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60">
                          {project.buildingType || 'Standard Survey'}
                        </span>
                      )}
                      {project.systemTypes && project.systemTypes.length > 3 && (
                        <span className="text-[10px] font-bold text-slate-400">
                          +{project.systemTypes.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card bottom: Date & Review CTA */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs mt-2">
                    <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formattedDate}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectProject) onSelectProject(project);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      <span>Review</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination Bar ── */}
        {totalItems > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{endIndex}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> projects
            </p>

            <div className="flex items-center gap-1.5">
              {/* Previous */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                aria-label="Previous Page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Prev</span>
              </button>

              {/* Page numbers */}
              {pageNumbers.map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500 font-bold"
                    >
                      ...
                    </span>
                  );
                }
                const isActive = p === safeCurrentPage;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Next */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                aria-label="Next Page"
              >
                <span>Next</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
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
