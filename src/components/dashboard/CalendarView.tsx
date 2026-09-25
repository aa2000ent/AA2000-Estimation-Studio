import React, { useState, useMemo } from 'react';
import type { Project } from '../../App';
import { getRoleTheme } from '../../utils/RoleTheme';

interface CalendarViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  userRole: string;
  isDark?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  'Pending':              { label: 'Pending',     color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', dot: '#F59E0B' },
  'In Progress':          { label: 'In Progress', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.15)', dot: '#2563EB' },
  'Completed':            { label: 'Completed',   color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981' },
  'Finalized - Approved': { label: 'Approved',    color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981' },
  'Finalized - Rejected': { label: 'Rejected',    color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)',  dot: '#EF4444' },
  'Finalized':            { label: 'Finalized',   color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.15)', dot: '#7C3AED' },
};

export default function CalendarView({ projects, onSelectProject, userRole, isDark = false }: CalendarViewProps) {
  const theme = getRoleTheme(userRole, isDark);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sideSearch, setSideSearch] = useState('');
  const [selectedDayProjects, setSelectedDayProjects] = useState<{ date: string; projects: Project[] } | null>(null);

  const actualProjects = useMemo(() => {
    return projects.filter(p => p.buildingType !== 'Other');
  }, [projects]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedDate(todayStr);
  };

  // Month details
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Create 42 cells (6 rows x 7 cols)
  const cells = useMemo(() => {
    const arr = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateString = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, isCurrentMonth: false, dateString });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, isCurrentMonth: true, dateString });
    }
    const nextMonthPadding = 42 - arr.length;
    for (let d = 1; d <= nextMonthPadding; d++) {
      const nextM = month === 11 ? 1 : month + 2;
      const nextY = month === 11 ? year + 1 : year;
      const dateString = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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

  // Month stats
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

  // Filtered month projects for side panel
  const monthProjects = useMemo(() => {
    const q = sideSearch.toLowerCase().trim();
    return actualProjects.filter(p => {
      if (!p.startDate) return false;
      const pDate = new Date(p.startDate);
      const inMonth = pDate.getFullYear() === year && pDate.getMonth() === month;
      if (!inMonth) return false;
      if (selectedStatus !== 'ALL' && p.status !== selectedStatus) return false;
      if (selectedDate && p.startDate !== selectedDate) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [actualProjects, year, month, selectedStatus, selectedDate, sideSearch]);

  return (
    <div className="px-6 pt-6 pb-16 space-y-6 max-w-7xl mx-auto w-full">

      {/* ══════════════════════════════════════════
          TOP HEADER ROW
      ══════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              className="text-3xl font-black tracking-tight text-slate-900 dark:text-white"
              style={{ fontFamily: 'Manrope, Inter, sans-serif' }}
            >
              Survey Calendar
            </h1>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300">
              {monthName} {year}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Click any date or survey card to inspect site details, assigned technicians, and status.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 mr-1">Filters:</span>
          {[
            { key: 'ALL', label: `All (${monthStats.total})` },
            { key: 'Pending', label: `Pending (${monthStats.pending})` },
            { key: 'In Progress', label: `In Progress (${monthStats.inProgress})` },
            { key: 'Completed', label: `Completed (${monthStats.completed})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedStatus(key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border cursor-pointer ${
                selectedStatus === key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          4 STAT CARDS ROW
      ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
        {/* Total Surveys */}
        <div
          onClick={() => { setSelectedStatus('ALL'); setSelectedDate(null); }}
          className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 shadow-xs flex items-center gap-4 transition-all hover:shadow-md cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
            {/* Filled clipboard-list icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="14" height="17" rx="2.5" />
              <rect x="9" y="2" width="6" height="3" rx="1" className="fill-white dark:fill-slate-800" />
              <rect x="7.5" y="9.25" width="2" height="2" rx="1" className="fill-white dark:fill-slate-800" />
              <rect x="11" y="9.25" width="6" height="2" rx="1" className="fill-white dark:fill-slate-800" />
              <rect x="7.5" y="13.25" width="2" height="2" rx="1" className="fill-white dark:fill-slate-800" />
              <rect x="11" y="13.25" width="6" height="2" rx="1" className="fill-white dark:fill-slate-800" />
              <rect x="7.5" y="17.25" width="2" height="2" rx="1" className="fill-white dark:fill-slate-800" />
              <rect x="11" y="17.25" width="4" height="2" rx="1" className="fill-white dark:fill-slate-800" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block mb-0.5">Total Surveys</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{monthStats.total}</span>
              <span className="text-xs font-medium text-slate-400">scheduled</span>
            </div>
          </div>
        </div>

        {/* Pending */}
        <div
          onClick={() => { setSelectedStatus('Pending'); setSelectedDate(null); }}
          className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 shadow-xs flex items-center gap-4 transition-all hover:shadow-md cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 text-amber-500 flex items-center justify-center shrink-0 shadow-2xs">
            {/* Document with clock badge icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 3.5H13l4 4v12.25a.75.75 0 01-.75.75H6.5a.75.75 0 01-.75-.75V4.25a.75.75 0 01.75-.75z" />
              <path strokeLinecap="round" d="M8.75 9.5h5M8.75 12.75h3" />
              <circle cx="16" cy="16" r="3.35" className="fill-white dark:fill-slate-800" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 14.5v1.6l1 .9" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block mb-0.5">Pending</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{monthStats.pending}</span>
              <span className="text-xs font-medium text-slate-400">awaiting</span>
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => { setSelectedStatus('In Progress'); setSelectedDate(null); }}
          className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 shadow-xs flex items-center gap-4 transition-all hover:shadow-md cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
            {/* Repeat / sync loop icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block mb-0.5">In Progress</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{monthStats.inProgress}</span>
              <span className="text-xs font-medium text-slate-400">on-site</span>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => { setSelectedStatus('Completed'); setSelectedDate(null); }}
          className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 shadow-xs flex items-center gap-4 transition-all hover:shadow-md cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-2xs">
            {/* Filled green check-circle icon */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" className="fill-emerald-500 dark:fill-emerald-500" />
              <path d="M8 12.4l2.6 2.6L16.2 9" stroke="white" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">Completed</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{monthStats.completed}</span>
              <span className="text-xs font-medium text-slate-400">finalized</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN TWO-COLUMN CALENDAR & PANEL GRID
      ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">

        {/* Left Column: Calendar Month View (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#131B2E] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header: Month title, controls */}
            <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {monthName} {year}
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={handleToday}
                  className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  Today
                </button>
              </div>

              {/* Month view dropdown selector pill */}
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  <span>Month</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Days of Week Row */}
            <div className="grid grid-cols-7 text-center mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <span key={d} className="text-xs font-bold text-slate-400 py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Cells Grid (7x6) */}
            <div className="grid grid-cols-7 border-t border-l border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
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

                const isSelected = selectedDate === cell.dateString;
                const hasSurveys = filteredProjects.length > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(cell.dateString);
                      if (hasSurveys) {
                        setSelectedDayProjects({ date: cell.dateString, projects: filteredProjects });
                      }
                    }}
                    className={`min-h-[72px] sm:min-h-[82px] p-2 border-r border-b border-slate-200/80 dark:border-slate-800 flex flex-col justify-between transition-all cursor-pointer relative group ${
                      !cell.isCurrentMonth
                        ? 'bg-slate-50/40 dark:bg-slate-900/30'
                        : isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/40'
                        : 'bg-white dark:bg-[#131B2E] hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-bold ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : isToday
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                            : !cell.isCurrentMonth
                            ? 'text-slate-300 dark:text-slate-600'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {cell.day}
                      </span>
                    </div>

                    {/* Event indicators */}
                    {hasSurveys && (
                      <div className="mt-1 space-y-1">
                        {filteredProjects.slice(0, 2).map(proj => {
                          const isPending = proj.status === 'Pending';
                          const isCompleted = proj.status === 'Completed' || proj.status?.includes('Finalized');
                          return (
                            <div
                              key={proj.id}
                              onClick={e => { e.stopPropagation(); onSelectProject(proj); }}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate ${
                                isPending
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  : isCompleted
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              }`}
                            >
                              {proj.name}
                            </div>
                          );
                        })}
                        {filteredProjects.length > 2 && (
                          <span className="text-[8px] font-bold text-slate-400 block pl-1">
                            +{filteredProjects.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Scheduled Surveys Side Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131B2E] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative min-h-[480px]">
          <div>
            {/* Header: Title + Search */}
            <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white leading-snug">
                  {selectedDate ? `Scheduled Surveys for ${selectedDate}` : `All Scheduled Surveys in ${monthName} ${year}`}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  {monthProjects.length} {monthProjects.length === 1 ? 'project survey' : 'project surveys'} found
                </p>
              </div>

              {/* Search input */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search surveys..."
                  value={sideSearch}
                  onChange={e => setSideSearch(e.target.value)}
                  className="w-36 sm:w-40 pl-8 pr-3 py-1.5 rounded-full text-[11px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* List / Empty State */}
            {monthProjects.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white mb-1">
                  No surveys scheduled for {monthName}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  No surveys scheduled for {monthName} with the selected filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {monthProjects.map(proj => {
                  const cfg = statusConfig[proj.status] || { label: proj.status, color: '#2563EB', bg: 'rgba(37,99,235,0.08)', dot: '#2563EB' };
                  return (
                    <div
                      key={proj.id}
                      onClick={() => onSelectProject(proj)}
                      className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 bg-slate-50/50 dark:bg-slate-800/40 transition-all cursor-pointer group flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 truncate">
                          {proj.clientName}
                        </span>
                        <span
                          className="text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {proj.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                        {proj.name}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>📍 {proj.location || 'Location not set'}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 group-hover:underline">View →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


        </div>

      </div>

      {/* Day Details Modal */}
      {selectedDayProjects && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#131B2E] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">Scheduled Surveys</h3>
                <p className="text-xs text-slate-400 font-medium">{selectedDayProjects.date}</p>
              </div>
              <button
                onClick={() => setSelectedDayProjects(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 flex items-center justify-center text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedDayProjects.projects.map(proj => (
                <div
                  key={proj.id}
                  onClick={() => { setSelectedDayProjects(null); onSelectProject(proj); }}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50 dark:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">{proj.name}</h4>
                    <p className="text-[10px] text-slate-400">{proj.clientName} • {proj.location}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {proj.status}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedDayProjects(null)}
              className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}