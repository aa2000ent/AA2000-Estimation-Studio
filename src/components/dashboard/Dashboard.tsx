import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { User, Project, AIScanGroup } from '../../App';
import CreateProjectModal from '../projects/CreateProjectModal';
import EditProjectModal from '../projects/EditProjectModal';
import Sidebar from './Sidebar';
import type { View } from './Sidebar';
import NotificationBell from '../notifications/NotificationBell';
import type { Notification } from '../notifications/NotificationBell';
import Home from './Home';
import CompanyDetail from '../projects/CompanyDetail';
import AccountDropdown from './AccountDropdown';
import { getRoleTheme } from '../../utils/RoleTheme';
import CalendarView from './CalendarView';
import { SkeletonStatCard, SkeletonProjectRow, SkeletonTable } from '../utils/Skeleton';
import { StatBuilding, StatClipboard, StatBolt, StatCalendar, StatCheckCircle, ChartBar, Bell, RoleWrench, RoleChart, RoleComputer } from '../../utils/Icons';
import AISidebar from '../ai-sidebar/AISidebar';
import FloorPlanView from '../floor-plan/FloorPlanView';
import EstimationHub from '../estimation/EstimationHub';
import SavedBOQsView from '../floor-plan/SavedBOQsView';
import SavedEstimationsView from '../estimation/SavedEstimationsView';
import SavedFoldersView from '../ai-sidebar/SavedFoldersView';
import { AIChatbotFloating } from '../chatbot/AIChatbotFloating';

