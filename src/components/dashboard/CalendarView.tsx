import React, { useState, useMemo } from 'react';
import type { Project } from '../../App';
import { getRoleTheme } from '../../utils/RoleTheme';

interface CalendarViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  userRole: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  'Pending':             { label: 'Pending',     color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', dot: '#F59E0B' },
  'In Progress':         { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', dot: '#3B82F6' },
  'Completed':           { label: 'Completed',   color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981' },
  'Finalized - Approved':{ label: 'Approved',    color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981' },
  'Finalized - Rejected':{ label: 'Rejected',    color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)',  dot: '#EF4444' },
  'Finalized':           { label: 'Finalized',   color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)', dot: '#A855F7' },
};

export default function CalendarView({ projects, onSelectProject, userRole }: CalendarViewProps) {
  const theme = getRoleTheme(userRole);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDayProjects, setSelectedDayProjects] = useState<{ date: string; projects: Project[] } | null>(null);

  const actualProjects = useMemo(() => {
    return projects.filter(p => p.buildingType !== 'Other');
  }, [projects]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Month details
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Create calendar cells array (42 cells: 6 rows x 7 cols)
  const cells = useMemo(() => {
    const arr = [];
    // Previous Month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, isCurrentMonth: false, dateString });
    }
    // Current Month days
    for (let d = 1; d <= totalDays; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, isCurrentMonth: true, dateString });
    }
    // Next Month padding days
    const totalCellsSoFar = arr.length;
    const nextMonthPadding = 42 - totalCellsSoFar;
    for (let d = 1; d <= nextMonthPadding; d++) {
      const dateString = `${year}-${String(month + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, isCurrentMonth: false, dateString });
    }
    return arr;
  }, [year, month, firstDayIndex, totalDays, prevMonthTotalDays]);

  // Group projects by date
  const projectsByDate = useMemo(() => {
    const map: Record<string, Project[]> = {};
    actualProjects.forEach(proj => {
      if (proj.startDate) {
        const dateStr = proj.startDate;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(proj);
      }
    });
    return map;
  }, [actualProjects]);

  // Month stats for quick user overview
  const monthStats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    actualProjects.forEach(p => {
      if (!p.startDate) return;
      const pDate = new Date(p.startDate);
      if (pDate.getFullYear() === year && pDate.getMonth() === month) {
        if (p.status === 'Pending') pending++;
        else if (p.status === 'In Progress') inProgress++;
        else if (p.status === 'Completed' || p.status?.includes('Finalized')) completed++;
      }
    });

    return { pending, inProgress, completed, total: pending + inProgress + completed };
  }, [actualProjects, year, month]);

  return (
    <div className="px-4 sm:px-6 pt-6 pb-10 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Status Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: '#0F172A', fontFamily: 'Manrope, Inter, sans-serif' }}
          >
            Survey Calendar
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            Overview of scheduled site surveys and project milestones
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
          {['ALL', 'Pending', 'In Progress', 'Completed'].map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200"
              style={
                selectedStatus === status
                  ? { background: theme.primary, color: '#ffffff', boxShadow: `0 4px 12px ${theme.primary}40` }
                  : { background: '#334155', color: '#ffffff' }
              }
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-[#0F172A] rounded-3xl border border-slate-800 shadow-xl overflow-hidden animate-fade-in-up delay-75">
        {/* Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white tracking-tight">
              {monthName} {year}
            </h2>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-[11px] font-extrabold uppercase bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-all"
            >
              Today
            </button>
          </div>

          {/* Status Legend & Month Summary */}
          <div className="flex items-center gap-4 text-xs">
            <div className="hidden lg:flex items-center gap-3 pr-4 border-r border-slate-800 text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Pending ({monthStats.pending})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> In Progress ({monthStats.inProgress})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed ({monthStats.completed})</span>
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex gap-1.5">
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="p-2 rounded-xl border border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="p-2 rounded-xl border border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-800/80 bg-slate-900/40 text-center py-2.5">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <span key={d} className="text-[11px] font-black text-white uppercase tracking-wider">
              {d}
            </span>
          ))}
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-800/60 bg-[#0F172A]">
          {cells.map((cell, idx) => {
            const dayProjects = projectsByDate[cell.dateString] || [];
            const filteredProjects = dayProjects.filter(p => {
              if (selectedStatus === 'ALL') return true;
              return p.status === selectedStatus;
            });

            const todayObj = new Date();
            const isToday =
              cell.isCurrentMonth &&
              todayObj.getFullYear() === year &&
              todayObj.getMonth() === month &&
              todayObj.getDate() === cell.day;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (filteredProjects.length > 0) {
                    setSelectedDayProjects({ date: cell.dateString, projects: filteredProjects });
                  }
                }}
                className={`min-h-[105px] sm:min-h-[115px] p-2 flex flex-col justify-between transition-all relative ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-950/40 opacity-30 hover:opacity-50'
                    : 'bg-[#0F172A] hover:bg-slate-800/40'
                } cursor-pointer group`}
              >
                {/* Top bar in cell: Date Number & Count Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                      isToday
                        ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40'
                        : !cell.isCurrentMonth
                        ? 'text-slate-600'
                        : 'text-white'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {filteredProjects.length > 0 && (
                    <span className="text-[10px] font-black text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">
                      {filteredProjects.length}
                    </span>
                  )}
                </div>

                {/* Projects Badges */}
                <div className="flex-1 mt-1.5 space-y-1 overflow-y-auto max-h-[75px] no-scrollbar">
                  {filteredProjects.map(proj => {
                    const cfg = statusConfig[proj.status] ||
                      Object.entries(statusConfig).find(([key]) => proj.status && proj.status.includes(key))?.[1] || {
                        label: proj.status || 'Project',
                        color: '#94A3B8',
                        bg: 'rgba(148, 163, 184, 0.15)',
                        dot: '#94A3B8'
                      };

                    return (
                      <div
                        key={proj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj);
                        }}
                        className="text-[10px] font-bold py-1 px-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all cursor-pointer truncate flex items-center gap-1.5 hover:scale-[1.02]"
                        style={{ background: cfg.bg, color: cfg.color }}
                        title={`${proj.name} — ${proj.clientName}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                        <span className="truncate">{proj.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Quick View Modal */}
      {selectedDayProjects && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">Scheduled Surveys</h3>
                <p className="text-xs text-slate-400">{selectedDayProjects.date}</p>
              </div>
              <button
                onClick={() => setSelectedDayProjects(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {selectedDayProjects.projects.map(proj => {
                const cfg = statusConfig[proj.status] || { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', dot: '#3B82F6' };
                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setSelectedDayProjects(null);
                      onSelectProject(proj);
                    }}
                    className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{proj.name}</h4>
                      <p className="text-xs text-slate-400">{proj.clientName} • {proj.location}</p>
                    </div>
                    <span
                      className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-slate-700"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {proj.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedDayProjects(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
