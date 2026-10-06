import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { User, Project, AIScanGroup } from '../../App';
import type { Notification } from '../notifications/NotificationBell';
import { getRoleTheme } from '../../utils/RoleTheme';
import { getSavedBOQCount } from '../floor-plan/SavedBOQsView';
import { AIChatbotFloating } from '../chatbot/AIChatbotFloating';

export type View =
  | 'home' | 'dashboard' | 'workspace' | 'create-survey'
  | 'todo' | 'assignment' | 'missing' | 'done' | 'history'
  | 'approval' | 'finalize'
  | 'ongoing' | 'upcoming' | 'missing-notif' | 'approval-notif' | 'finalize-notif'
  | 'notifications' | 'calendar' | 'floor-plan'
  | 'cctv' | 'fire_alarm' | 'fire_protection' | 'access_control' | 'burglar_alarm' | 'other'
  | 'ai-reader' | 'ai-chat' | 'estimation-hub' | 'manual-estimation' | 'ai-estimation'
  | 'saved-folders' | 'saved-boqs' | 'saved-estimations';

export interface Props {
  user: User;
  currentView: View;
  onNavigate: (view: View) => void;
  notifications?: Notification[];
  projects?: Project[];
  aiScans?: AIScanGroup[];
  onNewSurvey?: () => void;
  isMobile?: boolean;
  isDark?: boolean;
  activeProjectName?: string;
}

const navIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {
  dashboard: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  'ai-chat': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75m-6.75 3h4.5m-9 7.5 1.875-3.75A8.25 8.25 0 1112 20.25H4.125z" />
    </svg>
  ),
  'create-survey': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  'manual-estimation': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'ai-estimation': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
  calendar: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  approval: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  done: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  history: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'estimation-hub': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
  'saved-folders': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  'saved-boqs': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  notifications: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  ongoing: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  upcoming: ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'missing-notif': ({ size = 19, className = '' }) => (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
};