interface Props {
  user: User;
  onLogout: () => void;
  projects: Project[];
  notifications: Notification[];
  onSelectProject: (project: Project) => void;
  onCreateProject: (project: Project, keepOnHome?: boolean) => void;
  onSettings: () => void;
  onNavigateToCreate: () => void;
  selectedCompanyProject: Project | null;
  setSelectedCompanyProject: (project: Project | null) => void;
  onMarkNotificationsAsRead?: (type: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onUpdateProject?: (project: Project) => void;
  aiScans?: AIScanGroup[];
  onSaveAIScan?: (scan: AIScanGroup) => void;
  onRenameAIScan?: (id: string, name: string) => void;
  onDeleteAIScan?: (id: string) => void;
  onUpdateAIScan?: (scan: AIScanGroup) => void;
  contentOverride?: React.ReactNode;
  activeViewOverride?: View;
  onExitOverride?: () => void;
}

type SortMode = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

const CATEGORY_VIEW_TO_KEY: Record<string, string> = {
  cctv: 'CCTV',
  fire_alarm: 'FIRE_ALARM',
  fire_protection: 'FIRE_PROTECTION',
  access_control: 'ACCESS_CONTROL',
  burglar_alarm: 'BURGLAR_ALARM',
  other: 'OTHER',
};

const categoryViews = ['cctv', 'fire_alarm', 'fire_protection', 'access_control', 'burglar_alarm', 'other'];

const viewTitles: Record<string, string> = {
  home: 'Home', dashboard: 'Dashboard', workspace: 'Workspace', todo: 'To-do',
  assignment: 'All Projects', missing: 'Missing Requirements', done: 'Done',
  history: 'History / Archive', approval: 'Approval Pipeline', finalize: 'Finalize Review',
  ongoing: 'Ongoing Surveys', upcoming: 'Upcoming Surveys', 'missing-notif': 'Missing Alerts',
  'approval-notif': 'Approval Alerts', 'finalize-notif': 'Finalize Alerts',
  notifications: 'All Notifications',
  'ai-reader': 'AI Document Reader',
  'estimation-hub': 'Estimation Hub',
  'floor-plan': 'Floor Plan AI',
  'saved-folders': 'AI Scan Folders',
  'saved-boqs': 'Saved Floor Plan BOQs',
  'saved-estimations': 'Saved Project Estimations',
};

function filterProjects(projects: Project[], view: string): Project[] {
  const actualProjects = projects.filter(p => p.buildingType !== 'Other');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  switch (view) {
    case 'workspace': case 'todo': case 'manual-survey':
      return actualProjects.filter(p => p.status === 'Pending' || p.status === 'In Progress' || p.status === 'Finalized' || p.status === 'Finalized - Rejected');
    case 'assignment': case 'floor-plan': return actualProjects;
    case 'missing': return actualProjects.filter(p => {
      const isCompleted = p.status === 'Completed' || p.status === 'Finalized - Approved';
      return !isCompleted && (!p.startDate || p.startDate < today);
    });
    case 'done': return actualProjects.filter(p => p.status === 'Completed' || p.status === 'Finalized - Approved');
    case 'history': return actualProjects.filter(p => p.status === 'Completed' || p.status === 'Finalized - Approved' || p.status === 'Finalized - Rejected');
    case 'ongoing':
      return actualProjects.filter(p => {
        const isCompleted = p.status === 'Completed' || p.status === 'Finalized - Approved';
        return !isCompleted && p.startDate === today;
      });
    case 'upcoming':
      return actualProjects.filter(p => {
        const isCompleted = p.status === 'Completed' || p.status === 'Finalized - Approved';
        return !isCompleted && !!p.startDate && p.startDate > today;
      });
    case 'missing-notif':
      return actualProjects.filter(p => {
        const isCompleted = p.status === 'Completed' || p.status === 'Finalized - Approved';
        return !isCompleted && (!p.startDate || p.startDate < today);
      });
    case 'approval': case 'approval-notif':
      return actualProjects.filter(p => p.status === 'Finalized');
    case 'finalize': case 'finalize-notif':
      return actualProjects.filter(
        p => p.status === 'Finalized - Approved' || p.status === 'Finalized - Rejected' || p.status === 'Completed'
      );
    default: return actualProjects;
  }
}

function sortProjects(projects: Project[], sort: SortMode): Project[] {
  const s = [...projects];
  switch (sort) {
    case 'newest': return s.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'oldest': return s.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'name-asc': return s.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc': return s.sort((a, b) => b.name.localeCompare(a.name));
  }
}

const statusConfig: Record<string, { color: string; bg: string; bar: string }> = {
  'In Progress': { color: '#2563EB', bg: 'rgba(37,99,235,0.08)', bar: '#2563EB' },
  'Pending': { color: '#D97706', bg: 'rgba(217,119,6,0.08)', bar: '#D97706' },
  'Completed': { color: '#059669', bg: 'rgba(5,150,105,0.08)', bar: '#059669' },
  'Finalized - Approved': { color: '#059669', bg: 'rgba(5,150,105,0.08)', bar: '#059669' },
  'Finalized - Rejected': { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', bar: '#DC2626' },
  'Finalized': { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', bar: '#7C3AED' },
};

function StatusBadge({ status }: { status: string }) {
  const isSurvey = status === 'Pending' || status === 'In Progress' || status === 'Finalized - Rejected';
  const isReview = status === 'Finalized';
  const isApproved = status === 'Completed' || status === 'Finalized - Approved';

  const label = isReview ? 'Awaiting Approval' : isApproved ? 'Approved' : 'Survey In Progress';
  const cfg = isReview 
    ? { color: '#CA8A04', bg: 'rgba(202,138,4,0.08)' }
    : isApproved 
    ? { color: '#16A34A', bg: 'rgba(22,163,74,0.08)' }
    : { color: '#2563EB', bg: 'rgba(37,99,235,0.08)' };

  return (
    <span
      className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {label}
    </span>
  );
}

const typeConfig = {
  ongoing: { color: '#2563EB', bg: 'rgba(37,99,235,0.08)', label: 'Ongoing', dot: '#2563EB' },
  upcoming: { color: '#059669', bg: 'rgba(5,150,105,0.08)', label: 'Upcoming', dot: '#059669' },
  missing: { color: '#D97706', bg: 'rgba(217,119,6,0.08)', label: 'Missing', dot: '#D97706' },
  approval: { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', label: 'Approval', dot: '#7C3AED' },
  finalize: { color: '#059669', bg: 'rgba(5,150,105,0.08)', label: 'Finalize', dot: '#059669' },
};

// Status Overview Banner matching exact layout from user with Minimalistic Donut / Pie Graph & Smooth Animations
function StatusOverviewBanner({
  totalProjects,
  inProgressCount,
  pendingCount,
  completedCount,
}: {
  totalProjects: number;
  inProgressCount: number;
  pendingCount: number;
  completedCount: number;
}) {
  const [hoveredStatus, setHoveredStatus] = React.useState<string | null>(null);

  const r = 38;
  const C = 2 * Math.PI * r; // ~238.76

  const inProgLen = totalProjects > 0 ? (inProgressCount / totalProjects) * C : 0;
  const pendingLen = totalProjects > 0 ? (pendingCount / totalProjects) * C : 0;
  const compLen = totalProjects > 0 ? (completedCount / totalProjects) * C : 0;

  const inProgOffset = 0;
  const pendingOffset = -inProgLen;
  const compOffset = -(inProgLen + pendingLen);

  return (
    <div className="bg-white dark:bg-[#131B2E] rounded-3xl p-6 sm:p-7 border border-blue-100/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-8 animate-fade-in-up">
      {/* Left: Minimalistic Pie / Donut Chart with total projects & interactive animations */}
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0 group/donut transition-transform duration-300 hover:scale-105">
          <svg className="w-full h-full transform -rotate-90 filter drop-shadow-xs" viewBox="0 0 96 96">
            {/* Background track */}
            <circle
              cx="48"
              cy="48"
              r={r}
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeWidth="8"
              fill="none"
            />

            {totalProjects === 0 ? (
              <circle
                cx="48"
                cy="48"
                r={r}
                stroke="#DBEAFE"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${C * 0.2} ${C}`}
                strokeLinecap="round"
                className="animate-donut-draw"
              />
            ) : (
              <>
                {/* In Progress Segment (AA2000 Blue) */}
                {inProgressCount > 0 && (
                  <circle
                    cx="48"
                    cy="48"
                    r={r}
                    stroke="#2563EB"
                    strokeWidth={hoveredStatus === 'in-progress' ? 10 : 8}
                    fill="none"
                    strokeDasharray={`${inProgLen} ${C}`}
                    strokeDashoffset={inProgOffset}
                    strokeLinecap="round"
                    className="transition-all duration-500 animate-donut-draw cursor-pointer"
                    style={{
                      opacity: hoveredStatus && hoveredStatus !== 'in-progress' ? 0.35 : 1,
                      filter: hoveredStatus === 'in-progress' ? 'drop-shadow(0 0 6px rgba(37,99,235,0.4))' : undefined,
                    }}
                  />
                )}
                {/* Pending Segment (Orange / Amber) */}
                {pendingCount > 0 && (
                  <circle
                    cx="48"
                    cy="48"
                    r={r}
                    stroke="#F59E0B"
                    strokeWidth={hoveredStatus === 'pending' ? 10 : 8}
                    fill="none"
                    strokeDasharray={`${pendingLen} ${C}`}
                    strokeDashoffset={pendingOffset}
                    strokeLinecap="round"
                    className="transition-all duration-500 animate-donut-draw cursor-pointer"
                    style={{
                      opacity: hoveredStatus && hoveredStatus !== 'pending' ? 0.35 : 1,
                      filter: hoveredStatus === 'pending' ? 'drop-shadow(0 0 6px rgba(245,158,11,0.4))' : undefined,
                    }}
                  />
                )}
                {/* Completed Segment (Emerald / Green) */}
                {completedCount > 0 && (
                  <circle
                    cx="48"
                    cy="48"
                    r={r}
                    stroke="#10B981"
                    strokeWidth={hoveredStatus === 'completed' ? 10 : 8}
                    fill="none"
                    strokeDasharray={`${compLen} ${C}`}
                    strokeDashoffset={compOffset}
                    strokeLinecap="round"
                    className="transition-all duration-500 animate-donut-draw cursor-pointer"
                    style={{
                      opacity: hoveredStatus && hoveredStatus !== 'completed' ? 0.35 : 1,
                      filter: hoveredStatus === 'completed' ? 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' : undefined,
                    }}
                  />
                )}
              </>
            )}
          </svg>

          {/* Center Value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none transition-transform duration-300 group-hover/donut:scale-110">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none animate-count">
              {totalProjects}
            </span>
            <span className="text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1.5">
              PROJECTS
            </span>
          </div>
        </div>
      </div>

      {/* Right: Status Overview Breakdown with interactive hover */}
      <div className="w-full sm:w-auto flex flex-col gap-2 sm:min-w-[220px]">
        <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
          STATUS OVERVIEW
        </span>

        {/* In Progress Row */}
        <div
          onMouseEnter={() => setHoveredStatus('in-progress')}
          onMouseLeave={() => setHoveredStatus(null)}
          className="flex items-center justify-between gap-8 text-xs sm:text-sm px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/40"
        >
          <span className="flex items-center gap-2.5 font-bold text-slate-700 dark:text-slate-300">
            <span className="relative flex h-3 w-3 items-center justify-center">
              {inProgressCount > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
            </span>
            In Progress
          </span>
          <span className="font-black text-slate-900 dark:text-white text-sm sm:text-base">{inProgressCount}</span>
        </div>

        {/* Pending Row */}
        <div
          onMouseEnter={() => setHoveredStatus('pending')}
          onMouseLeave={() => setHoveredStatus(null)}
          className="flex items-center justify-between gap-8 text-xs sm:text-sm px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-amber-50/70 dark:hover:bg-amber-950/40"
        >
          <span className="flex items-center gap-2.5 font-bold text-slate-700 dark:text-slate-300">
            <span className="relative flex h-3 w-3 items-center justify-center">
              {pendingCount > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            Pending
          </span>
          <span className="font-black text-amber-600 dark:text-amber-400 text-sm sm:text-base">{pendingCount}</span>
        </div>

        {/* Completed Row */}
        <div
          onMouseEnter={() => setHoveredStatus('completed')}
          onMouseLeave={() => setHoveredStatus(null)}
          className="flex items-center justify-between gap-8 text-xs sm:text-sm px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40"
        >
          <span className="flex items-center gap-2.5 font-bold text-slate-700 dark:text-slate-300">
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Completed
          </span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">{completedCount}</span>
        </div>
      </div>
    </div>
  );
}

// Helper to generate clear, intuitive sparkline paths that reflect the exact status count and rate
function getSparklineData(value: number, total: number = 0) {
  if (value === 0) {
    return {
      linePath: 'M 2 28 L 98 28',
      areaPath: 'M 2 28 L 98 28 L 98 32 L 2 32 Z',
      dots: [{ cx: 98, cy: 28 }],
    };
  }

  // Calculate percentage of total to scale height
  const pct = total > 0 ? Math.min(1, value / total) : 1;
  // Peak Y: higher percentage = reaches closer to top (y = 6 to y = 22)
  const peakY = Math.max(5, 26 - Math.round(pct * 21));
  const midY = Math.round((28 + peakY) / 2);

  return {
    linePath: `M 2 28 C 24 28, 44 ${midY + 2}, 64 ${midY - 2} S 84 ${peakY + 2}, 98 ${peakY}`,
    areaPath: `M 2 28 C 24 28, 44 ${midY + 2}, 64 ${midY - 2} S 84 ${peakY + 2}, 98 ${peakY} L 98 32 L 2 32 Z`,
    dots: [
      { cx: 64, cy: midY - 2 },
      { cx: 98, cy: peakY },
    ],
  };
}

// Sparkline Card matching exact layout from user with Clear, Understandable Trendline & Context Badge
function SparklineCard({
  label,
  value,
  totalProjects = 0,
  sub,
  icon,
  onClick,
  delay = 0,
  valueColor,
}: {
  label: string;
  value: number;
  totalProjects?: number;
  sub: string;
  icon: React.ReactNode;
  onClick?: () => void;
  delay?: number;
  valueColor?: string;
}) {
  const color = valueColor || '#2563EB';
  const total = totalProjects > 0 ? totalProjects : Math.max(1, value);
  const percentage = totalProjects > 0 ? Math.round((value / totalProjects) * 100) : (value > 0 ? 100 : 0);

  const badgeText = label === 'PROJECTS'
    ? `${value} Total`
    : label === 'COMPLETED'
    ? `${percentage}% Done`
    : label === 'PENDING'
    ? `${percentage}% Queue`
    : `${percentage}% Active`;

  const { linePath, areaPath, dots } = getSparklineData(value, total);
  const gradId = `spark-grad-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${value}`;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#131B2E] rounded-3xl p-5 sm:p-6 border border-blue-100/70 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500/50 hover:-translate-y-1 cursor-pointer flex flex-col justify-between min-h-[145px] group animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle top gradient accent on hover matching status color */}
      <div
        className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, ${color} 0%, #3B82F6 100%)`,
        }}
      />

      {/* Top row: Label (Left) & Icon (Top-Right) */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-blue-600 group-hover:text-white shadow-2xs"
        >
          {icon}
        </div>
      </div>

      {/* Bottom row: Value & Subtitle (Left) + Understandable Analytics Graph (Bottom-Right) */}
      <div className="flex items-end justify-between gap-4 mt-auto">
        <div className="min-w-0">
          <p
            className="text-3xl sm:text-4xl font-black leading-none mb-1 transition-transform duration-200 group-hover:scale-105 origin-left animate-count"
            style={{ color }}
          >
            {value}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
            {sub}
          </p>
        </div>

        {/* Bottom-right: Clear Status Line Graph with Percentage Badge */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Understandable Percentage Pill */}
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider transition-all duration-200"
            style={{
              backgroundColor: value === 0 ? '#F1F5F9' : `${color}15`,
              color: value === 0 ? '#94A3B8' : color,
              border: `1px solid ${value === 0 ? '#E2E8F0' : `${color}30`}`,
            }}
          >
            {badgeText}
          </span>

          {/* SVG Sparkline with Baseline and Trend Curve */}
          <div className="w-24 sm:w-28 h-8 transition-all duration-300 group-hover:scale-105">
            <svg viewBox="0 0 100 35" fill="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={value === 0 ? "0.04" : "0.25"} />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Baseline Reference Grid Line */}
              <line
                x1="2"
                y1="28"
                x2="98"
                y2="28"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-700 opacity-70"
                strokeWidth="1"
                strokeDasharray="2 2"
              />

              {/* Area fill under curve */}
              {value > 0 && (
                <path
                  d={areaPath}
                  fill={`url(#${gradId})`}
                  className="transition-all duration-700"
                />
              )}

              {/* Dynamic Line Graph */}
              <path
                d={linePath}
                stroke={value === 0 ? '#CBD5E1' : color}
                strokeWidth={value === 0 ? "1.75" : "2.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={value === 0 ? "4 3" : undefined}
                className="animate-wave-draw transition-all duration-700"
              />

              {/* Indicator Data Points */}
              {dots.map((d, i) => (
                <circle
                  key={i}
                  cx={d.cx}
                  cy={d.cy}
                  r={value === 0 ? "2" : "3"}
                  fill={value === 0 ? '#CBD5E1' : color}
                  className="transition-all duration-700"
                  style={{
                    filter: value > 0 ? `drop-shadow(0 0 3px ${color}80)` : undefined,
                  }}
                />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  user,
  onLogout,
  projects,
  notifications,
  onSelectProject,
  onCreateProject,
  onSettings,
  onNavigateToCreate,
  selectedCompanyProject,
  setSelectedCompanyProject,
  onMarkNotificationsAsRead,
  onDeleteProject,
  onUpdateProject,
  aiScans = [],
  onSaveAIScan,
  onRenameAIScan,
  onDeleteAIScan,
  onUpdateAIScan,
  contentOverride,
  activeViewOverride,
  onExitOverride,
}: Props) {
  const [view, setView] = useState<View>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCompanyMode, setIsCompanyMode] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'ongoing' | 'upcoming' | 'missing' | 'approval' | 'finalize'>('ongoing');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [view]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('aa2000_pinned'); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    localStorage.setItem('aa2000_pinned', JSON.stringify([...pinned]));
  }, [pinned]);

  // Dark / Night Mode state
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aa2000_theme');
      return saved === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('aa2000_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('aa2000_theme', 'light');
      }
    } catch {}
  }, [isDark]);

  // Live digital clock
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const digitalClock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<Project[]>(projects);
  const theme = getRoleTheme(user.role, isDark);

  useEffect(() => { setProjectList(projects); }, [projects]);

  useEffect(() => {
    if (onMarkNotificationsAsRead) {
      if (view === 'ongoing') onMarkNotificationsAsRead('ongoing');
      else if (view === 'upcoming') onMarkNotificationsAsRead('upcoming');
      else if (view === 'missing-notif') onMarkNotificationsAsRead('missing');
      else if (view === 'approval-notif') onMarkNotificationsAsRead('approval');
      else if (view === 'finalize-notif') onMarkNotificationsAsRead('finalize');
    }
  }, [view, onMarkNotificationsAsRead]);

  const isCategoryView = categoryViews.includes(view);
  const categoryFilter = isCategoryView ? (CATEGORY_VIEW_TO_KEY[view] || null) : null;
  const isNotification = ['ongoing', 'upcoming', 'missing-notif', 'approval-notif', 'finalize-notif'].includes(view);

  const filtered = useMemo(() => {
    const f = filterProjects(projectList, view);
    const q = search.toLowerCase();
    return sortProjects(
      f.filter(p => p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)),
      sort
    );
  }, [projectList, view, search, sort]);

  const pinnedItems = filtered.filter(p => pinned.has(p.id));
  const unpinnedItems = filtered.filter(p => !pinned.has(p.id));
  const ordered = [...pinnedItems, ...unpinnedItems];

  // Stats
  const companyFolders = projectList.filter(p => p.buildingType === 'Other');
  const actualProjects = projectList.filter(p => p.buildingType !== 'Other');
  const totalProjects = actualProjects.length;
  const companyCount = companyFolders.length;

  // Dynamic Greeting based on current time (Morning, Afternoon, Evening)
  const timeGreeting = useMemo(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good Morning';
    if (hrs < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const isAdmin = user.role === 'ADMIN';
  const userGreetingName =
    user.fullName?.split(' ')[0] ||
    (user.role === 'ADMIN' ? 'Admin' :
     user.role === 'TECHNICIAN' ? 'Technician' : 'Accounting');

  // Derive display status for each company folder (matching Home.tsx logic)
  const folderStatusMap: Record<string, string> = {};
  const clean = (s?: string) => (s || '').trim().toLowerCase();
  for (const folder of companyFolders) {
    const folderName = clean(folder.name);
    const folderClientName = clean(folder.clientName);
    const children = actualProjects.filter(
      p => clean(p.clientName) === folderName || clean(p.clientName) === folderClientName
    );
    if (children.length === 0) {
      folderStatusMap[folder.id] = folder.status;
    } else {
      const priority = ['Completed', 'Finalized - Approved', 'Finalized', 'Finalized - Rejected', 'In Progress', 'Pending'];
      let found = folder.status;
      for (const s of priority) {
        if (children.some(c => c.status === s)) { found = s; break; }
      }
      folderStatusMap[folder.id] = found;
    }
  }

  const pendingCount = actualProjects.filter(p => p.status === 'Pending').length;
  const inProgressCount = actualProjects.filter(p => p.status === 'In Progress' || p.status === 'Finalized' || p.status === 'Finalized - Rejected').length;
  const completedCount = actualProjects.filter(p => p.status === 'Completed' || p.status === 'Finalized - Approved').length;

  const countOngoing = notifications.filter(n => n.type === 'ongoing').length;
  const countUpcoming = notifications.filter(n => n.type === 'upcoming').length;
  const countMissing = notifications.filter(n => n.type === 'missing').length;
  const countApproval = notifications.filter(n => n.type === 'approval').length;
  const countFinalize = notifications.filter(n => n.type === 'finalize').length;

  const handleDelete = (id: string) => {
    const target = projectList.find(p => p.id === id);
    const idsToDelete = [id];
    if (target && target.buildingType === 'Other') {
      const clean = (s?: string) => (s || '').trim().toLowerCase();
      const targetName = clean(target.name);
      const targetClientName = clean(target.clientName);
      const children = projectList.filter(
        p => p.buildingType !== 'Other' && (clean(p.clientName) === targetName || clean(p.clientName) === targetClientName)
      );
      idsToDelete.push(...children.map(p => p.id));
    }
    setProjectList(prev => prev.filter(p => !idsToDelete.includes(p.id)));
    try {
      const surveys = JSON.parse(localStorage.getItem('aa2000_surveys') || '[]');
      const remaining = surveys.filter((s: any) => !idsToDelete.includes(s.projectId));
      localStorage.setItem('aa2000_surveys', JSON.stringify(remaining));
    } catch { }
    setPinned(prev => { const n = new Set(prev); idsToDelete.forEach(dId => n.delete(dId)); return n; });
    idsToDelete.forEach(dId => {
      try {
        localStorage.removeItem(`aa2000_estimation_${dId}`);
      } catch { }
      if (onDeleteProject) onDeleteProject(dId);
    });
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  const handleSaveEdit = (updated: Project) => {
    setProjectList(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (onUpdateProject) onUpdateProject(updated);
    setEditProject(null);
  };

  const handlePin = (id: string) => {
    setPinned(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setMenuOpen(null);
  };

  const [viewHistory, setViewHistory] = useState<View[]>([]);

  const navigate = (v: View) => {
    setMobileMenuOpen(false);
    setSelectedCompanyProject(null);
    if (v === 'create-survey') { onNavigateToCreate(); return; }
    // estimation-hub is rendered inside dashboard with sidebar — no full-screen override needed
    if (contentOverride && onExitOverride) {
      onExitOverride();
    }
    setView(prevView => {
      if (v !== prevView) {
        setViewHistory(prev => [...prev, prevView]);
      }
      return v;
    });
  };

  const goBack = () => {
    if (viewHistory.length === 0) return;
    const prevView = viewHistory[viewHistory.length - 1];
    setViewHistory(prev => prev.slice(0, -1));
    setView(prevView);
  };

  const navigateNotif = (type: string) => {
    setSelectedCompanyProject(null);
    const m: Record<string, View> = {
      notifications: 'notifications', ongoing: 'ongoing', upcoming: 'upcoming',
      missing: 'missing-notif', approval: 'approval-notif', finalize: 'finalize-notif',
    };
    const targetView = m[type] || 'dashboard';
    setView(prevView => {
      if (targetView !== prevView) {
        setViewHistory(prev => [...prev, prevView]);
      }
      return targetView as View;
    });
    if (type === 'notifications' && onMarkNotificationsAsRead) onMarkNotificationsAsRead('all');
  };

  const pipelineStages = [
    { label: 'Pending', count: pendingCount, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    { label: 'In Progress', count: inProgressCount, color: theme.primary, bg: theme.primaryAlpha08 },
    { label: 'Completed', count: completedCount, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  ];

  // Today's date
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      className={`flex h-screen overflow-hidden w-full transition-colors duration-300 ${isDark ? 'bg-[#0B0F19]' : 'bg-[#F8FAFC]'}`}
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at 20% 20%, rgba(37,99,235,0.06) 0%, transparent 60%), #0B0F19'
          : 'radial-gradient(ellipse at 20% 20%, rgba(191,219,254,0.2) 0%, transparent 55%), #F8FAFC',
      }}
    >
      {/* Desktop Sidebar (Only rendered when not mobile) */}
      {!isMobile && (
        <div className="h-screen sticky top-0 z-40 shrink-0">
          <Sidebar
            isMobile={false}
            user={user}
            currentView={activeViewOverride || view}
            onNavigate={navigate}
            notifications={notifications}
            projects={projects}
            aiScans={aiScans}
            isDark={isDark}
            onNewSurvey={() => {
              setIsCompanyMode(false);
              setShowCreate(true);
            }}
          />
        </div>
      )}

      {/* Mobile Sidebar Drawer Overlay (Only rendered when mobile menu is open) */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div
            className="relative w-[290px] max-w-[85vw] h-full shadow-2xl z-10 overflow-hidden flex flex-col transition-colors"
            style={{ background: isDark ? '#0D1527' : '#EFF6FF' }}
          >
            <div
              className="p-3 border-b flex items-center justify-between transition-colors"
              style={{ background: isDark ? '#131B2E' : '#DBEAFE', borderColor: isDark ? '#1E293B' : '#BFDBFE' }}
            >
              <span className="text-xs font-black text-blue-500 uppercase tracking-wider">AA2000 Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-blue-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-300 dark:hover:bg-slate-600 flex items-center justify-center text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w-full">
              <Sidebar
                isMobile={true}
                user={user}
                currentView={activeViewOverride || view}
                onNavigate={navigate}
                notifications={notifications}
                projects={projects}
                aiScans={aiScans}
                isDark={isDark}
                onNewSurvey={() => {
                  setMobileMenuOpen(false);
                  setIsCompanyMode(false);
                  setShowCreate(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

        {/* ══════════════════════════════════════════
            TOP NAVIGATION BAR (Glassmorphism)
        ══════════════════════════════════════════ */}
        {!contentOverride && (
          <div
            className={`sticky top-0 z-50 px-4 sm:px-6 h-14 flex items-center justify-between shrink-0 border-b backdrop-blur-md transition-colors ${
              isDark ? 'bg-[#0B0F19]/90 border-slate-800' : 'bg-white/80 border-slate-200/80'
            }`}
          >
          {/* Left: Mobile menu toggle + Back button + System status + date */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors cursor-pointer"
              title="Open navigation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            {view !== 'dashboard' && viewHistory.length > 0 && (
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Go back"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-[10px] font-bold hidden sm:inline">Back</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">ONLINE</span>
            </div>
            <span className="text-[10px] font-medium text-slate-400 hidden sm:block">{todayLabel}</span>
          </div>

          {/* Right: Search + Dark Mode Toggle + Notifications + Account */}
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-visible">
            {/* Search */}
            <div className="relative hidden sm:block">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input w-48 lg:w-56 pl-9 pr-3 py-1.5 rounded-xl text-[11px] font-medium bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 outline-none text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 transition-all"
              />
            </div>

            {/* Digital Clock */}
            <div
              className={`hidden sm:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border text-[11px] font-black tracking-wider font-mono ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                  : 'bg-slate-50/80 border-slate-200 text-slate-700'
              }`}
              title={now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{digitalClock}</span>
            </div>

            {/* Dark / Night Mode Toggle */}
            <button
              onClick={() => setIsDark(d => !d)}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-2xs group"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Night Mode'}
              aria-label="Toggle Night Mode"
            >
              {isDark ? (
                <svg className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-600 transition-transform duration-300 group-hover:-rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>

            {/* Notification Bell */}
            <NotificationBell notifications={notifications} onViewAll={navigateNotif} />

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

            {/* Account dropdown */}
            <AccountDropdown user={user} onLogout={onLogout} onSettings={onSettings} />
          </div>
        </div>
      )}

        {/* ══════════════════════════════════════════
            PAGE CONTENT
        ══════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto">
          {contentOverride ? (
            contentOverride
          ) : (
            <>
              {/* Always mounted (hidden when inactive) so AI analysis continues in background */}
              <div style={{ display: view === 'ai-reader' ? undefined : 'none' }}>
                <AISidebar
                  onCreateProject={onCreateProject}
                  onSelectProject={onSelectProject}
                  onSaveAIScan={onSaveAIScan}
                />
              </div>
              <div style={{ display: view === 'floor-plan' ? undefined : 'none' }}>
                <FloorPlanView userRole={user.role} />
              </div>
              <div style={{ display: view === 'estimation-hub' ? undefined : 'none', height: view === 'estimation-hub' ? '100%' : undefined }}>
                <EstimationHub
                  user={user}
                  projects={projects}
                  onCreateProject={onCreateProject}
                  onSelectProject={onSelectProject}
                  onSaveAIScan={onSaveAIScan}
                  onNavigateToCreate={onNavigateToCreate}
                  isDark={isDark}
                />
              </div>
              {selectedCompanyProject ? (
            <CompanyDetail
              user={user}
              companyProject={selectedCompanyProject}
              projects={projectList}
              onBack={() => setSelectedCompanyProject(null)}
              onSelectProject={onSelectProject}
              onNewSurvey={onNavigateToCreate}
              onDeleteProject={handleDelete}
            />
          ) : view === 'home' || view === 'ai-reader' || view === 'floor-plan' || isCategoryView ? (
            <Home
              user={user}
              projects={projectList}
              categoryFilter={categoryFilter}
              onSelectCompany={companyName => {
                const clean = (s?: string) => (s || '').trim().toLowerCase();
                const target = clean(companyName);
                const found = projectList.find(
                  p => clean(p.name) === target || clean(p.clientName) === target
                );
                if (found) {
                  setSelectedCompanyProject(found);
                } else {
                  setSelectedCompanyProject({
                    id: `company-synth-${Date.now()}`,
                    name: companyName,
                    clientName: companyName,
                    location: '',
                    buildingType: 'Other',
                    status: 'Pending',
                    assignedTechnicians: [],
                    createdAt: new Date().toISOString(),
                  });
                }
              }}
              onSelectProject={onSelectProject}
              onNewCompanyClick={() => { setIsCompanyMode(true); setShowCreate(true); }}
              onDeleteProject={handleDelete}
              onUpdateProject={handleSaveEdit}
              aiScans={aiScans}
              onRenameAIScan={onRenameAIScan}
              onDeleteAIScan={onDeleteAIScan}
              onUpdateAIScan={onUpdateAIScan}
              isDark={isDark}
            />
          ) : view === 'estimation-hub' ? null
          : view === 'calendar' ? (
            <CalendarView
              projects={projectList}
              onSelectProject={onSelectProject}
              userRole={user.role || 'ACCOUNTING'}
            />
          ) : view === 'saved-folders' ? (
            <SavedFoldersView
              aiScans={aiScans}
              onRenameAIScan={onRenameAIScan}
              onDeleteAIScan={onDeleteAIScan}
              onUpdateAIScan={onUpdateAIScan}
            />
          ) : view === 'saved-boqs' ? (
            <SavedBOQsView userRole={user.role} />
          ) : view === 'history' ? (
            <SavedEstimationsView
              projects={projectList}
              statusFilter={['Completed', 'Finalized - Approved', 'Finalized - Rejected', 'Unknown']}
              onDeleteProject={handleDelete}
            />
          ) : view === 'saved-estimations' ? (
            <SavedEstimationsView
              projects={projectList}
              onDeleteProject={handleDelete}
            />
          ) : (
            <div className="pb-10">
              {/* Dashboard view: title + stats */}
              {view === 'dashboard' && (
                <>
                  {/* Clean Header with Enriched Large Dynamic Time-Based Greeting */}
                  <div className="px-6 pt-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="max-w-3xl">
                        <h1
                          className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight flex items-center gap-2.5 flex-wrap"
                          style={{ fontFamily: 'Manrope, Inter, sans-serif' }}
                        >
                          <span className="text-slate-900 dark:text-white">{timeGreeting},</span>
                          <span className="text-blue-600 dark:text-blue-400">{userGreetingName}!</span>
                          <span className="inline-block animate-wave origin-bottom-right">👋</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-2 max-w-2xl">
                          Welcome to the system control center. Create estimation projects, assign technical teams, review surveys, and approve final equipment pricing estimates.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Overview & Stat Cards (2x2 Grid) */}
                  <div className="px-6 pt-6 space-y-4">
                    <StatusOverviewBanner
                      totalProjects={totalProjects}
                      inProgressCount={inProgressCount}
                      pendingCount={pendingCount}
                      completedCount={completedCount}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SparklineCard
                        label="PROJECTS"
                        value={totalProjects}
                        totalProjects={totalProjects}
                        sub="Total site surveys"
                        icon={<StatBuilding className="w-5 h-5" />}
                        valueColor="#2563EB"
                        onClick={() => navigate('assignment')}
                        delay={0}
                      />
                      <SparklineCard
                        label="IN PROGRESS"
                        value={inProgressCount}
                        totalProjects={totalProjects}
                        sub="Active site surveys"
                        icon={<StatBolt className="w-5 h-5" />}
                        valueColor="#2563EB"
                        onClick={() => navigate('workspace')}
                        delay={50}
                      />
                      <SparklineCard
                        label="PENDING"
                        value={pendingCount}
                        totalProjects={totalProjects}
                        sub="Awaiting kickoff"
                        icon={<StatCalendar className="w-5 h-5" />}
                        valueColor="#F59E0B"
                        onClick={() => navigate('workspace')}
                        delay={100}
                      />
                      <SparklineCard
                        label="COMPLETED"
                        value={completedCount}
                        totalProjects={totalProjects}
                        sub="Finalized surveys"
                        icon={<StatCheckCircle className="w-5 h-5" />}
                        valueColor="#16A34A"
                        onClick={() => navigate('done')}
                        delay={150}
                      />
                    </div>
                  </div>

                  {/* Pending Surveys & Active Projects */}
                  <div className="px-6 pt-6">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm animate-fade-in-up flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div>
                          <h3 className="text-sm font-black tracking-wider text-slate-800 uppercase flex items-center gap-2">
                            <span>Pending Surveys &amp; Active Projects</span>
                            {pendingCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                                {pendingCount} Pending
                              </span>
                            )}
                          </h3>
                          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                            Click any project below to open site survey, upload floor plan, or build BOQ
                          </p>
                        </div>
                        <button
                          onClick={() => navigate('workspace')}
                          className="text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors"
                        >
                          View All Workspace →
                        </button>
                      </div>

                      {/* Project Cards Grid */}
                      {actualProjects.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {actualProjects.slice(0, 6).map((p, index) => {
                            const isPending = p.status === 'Pending';
                            const isAwaitingApproval = p.status === 'Finalized';
                            const isRejected = p.status === 'Finalized - Rejected';
                            const isCompleted = p.status === 'Completed' || p.status === 'Finalized - Approved';
                            return (
                              <div
                                key={p.id}
                                onClick={() => onSelectProject(p)}
                                className={`p-4.5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between group/card relative overflow-hidden animate-fade-in-up hover:-translate-y-1.5 hover:shadow-xl ${
                                  isPending
                                    ? 'bg-amber-50/20 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/50 hover:border-amber-400'
                                    : isAwaitingApproval
                                    ? 'bg-blue-50/20 dark:bg-blue-950/20 border-blue-200/90 dark:border-blue-900/50 hover:border-blue-400'
                                    : 'bg-white dark:bg-[#131B2E] border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-slate-100 dark:hover:shadow-none'
                                }`}
                                style={{ animationDelay: `${index * 60}ms` }}
                              >
                                {/* Top Accent bar on hover */}
                                <div
                                  className={`absolute top-0 left-0 right-0 h-1 transition-opacity duration-300 opacity-0 group-hover/card:opacity-100 ${
                                    isPending
                                      ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                                      : isAwaitingApproval
                                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                      : isRejected
                                      ? 'bg-gradient-to-r from-rose-400 to-rose-600'
                                      : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                                  }`}
                                />

                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                                      {p.clientName}
                                    </span>
                                    <span
                                      className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 transition-transform duration-200 group-hover/card:scale-105 ${
                                        isPending
                                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                          : isAwaitingApproval
                                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                          : isRejected
                                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                          : isCompleted
                                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                          : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                      }`}
                                    >
                                      {/* Live status pulsing dot */}
                                      <span className="relative flex h-1.5 w-1.5">
                                        {(isPending || isAwaitingApproval) && (
                                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPending ? 'bg-amber-400' : 'bg-blue-400'}`} />
                                        )}
                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPending ? 'bg-amber-500' : isAwaitingApproval ? 'bg-blue-600' : isRejected ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                      </span>
                                      <span>
                                        {isAwaitingApproval
                                          ? 'Awaiting Approval'
                                          : isCompleted
                                          ? 'Approved'
                                          : isRejected
                                          ? 'Rejected'
                                          : p.status}
                                      </span>
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-black text-slate-800 dark:text-white mb-1 leading-snug transition-colors duration-200 group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400">{p.name}</h4>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mb-3 flex items-center gap-1">
                                    <span className="group-hover/card:scale-125 transition-transform duration-200 inline-block">📍</span>
                                    <span>{p.location || 'Location not set'}</span>
                                  </p>
                                </div>

                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 truncate">
                                    {p.systemTypes?.slice(0, 2).join(', ') || 'General System'}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onSelectProject(p); }}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white transition-all duration-300 shadow-sm flex items-center gap-1 shrink-0 group-hover/card:shadow-md hover:scale-105 active:scale-95"
                                    style={{
                                      background: isPending ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)' : 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)',
                                      color: '#FFFFFF'
                                    }}
                                  >
                                    <span>Open Survey</span>
                                    <svg className="w-3.5 h-3.5 text-white transition-transform duration-300 group-hover/card:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-12 text-center flex flex-col items-center justify-center">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                            <StatClipboard className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-black text-slate-800 mb-1">No site surveys created yet</h4>
                          <p className="text-xs text-slate-500 max-w-sm mb-4">
                            {isAdmin ? 'Click below to start your first survey and build low-voltage estimations.' : 'No active site surveys have been assigned or submitted yet.'}
                          </p>
                          {isAdmin && (
                            <button
                              onClick={onNavigateToCreate}
                              className="px-5 py-2.5 rounded-xl font-black text-xs text-white bg-blue-700 hover:bg-blue-800 shadow-md transition-all cursor-pointer"
                            >
                              Start New Survey
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Project Table (non-dashboard, non-notifications, non-category views) */}
              {view !== 'dashboard' && view !== 'notifications' && !isCategoryView && (
                <div className="px-6 pt-6 pb-6 flex-1 flex flex-col min-h-0">
                  <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in-up flex-1 flex flex-col min-h-[calc(100vh-120px)]">
                    {/* Table header */}
                    <div
                      className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            {viewTitles[view] || 'Projects'}
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

                    {/* Table body */}
                    <div className="overflow-x-auto flex-1 pb-16">
                      {isLoading ? (
                        <SkeletonTable columns={4} rows={5} />
                      ) : ordered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl animate-float-a"
                            style={{ background: theme.primaryAlpha08 }}
                          >
                            <StatClipboard className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No projects found</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {user.role === 'ADMIN' ? 'Create a new project to get started' : 'No assignments in this view yet'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                              <th className="py-3 pl-6">Project / Client</th>
                              <th className="py-3 text-center">Status</th>
                              <th className="py-3 text-center">Date & Time</th>
                              <th className="py-3 pr-6 text-right" />
                            </tr>
                          </thead>
                          <tbody>
                            {ordered.map((project, i) => {
                              const isPinned = pinned.has(project.id);
                              const isOpen = menuOpen === project.id;
                              const isNearBottom = ordered.length > 2 && i >= ordered.length - 2;
                              const statusBar =
                                Object.entries(statusConfig).find(([key]) => project.status?.includes(key))?.[1]?.bar || '#64748B';

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
                                      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: statusBar }} />
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-slate-800 dark:text-white">{project.name}</span>
                                          {isPinned && (
                                            <span
                                              className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide"
                                              style={{ background: theme.primaryAlpha08, color: theme.primary }}
                                            >
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
                                    <StatusBadge status={project.status} />
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
                                          <button
                                            onClick={() => { setEditProject(project); setMenuOpen(null); }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            Edit Project
                                          </button>
                                          <button
                                            onClick={() => handlePin(project.id)}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            {isPinned ? 'Unpin' : 'Pin Project'}
                                          </button>
                                          <button
                                            onClick={() => onSelectProject(project)}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            View Details
                                          </button>
                                          <div className="border-t border-slate-100 my-1" />
                                          <button
                                            onClick={() => { setDeleteConfirm(project.id); setMenuOpen(null); }}
                                            className="w-full px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 cursor-pointer transition-colors"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Delete Project
                                          </button>
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
              )}

              {/* Notification View */}
              {view === 'notifications' && (
                <div className="px-6 pt-6 pb-6 flex-1 flex flex-col min-h-0">
                  <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in-up flex-1 flex flex-col min-h-[calc(100vh-120px)]">
                    {/* Tabs */}
                    <div className="px-6 pt-4 pb-0 border-b border-slate-100">
                      <div className="flex flex-wrap gap-1">
                        {[
                          { key: 'ongoing', label: 'Ongoing', count: countOngoing, color: '#2563EB' },
                          { key: 'upcoming', label: 'Upcoming', count: countUpcoming, color: '#059669' },
                          { key: 'missing', label: 'Missing', count: countMissing, color: '#D97706' },
                          ...(user.role === 'ADMIN' || user.role === 'ACCOUNTING'
                            ? [
                              { key: 'approval', label: 'Approval', count: countApproval, color: '#7C3AED' },
                              { key: 'finalize', label: 'Finalize', count: countFinalize, color: '#059669' },
                            ]
                            : []),
                        ].map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => setActiveNotifTab(tab.key as any)}
                            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all mb-[-1px]"
                            style={
                              activeNotifTab === tab.key
                                ? { borderColor: tab.color, color: tab.color }
                                : { borderColor: 'transparent', color: '#94A3B8' }
                            }
                          >
                            {tab.label}
                            <span
                              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full"
                              style={
                                activeNotifTab === tab.key
                                  ? { background: `${tab.color}15`, color: tab.color }
                                  : { background: '#F1F5F9', color: '#94A3B8' }
                              }
                            >
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-50">
                      {notifications.filter(n => n.type === activeNotifTab).length === 0 ? (
                        <div className="py-12 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-5 h-5 text-slate-300" />
                          </div>
                          <p className="text-xs font-bold text-slate-400">No alerts in this category</p>
                        </div>
                      ) : (
                        notifications
                          .filter(n => n.type === activeNotifTab)
                          .map(n => {
                            const cfg = typeConfig[n.type] || typeConfig.ongoing;
                            return (
                              <div
                                key={n.id}
                                onClick={() => navigateNotif(n.type)}
                                className="px-6 py-4 flex items-start gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors group"
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                                  style={{ background: !n.read ? cfg.dot : '#CBD5E1' }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm ${!n.read ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
                                    {n.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-xs text-slate-400 font-medium">
                                      {n.companyName} · {n.date}
                                    </span>
                                    <span
                                      className="text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                      style={{ background: cfg.bg, color: cfg.color }}
                                    >
                                      {cfg.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>

        {/* ── Modals ── */}
        {showCreate && (
          <CreateProjectModal
            userRole={user.role}
            onClose={() => setShowCreate(false)}
            onCreate={p => { onCreateProject(p); setProjectList(prev => [...prev, p]); }}
            isCompanyMode={isCompanyMode}
          />
        )}

        {editProject && (
          <EditProjectModal project={editProject} onClose={() => setEditProject(null)} onSave={handleSaveEdit} />
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
            <div className="w-full max-w-sm p-6 rounded-3xl bg-white shadow-2xl border border-slate-100 text-center animate-scale-in">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="font-black text-slate-800 text-base mb-1">Delete Project?</h3>
              <p className="text-xs text-slate-400 mb-5">This action cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 btn-press"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 shadow-md shadow-red-100 btn-press"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <AIChatbotFloating userRole={user?.role} activeProjectName={selectedCompanyProject?.name} />
      </main>

    </div>
  );
}
