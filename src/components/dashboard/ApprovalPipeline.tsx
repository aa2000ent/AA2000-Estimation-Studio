import React, { useState, useMemo } from 'react';
import type { User, Project } from '../../App';
import { StatClipboard } from '../../utils/Icons';

interface Props {
  user: User;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onDeleteProject?: (id: string) => void;
  onEditProject?: (project: Project) => void;
  pinned: Set<string>;
  onTogglePin: (id: string) => void;
  isDark?: boolean;
}

type SortMode = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

export default function ApprovalPipeline({
  user,
  projects,
  onSelectProject,
  onDeleteProject,
  onEditProject,
  pinned,
  onTogglePin,
  isDark = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Filter projects awaiting approval (status === 'Finalized')
  const actualProjects = useMemo(() => {
    return projects.filter(p => p.buildingType !== 'Other' && p.status === 'Finalized');
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const f = actualProjects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    );

    return [...f].sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      if (sort === 'name-desc') return b.name.localeCompare(a.name);
      return 0;
    });
  }, [actualProjects, search, sort]);

  const pinnedItems = filtered.filter(p => pinned.has(p.id));
  const unpinnedItems = filtered.filter(p => !pinned.has(p.id));
  const ordered = [...pinnedItems, ...unpinnedItems];

  return (
    <div className="px-6 pt-6 pb-6 flex-1 flex flex-col min-h-0">
      <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in-up flex-1 flex flex-col min-h-[calc(100vh-120px)]">
        {/* Table header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                Approval Pipeline
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {ordered.length} Pending Approval
              </span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
              AA2000 Security · Estimation Platform
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="search-input w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-800 transition-all"
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </div>
        </div>

        {/* Table body / Empty state */}
        <div className="overflow-x-auto flex-1 pb-16">
          {ordered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 flex-1 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl animate-float-a">
                <StatClipboard className="w-6 h-6" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm font-black text-slate-800 dark:text-white mb-1">No projects found</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  There are currently no finalized site surveys awaiting approval in the pipeline.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3 pl-6">Project / Client</th>
                  <th className="py-3 text-center">Status</th>
                  <th className="py-3 text-center">Date & Time</th>
                  <th className="py-3 pr-6 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ordered.map((project, i) => {
                  const isPinned = pinned.has(project.id);
                  const isOpen = menuOpen === project.id;
                  const isNearBottom = ordered.length > 2 && i >= ordered.length - 2;

                  const formattedTime = (() => {
                    if (!project.createdAt) return '';
                    try {
                      const d = new Date(project.createdAt);
                      if (!isNaN(d.getTime())) {
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                      }
                    } catch {}
                    return '';
                  })();

                  return (
                    <tr
                      key={project.id}
                      onClick={() => onSelectProject(project)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 transition-colors group animate-fade-in-up ${
                        isOpen ? 'relative z-50' : ''
                      }`}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <td className="py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 rounded-full shrink-0 bg-purple-600" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-white">{project.name}</span>
                              {isPinned && (
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                                  Pinned
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {project.clientName} · {project.location}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          Awaiting Approval
                        </span>
                      </td>
                      <td className="py-3.5 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{project.startDate || (project.createdAt ? project.createdAt.split('T')[0] : '—')}</span>
                          {formattedTime && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                              · {formattedTime}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-3.5 pr-6 text-right relative ${isOpen ? 'z-50' : ''}`} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpen(isOpen ? null : project.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
                          </svg>
                        </button>
                        {isOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                            <div
                              className={`absolute right-4 z-50 w-48 rounded-xl bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 py-1.5 shadow-2xl text-left animate-scale-in ${
                                isNearBottom ? 'bottom-8' : 'top-10'
                              }`}
                            >
                              {onEditProject && (
                                <button
                                  onClick={() => { onEditProject(project); setMenuOpen(null); }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  Edit Project
                                </button>
                              )}
                              <button
                                onClick={() => { onTogglePin(project.id); setMenuOpen(null); }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                {isPinned ? 'Unpin' : 'Pin Project'}
                              </button>
                              <button
                                onClick={() => { onSelectProject(project); setMenuOpen(null); }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                View Details
                              </button>
                              {onDeleteProject && (
                                <>
                                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                                  <button
                                    onClick={() => { onDeleteProject(project.id); setMenuOpen(null); }}
                                    className="w-full px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    Delete Project
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
