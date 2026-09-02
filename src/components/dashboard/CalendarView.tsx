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
  'Pending':             { label: 'Pending',     color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', dot: '#F59E0B' },
  'In Progress':         { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', dot: '#3B82F6' },
  'Completed':           { label: 'Completed',   color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981' },
  'Finalized - Approved':{ label: 'Approved',    color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981' },
  'Finalized - Rejected':{ label: 'Rejected',    color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)',  dot: '#EF4444' },
  'Finalized':           { label: 'Finalized',   color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)', dot: '#A855F7' },
};

export default function CalendarView({ projects, onSelectProject, userRole, isDark = false }: CalendarViewProps) {
  const theme = getRoleTheme(userRole);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // Create calendar cells array (42 cells: 6 rows x 7 cols)
  const cells = useMemo(() => {
    const arr = [];
    // Previous Month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateString = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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

  // Month projects list
  const monthProjects = useMemo(() => {
    return actualProjects.filter(p => {
      if (!p.startDate) return false;
      const pDate = new Date(p.startDate);
      const inMonth = pDate.getFullYear() === year && pDate.getMonth() === month;
      if (!inMonth) return false;
      if (selectedStatus !== 'ALL' && p.status !== selectedStatus) return false;
      if (selectedDate && p.startDate !== selectedDate) return false;
      return true;
    });
  }, [actualProjects, year, month, selectedStatus, selectedDate]);

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
    <div className="px-4 sm:px-6 pt-6 pb-16 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Quick Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-2xl font-black tracking-tight"
              style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontFamily: 'Manrope, Inter, sans-serif' }}
            >
              Survey Calendar
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {monthName} {year}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            Click any date or survey card to inspect site details, assigned technicians, and status
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
          {[
            { key: 'ALL', label: `All (${monthStats.total})` },
            { key: 'Pending', label: `Pending (${monthStats.pending})` },
            { key: 'In Progress', label: `In Progress (${monthStats.inProgress})` },
            { key: 'Completed', label: `Completed (${monthStats.completed})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedStatus(key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer ${
                selectedStatus === key
                  ? ''
                  : isDark
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
              }`}
              style={
                selectedStatus === key
                  ? { background: theme.primary, color: '#ffffff', borderColor: theme.primary, boxShadow: `0 4px 12px ${theme.primary}35` }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => { setSelectedStatus('ALL'); setSelectedDate(null); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'ALL' && !selectedDate
              ? 'ring-2 ring-blue-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Surveys</div>
          <div className="text-xl font-black mt-0.5">{monthStats.total} <span className="text-xs font-medium text-slate-400">scheduled</span></div>
        </div>

        <div
          onClick={() => { setSelectedStatus('Pending'); setSelectedDate(null); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'Pending'
              ? 'ring-2 ring-amber-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-amber-950/20 border-amber-900/40 text-amber-300' : 'bg-amber-50/60 border-amber-200 text-amber-900'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
          </div>
          <div className="text-xl font-black mt-0.5">{monthStats.pending} <span className="text-xs font-semibold text-amber-600/80">awaiting</span></div>
        </div>

        <div
          onClick={() => { setSelectedStatus('In Progress'); setSelectedDate(null); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'In Progress'
              ? 'ring-2 ring-blue-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-blue-950/20 border-blue-900/40 text-blue-300' : 'bg-blue-50/60 border-blue-200 text-blue-900'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> In Progress
          </div>
          <div className="text-xl font-black mt-0.5">{monthStats.inProgress} <span className="text-xs font-semibold text-blue-600/80">on-site</span></div>
        </div>

        <div
          onClick={() => { setSelectedStatus('Completed'); setSelectedDate(null); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'Completed'
              ? 'ring-2 ring-emerald-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed
          </div>
          <div className="text-xl font-black mt-0.5">{monthStats.completed} <span className="text-xs font-semibold text-emerald-600/80">finalized</span></div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div
        className={`rounded-3xl border overflow-hidden transition-all shadow-sm ${
          isDark
            ? 'bg-[#0D1527] border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Navigation Bar */}
        <div
          className={`flex flex-wrap items-center justify-between px-6 py-4 border-b gap-3 ${
            isDark
              ? 'border-slate-800 bg-slate-900/70'
              : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {monthName} {year}
            </h2>
            <button
              onClick={handleToday}
              className={`px-3 py-1 text-[11px] font-extrabold uppercase rounded-lg border transition-all cursor-pointer ${
                isDark
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-500/30'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-2xs'
              }`}
            >
              Today
            </button>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Clear Day Filter
              </button>
            )}
          </div>

          {/* Month Controls & Arrows */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isDark
                    ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isDark
                    ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                }`}
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div
          className={`grid grid-cols-7 border-b text-center py-2.5 ${
            isDark
              ? 'border-slate-800 bg-slate-900/40 text-slate-400'
              : 'border-slate-100 bg-slate-50/90 text-slate-500'
          }`}
        >
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <span
              key={d}
              className="text-[11px] font-black uppercase tracking-wider"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Grid Cells */}
        <div
          className={`grid grid-cols-7 grid-rows-6 divide-x divide-y ${
            isDark
              ? 'divide-slate-800/70 bg-[#0D1527]'
              : 'divide-slate-100 bg-white'
          }`}
        >
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
                className={`min-h-[110px] sm:min-h-[120px] p-2 flex flex-col justify-between transition-all relative cursor-pointer group ${
                  !cell.isCurrentMonth
                    ? isDark
                      ? 'bg-slate-950/40 opacity-30 hover:opacity-50'
                      : 'bg-slate-50/50 opacity-40 hover:opacity-70'
                    : isSelected
                    ? isDark
                      ? 'bg-blue-950/40 ring-2 ring-blue-500/60 inset-0'
                      : 'bg-blue-50/60 ring-2 ring-blue-500/50'
                    : isToday
                    ? isDark
                      ? 'bg-blue-950/20'
                      : 'bg-blue-50/30'
                    : isDark
                    ? 'bg-[#0D1527] hover:bg-slate-800/40'
                    : 'bg-white hover:bg-slate-50/80'
                }`}
              >
                {/* Top bar in cell: Date Number & Count Badge */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                      isToday
                        ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40'
                        : isSelected
                        ? 'bg-slate-800 text-white font-bold'
                        : !cell.isCurrentMonth
                        ? isDark ? 'text-slate-600' : 'text-slate-300'
                        : isDark ? 'text-slate-200 font-bold' : 'text-slate-700 font-bold'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {hasSurveys && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                        isDark
                          ? 'text-blue-300 bg-blue-950 border-blue-800'
                          : 'text-blue-700 bg-blue-50 border-blue-200'
                      }`}
                    >
                      {filteredProjects.length} {filteredProjects.length === 1 ? 'Survey' : 'Surveys'}
                    </span>
                  )}
                </div>

                {/* Projects Event Badges */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[75px] no-scrollbar">
                  {filteredProjects.map(proj => {
                    const cfg = statusConfig[proj.status] ||
                      Object.entries(statusConfig).find(([key]) => proj.status && proj.status.includes(key))?.[1] || {
                        label: proj.status || 'Project',
                        color: isDark ? '#94A3B8' : '#475569',
                        bg: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                        dot: '#94A3B8'
                      };

                    const systemTag = proj.systemTypes && proj.systemTypes.length > 0 ? proj.systemTypes[0] : '';

                    return (
                      <div
                        key={proj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj);
                        }}
                        className={`text-[10px] font-bold p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-0.5 hover:scale-[1.02] shadow-2xs ${
                          isDark
                            ? 'border-slate-800 hover:border-slate-700'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                        style={{ background: cfg.bg, color: cfg.color }}
                        title={`${proj.name} (${proj.clientName}) — Click to view details`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                          <span className="truncate font-black">{proj.name}</span>
                        </div>
                        {systemTag && (
                          <span className="text-[8px] font-semibold opacity-75 truncate pl-3">
                            {systemTag} • {proj.clientName || 'Survey'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Scheduled Surveys Agenda List */}
      <div
        className={`rounded-3xl border p-6 space-y-4 shadow-sm ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-100">
          <div>
            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {selectedDate ? `Scheduled Surveys for ${selectedDate}` : `All Scheduled Surveys in ${monthName} ${year}`}
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              {monthProjects.length} {monthProjects.length === 1 ? 'project survey' : 'project surveys'} found
            </p>
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Show all for {monthName}
            </button>
          )}
        </div>

        {monthProjects.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium">
            No surveys scheduled {selectedDate ? `for ${selectedDate}` : `for ${monthName} with the selected filters`}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthProjects.map(proj => {
              const cfg = statusConfig[proj.status] || { label: proj.status, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' };
              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 hover:scale-[1.01] shadow-2xs ${
                    isDark
                      ? 'bg-slate-800/50 border-slate-700/60 hover:border-blue-500/50'
                      : 'bg-slate-50/70 border-slate-200 hover:border-blue-400 hover:bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {proj.name}
                      </h4>
                      <span
                        className="text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 border border-current"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {proj.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-medium truncate">
                      {proj.clientName} {proj.location ? `• ${proj.location}` : ''}
                    </p>

                    {proj.systemTypes && proj.systemTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.systemTypes.map(s => (
                          <span
                            key={s}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold">
                      📅 {proj.startDate || 'No date'}
                    </span>
                    <span className="font-bold text-blue-600 hover:underline">
                      Open Project →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Day Quick View Modal */}
      {selectedDayProjects && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            className={`border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Scheduled Surveys</h3>
                <p className="text-xs text-slate-400">{selectedDayProjects.date}</p>
              </div>
              <button
                onClick={() => setSelectedDayProjects(null)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
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
                    className={`p-3 border rounded-2xl transition-all cursor-pointer flex items-center justify-between ${
                      isDark
                        ? 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{proj.name}</h4>
                      <p className="text-xs text-slate-400">{proj.clientName} • {proj.location}</p>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        isDark ? 'border-slate-700' : 'border-slate-200'
                      }`}
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
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
