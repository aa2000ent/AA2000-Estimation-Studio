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
  const [agendaSearch, setAgendaSearch] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [jumpDate, setJumpDate] = useState('');

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
  const handleJumpToDate = (dateString: string) => {
    if (!dateString) return;
    const [targetYear, targetMonth, targetDay] = dateString.split('-').map(Number);
    setCurrentDate(new Date(targetYear, targetMonth - 1, targetDay));
    setSelectedDate(dateString);
    setShowDatePicker(false);
  };
  const toggleDatePicker = () => {
    if (!showDatePicker) {
      setJumpDate(selectedDate || `${year}-${String(month + 1).padStart(2, '0')}-01`);
    }
    setShowDatePicker(open => !open);
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

  const visibleMonthProjects = useMemo(() => {
    const query = agendaSearch.trim().toLowerCase();
    if (!query) return monthProjects;
    return monthProjects.filter(project =>
      project.name.toLowerCase().includes(query) ||
      project.clientName.toLowerCase().includes(query) ||
      project.location.toLowerCase().includes(query)
    );
  }, [monthProjects, agendaSearch]);

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
    <div className="px-4 sm:px-6 pt-5 pb-16 space-y-5 w-full">
      {/* Header & Quick Filter Pills */}
      <div className="flex flex-wrap items-start justify-between gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontFamily: 'Manrope, Inter, sans-serif' }}
            >
              Survey Calendar
            </h1>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                isDark
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-900/50'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => { setSelectedStatus('ALL'); setSelectedDate(null); }}
          className={`h-24 lg:h-28 xl:h-32 px-5 py-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
            selectedStatus === 'ALL' && !selectedDate
              ? 'ring-2 ring-blue-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-blue-950/20 border-blue-900/40 text-blue-200' : 'bg-blue-50 border-blue-200 text-slate-800'
          }`}
        >
          <span className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-900/50' : 'bg-white'}`}>
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.25H6.75A2.25 2.25 0 004.5 7.5v11.25A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H15M9 5.25a3 3 0 006 0M9 5.25a3 3 0 016 0M8.25 12h7.5m-7.5 3.75h5.25" />
            </svg>
          </span>
          <div>
            <div className="text-[11px] font-bold text-blue-600">Total Surveys</div>
            <div className="text-2xl font-black mt-1">{monthStats.total} <span className="text-[10px] font-medium text-slate-400">scheduled</span></div>
          </div>
        </div>

        <div
          onClick={() => { setSelectedStatus('Pending'); setSelectedDate(null); }}
          className={`h-24 lg:h-28 xl:h-32 px-5 py-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
            selectedStatus === 'Pending'
              ? 'ring-2 ring-amber-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-amber-950/20 border-amber-900/40 text-amber-300' : 'bg-amber-50/60 border-amber-200 text-amber-900'
          }`}
        >
          <span className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-900/40' : 'bg-white'}`}>
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-9A2.25 2.25 0 0017.25 3h-10.5A2.25 2.25 0 004.5 5.25v13.5A2.25 2.25 0 006.75 21h6.75M8.25 7.5h7.5m-7.5 3h5.25m4.5 6v2.25m0 0V21m0-2.25h2.25m-2.25 0h-2.25" />
            </svg>
          </span>
          <div>
            <div className="text-[11px] font-bold text-amber-600">Pending</div>
            <div className="text-2xl font-black mt-1">{monthStats.pending} <span className="text-[10px] font-semibold text-amber-600/80">awaiting</span></div>
          </div>
        </div>

        <div
          onClick={() => { setSelectedStatus('In Progress'); setSelectedDate(null); }}
          className={`h-24 lg:h-28 xl:h-32 px-5 py-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
            selectedStatus === 'In Progress'
              ? 'ring-2 ring-blue-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-blue-950/20 border-blue-900/40 text-blue-300' : 'bg-blue-50/60 border-blue-200 text-blue-900'
          }`}
        >
          <span className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-900/50' : 'bg-white'}`}>
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5M16.5 3L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </span>
          <div>
            <div className="text-[11px] font-bold text-blue-600">In Progress</div>
            <div className="text-2xl font-black mt-1">{monthStats.inProgress} <span className="text-[10px] font-semibold text-blue-600/80">on-site</span></div>
          </div>
        </div>

        <div
          onClick={() => { setSelectedStatus('Completed'); setSelectedDate(null); }}
          className={`h-24 lg:h-28 xl:h-32 px-5 py-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
            selectedStatus === 'Completed'
              ? 'ring-2 ring-emerald-500/50 shadow-sm'
              : ''
          } ${
            isDark ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
          }`}
        >
          <span className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-900/40' : 'bg-white'}`}>
            <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 9.75m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <div className="text-[11px] font-bold text-emerald-600">Completed</div>
            <div className="text-2xl font-black mt-1">{monthStats.completed} <span className="text-[10px] font-semibold text-emerald-600/80">finalized</span></div>
          </div>
        </div>
      </div>

      {/* Calendar and agenda workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] gap-4 items-stretch">
      <div
        className={`h-full rounded-2xl border overflow-hidden transition-all shadow-sm ${
          isDark
            ? 'bg-[#0D1527] border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Navigation Bar */}
        <div
          className={`relative z-30 min-h-[62px] flex flex-wrap items-center justify-between px-4 py-3 border-b gap-3 ${
            isDark
              ? 'border-slate-800 bg-slate-900/70'
              : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {monthName} {year}
            </h2>
            <button
              onClick={handleNextMonth}
              aria-label="Next month"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
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

          <div className="relative">
            <button
              type="button"
              onClick={toggleDatePicker}
              aria-expanded={showDatePicker}
              className={`h-9 px-4 rounded-xl border text-[11px] font-bold flex items-center gap-2 cursor-pointer transition-colors ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Month
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showDatePicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDatePicker && (
              <div className={`absolute right-0 top-11 z-50 w-56 rounded-2xl border p-4 shadow-xl animate-scale-in ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <label className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Jump to a date
                </label>
                <input
                  type="date"
                  value={jumpDate}
                  onChange={event => setJumpDate(event.target.value)}
                  className={`w-full h-10 rounded-xl border px-3 text-xs font-semibold outline-none cursor-pointer ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                />
                <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
                  Browse freely, then confirm the exact date below.
                </p>
                <button
                  type="button"
                  disabled={!jumpDate}
                  onClick={() => handleJumpToDate(jumpDate)}
                  className="w-full mt-3 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[10px] font-black transition-colors cursor-pointer"
                >
                  Go to date
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Days of Week Header */}
        <div
          className={`grid grid-cols-7 border-b text-center py-2 ${
            isDark
              ? 'border-slate-800 bg-slate-900/40 text-slate-400'
              : 'border-slate-100 bg-slate-50/90 text-slate-500'
          }`}
        >
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <span
              key={d}
              className="text-[9px] font-black uppercase tracking-wider"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Grid Cells */}
        <div
          className={`relative z-0 grid grid-cols-7 grid-rows-6 divide-x divide-y ${
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
                className={`min-h-[80px] lg:min-h-[74px] p-2 flex flex-col justify-between transition-all relative cursor-pointer group ${
                  !cell.isCurrentMonth
                    ? isDark
                      ? 'bg-slate-950/40 opacity-50 hover:opacity-70'
                      : 'bg-slate-50/70 hover:bg-slate-100/70'
                    : isSelected
                    ? isDark
                      ? 'bg-blue-950/40 ring-2 ring-inset ring-blue-500/60'
                      : 'bg-blue-50/60 ring-2 ring-inset ring-blue-500/50'
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
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[32px] no-scrollbar">
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
        className={`rounded-2xl border p-4 shadow-sm flex flex-col min-h-[560px] lg:h-[560px] ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className={`flex flex-wrap items-start justify-between gap-3 border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="min-w-0 flex-1">
            <h3 className={`text-sm font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {selectedDate ? `Scheduled Surveys for ${selectedDate}` : `All Scheduled Surveys in ${monthName} ${year}`}
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-1">
              {visibleMonthProjects.length} {visibleMonthProjects.length === 1 ? 'project survey' : 'project surveys'} found
            </p>
          </div>
          <div className="relative w-full sm:w-40">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={agendaSearch}
              onChange={event => setAgendaSearch(event.target.value)}
              placeholder="Search surveys..."
              className={`w-full h-9 pl-8 pr-3 rounded-xl border text-[10px] outline-none transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' : 'bg-white border-slate-200 text-slate-700 focus:border-blue-400'}`}
            />
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

        {visibleMonthProjects.length === 0 ? (
          <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center px-6">
            <span className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25v-5.25z" />
              </svg>
            </span>
            <p className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>No surveys scheduled for {monthName}</p>
            <p className="text-[10px] text-slate-400 mt-2 max-w-xs">
              {agendaSearch ? 'No surveys match your search.' : `No surveys are scheduled for ${monthName} with the selected filters.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4 overflow-y-auto max-h-[400px] pr-1 no-scrollbar">
            {visibleMonthProjects.map(proj => {
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
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isDark
                                ? 'bg-blue-950/60 text-blue-300 border border-blue-900/40'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${
                    isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-200/60 text-slate-500'
                  }`}>
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