export default function Sidebar({
  user,
  currentView,
  onNavigate,
  notifications = [],
  projects = [],
  aiScans = [],
  onNewSurvey,
  isMobile = false,
  isDark = false,
  activeProjectName,
}: Props) {
  const isAdmin = user.role === 'ADMIN';
  const isAccounting = user.role === 'ACCOUNTING';

  // `isPinned`: persistent lock state via toggle button click
  // `isHovered`: temporary expand on mouse enter
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [savedBOQCount, setSavedBOQCount] = useState(0);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatWidth, setAiChatWidth] = useState(480);
  const resizeStartRef = React.useRef<{ pointerId: number; x: number; width: number } | null>(null);

  // Sidebar is expanded if pinned OR hovered
  const isExpanded = !isMobile && (isPinned || isHovered);

  const handleTogglePin = () => {
    setIsPinned(prev => !prev);
  };

  useEffect(() => {
    setSavedBOQCount(getSavedBOQCount());
  }, [currentView]);

  const canApprove = isAdmin || isAccounting;
  const canUseEstimationHub = isAdmin || isAccounting || user.role === 'TECHNICIAN';
  const canCreateSurvey = isAdmin || isAccounting;
  const canViewSavedBOQs = isAdmin || isAccounting;

  const isNotificationView = [
    'notifications', 'ongoing', 'upcoming', 'missing-notif', 'approval-notif'
  ].includes(currentView);

  const getUnreadCount = (viewName: View) => {
    if (!notifications) return 0;
    if (viewName === 'notifications') return notifications.filter(n => !n.read).length;
    const viewToNotifType: Record<string, string> = {
      ongoing: 'ongoing',
      upcoming: 'upcoming',
      missing: 'missing',
      'missing-notif': 'missing',
      'approval-notif': 'approval',
      'finalize-notif': 'finalize',
    };
    const notifType = viewToNotifType[viewName];
    if (!notifType) return 0;
    return notifications.filter(n => n.type === notifType && !n.read).length;
  };

  const navGroups: { label: string; items: { label: string; view: View; accent?: string; _count?: number }[] }[] = isNotificationView ? [
    {
      label: 'NOTIFICATION',
      items: [
        { view: 'notifications', label: 'All Notifications', accent: '#2563EB' },
        { view: 'ongoing', label: 'Ongoing Surveys', accent: '#2563EB' },
        { view: 'upcoming', label: 'Upcoming Surveys', accent: '#10B981' },
        { view: 'missing-notif', label: 'Missing Alerts', accent: '#F59E0B' },
        ...(canApprove
          ? [{ view: 'approval-notif' as View, label: 'Approval Alerts', accent: '#2563EB' }]
          : []),
      ],
    },
  ] : [
    {
      label: isAccounting ? 'FINANCE' : 'SURVEYS',
      items: [
        { view: 'dashboard', label: 'Dashboard' },
        { view: 'calendar', label: isAccounting ? 'Financial Calendar' : 'Survey Calendar' },
      ],
    },
    {
      label: 'WORKFLOW',
      items: [
        ...(canApprove
          ? [{ view: 'approval' as View, label: isAccounting ? 'Financial Approvals' : 'Approval Pipeline', accent: '#2563EB' }]
          : [{ view: 'done' as View, label: 'Completed Surveys', accent: '#10B981' }]),
        { view: 'history', label: 'History Archive', accent: '#64748B' },
      ],
    },
    ...(canUseEstimationHub
      ? [
        {
          label: 'TOOLS',
          items: [
            ...(canCreateSurvey
              ? [{ view: 'create-survey' as View, label: 'New Survey', accent: '#2563EB' }]
              : []),
            { view: 'manual-estimation' as View, label: 'Manual Estimation', accent: '#2563EB' },
            { view: 'ai-estimation' as View, label: 'AI Estimation', accent: '#D97706' },
            { view: 'ai-chat' as View, label: 'AI Assistant', accent: '#2563EB' },
          ],
        },
      ]
      : []),
    {
      label: 'SAVED',
      items: [
        { view: 'saved-folders', label: 'AI Scan Folders', accent: '#2563EB', _count: aiScans?.length ?? 0 },
        ...(canViewSavedBOQs
          ? [{ view: 'saved-boqs' as View, label: 'Floor Plan BOQs', accent: '#2563EB', _count: savedBOQCount }]
          : []),
      ],
    },
  ];

  return (
    <>
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`h-full border-r shrink-0 flex flex-col justify-between select-none transition-all duration-300 ease-in-out ${
        isDark
          ? 'bg-[#0D1527] border-slate-800/80 text-white'
          : 'bg-white border-slate-200/80 text-slate-800'
      } ${
        isExpanded ? 'w-72 xl:w-72' : 'w-20'
      }`}
    >
      <div className="flex flex-col h-full relative">

        {/* ── Header Section with "AI Estimation" Label & Persistent Toggle Button ── */}
        <div
          className={`group/header p-4 flex items-center border-b transition-colors relative min-h-[72px] ${
            isDark ? 'border-slate-800/80' : 'border-slate-100'
          } ${
            isExpanded ? 'justify-between' : 'justify-center'
          }`}
        >
          {isExpanded ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-transform duration-300">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 pl-0.5">
                <h1 className={`text-base font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  AI Estimation
                </h1>
              </div>
            </div>
          ) : (
            <div
              onClick={handleTogglePin}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
              title="Pin Sidebar Expanded"
            >
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          )}

          {/* Toggle Button in Expanded State */}
          {isExpanded && !isMobile && (
            <button
              type="button"
              onClick={handleTogglePin}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isPinned
                  ? 'bg-blue-600/20 text-blue-600 dark:bg-blue-600/30 dark:text-blue-400'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={isPinned ? 'Collapse sidebar (unpin)' : 'Keep sidebar expanded (pin)'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Navigation Groups List ── */}
        <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto no-scrollbar">
          {navGroups.map((group, groupIdx) => (
            <div key={group.label}>
              {groupIdx > 0 && <div className={`my-2.5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`} />}
              {isExpanded && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map(item => {
                  const isSubViewActive = ['cctv', 'fire_alarm', 'fire_protection', 'access_control', 'burglar_alarm', 'other'].includes(currentView);
                  const active = (item.view === 'ai-chat' ? isAiChatOpen : currentView === item.view) || (item.view === 'dashboard' && isSubViewActive);
                  const Icon = navIcons[item.view] || navIcons.dashboard;
                  const unreadCount = getUnreadCount(item.view);
                  const savedCount = item._count ?? 0;
                  const badgeCount = savedCount > 0 ? savedCount : unreadCount;

                  if (!isExpanded) {
                    // Collapsed state icon button
                    return (
                      <button
                        key={item.view}
                        type="button"
                        onClick={() => {
                          if (item.view === 'ai-chat') setIsAiChatOpen(true);
                          else if (item.view === 'create-survey') {
                            setIsAiChatOpen(false);
                            if (onNewSurvey) onNewSurvey();
                            else onNavigate('create-survey');
                          }
                          else {
                            setIsAiChatOpen(false);
                            onNavigate(item.view);
                          }
                        }}
                        title={item.label}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center mx-auto transition-all cursor-pointer relative group ${
                          active
                            ? isDark
                              ? 'bg-[#EFF6FF] text-[#2563EB] font-bold shadow-sm'
                              : 'bg-blue-50 text-blue-600 font-bold shadow-xs'
                            : isDark
                            ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                      >
                        <Icon size={19} className={active ? (isDark ? 'text-[#2563EB]' : 'text-blue-600') : (isDark ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-700')} />
                        {badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center px-1 shadow-xs">
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  }

                  // Expanded state button
                  return (
                    <button
                      key={item.view}
                      type="button"
                      onClick={() => {
                        if (item.view === 'ai-chat') setIsAiChatOpen(true);
                        else if (item.view === 'create-survey') {
                          setIsAiChatOpen(false);
                          if (onNewSurvey) onNewSurvey();
                          else onNavigate('create-survey');
                        }
                        else {
                          setIsAiChatOpen(false);
                          onNavigate(item.view);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                        active
                          ? isDark
                            ? 'bg-[#EFF6FF] text-[#2563EB] shadow-sm font-bold'
                            : 'bg-blue-50/90 text-blue-600 shadow-2xs font-bold'
                          : isDark
                          ? 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={19} className={active ? (isDark ? 'text-[#2563EB]' : 'text-blue-600') : (isDark ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-700')} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {badgeCount > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white shadow-xs">
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

      </div>
    </aside>
    {createPortal(
      <div className={`fixed inset-y-0 right-0 z-[60] ${isAiChatOpen ? '' : 'hidden'}`}>
        <div
          role="separator"
          aria-label="Resize AI Assistant panel"
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={Math.max(320, window.innerWidth - 320)}
          aria-valuenow={aiChatWidth}
          tabIndex={0}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const direction = event.key === 'ArrowLeft' ? 1 : -1;
            const maxWidth = Math.max(320, window.innerWidth - 320);
            setAiChatWidth(width => Math.max(320, Math.min(maxWidth, width + direction * 20)));
          }}
          onPointerDown={event => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeStartRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              width: aiChatWidth,
            };
          }}
          onPointerMove={event => {
            const start = resizeStartRef.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const maxWidth = Math.max(320, window.innerWidth - 320);
            setAiChatWidth(Math.max(320, Math.min(maxWidth, start.width + start.x - event.clientX)));
          }}
          onPointerUp={event => {
            if (resizeStartRef.current?.pointerId === event.pointerId) {
              resizeStartRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => { resizeStartRef.current = null; }}
          className="absolute inset-y-0 left-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none"
        >
          <span className="h-12 w-1 rounded-full bg-slate-500/40 transition-colors hover:bg-blue-400" />
        </div>
        <div
          className="h-full max-w-[100vw] border-l border-slate-700 shadow-2xl"
          style={{ width: `min(${aiChatWidth}px, 100vw)` }}
        >
          <AIChatbotFloating
            presentation="sidebar"
            isOpen={isAiChatOpen}
            onClose={() => setIsAiChatOpen(false)}
            userRole={user.role}
            activeProjectName={activeProjectName}
          />
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
