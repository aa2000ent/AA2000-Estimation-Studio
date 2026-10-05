import React from 'react';
import type { User, Project, AIScanGroup } from '../App';
import Sidebar from '../components/dashboard/Sidebar';
import type { View } from '../components/dashboard/Sidebar';
import NotificationBell from '../components/notifications/NotificationBell';
import type { Notification } from '../components/notifications/NotificationBell';
import AccountDropdown from '../components/dashboard/AccountDropdown';

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
  projects: Project[];
  notifications: Notification[];
  aiScans?: AIScanGroup[];
  view: View;
  activeViewOverride?: View;
  onNavigate: (v: View) => void;
  onNavigateNotif: (type: string) => void;
  onSettings: () => void;
  onNewSurvey: () => void;
  goBack: () => void;
  canGoBack: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  digitalClock: string;
  todayLabel: string;
  isMobile: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  contentOverride?: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardLayout({
  user,
  onLogout,
  projects,
  notifications,
  aiScans = [],
  view,
  activeViewOverride,
  onNavigate,
  onNavigateNotif,
  onSettings,
  onNewSurvey,
  goBack,
  canGoBack,
  isDark,
  onToggleTheme,
  digitalClock,
  todayLabel,
  isMobile,
  mobileMenuOpen,
  setMobileMenuOpen,
  contentOverride,
  children,
}: DashboardLayoutProps) {
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
            onNavigate={onNavigate}
            notifications={notifications}
            projects={projects}
            aiScans={aiScans}
            isDark={isDark}
            onNewSurvey={onNewSurvey}
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
                onNavigate={onNavigate}
                notifications={notifications}
                projects={projects}
                aiScans={aiScans}
                isDark={isDark}
                onNewSurvey={onNewSurvey}
              />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* TOP NAVIGATION BAR (Glassmorphism) */}
        {!contentOverride && (
          <div
            className={`sticky top-0 z-50 px-4 sm:px-6 h-14 flex items-center justify-between shrink-0 border-b backdrop-blur-md transition-colors ${
              isDark ? 'bg-[#0B0F19]/90 border-slate-800' : 'bg-white/80 border-slate-200/80'
            }`}
          >
            {/* Left: Mobile menu toggle + Back button + System status */}
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
              {view !== 'dashboard' && canGoBack && (
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
            </div>

            {/* Right: Time, appearance, notifications, and account */}
            <div className="flex items-center gap-2 sm:gap-3 overflow-visible shrink-0">
              <div
                className={`hidden sm:flex h-9 items-center gap-2.5 px-3 rounded-xl border text-[10px] ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
                title={todayLabel}
              >
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono font-black tracking-wide">{digitalClock}</span>
                <span className="h-4 w-px bg-slate-200 dark:bg-slate-600" />
                <span className="hidden lg:inline font-bold whitespace-nowrap">{todayLabel}</span>
              </div>

              {/* Theme Toggle pill */}
              <div className="relative hidden sm:flex w-[68px] h-9 items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 shadow-2xs overflow-hidden">
                <span
                  className={`absolute top-0.5 left-0.5 w-8 h-8 rounded-full bg-blue-600 shadow-sm pointer-events-none transition-transform duration-300 ease-out ${
                    isDark ? 'translate-x-8' : 'translate-x-0'
                  }`}
                />
                <button
                  onClick={() => { if (isDark) onToggleTheme(); }}
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 cursor-pointer ${
                    !isDark ? 'text-white' : 'text-amber-400'
                  }`}
                  title="Use light mode"
                  aria-label="Use light mode"
                  aria-pressed={!isDark}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => { if (!isDark) onToggleTheme(); }}
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 cursor-pointer ${
                    isDark ? 'text-white' : 'text-slate-500'
                  }`}
                  title="Use dark mode"
                  aria-label="Use dark mode"
                  aria-pressed={isDark}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                </button>
              </div>

              {/* Notification Bell */}
              <NotificationBell notifications={notifications} onViewAll={onNavigateNotif} />

              {/* Account dropdown */}
              <AccountDropdown user={user} onLogout={onLogout} onSettings={onSettings} />
            </div>
          </div>
        )}

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
