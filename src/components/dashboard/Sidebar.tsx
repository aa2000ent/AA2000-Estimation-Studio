import React, { useState, useMemo, useEffect } from 'react';
import type { User, Project, AIScanGroup } from '../../App';
import type { Notification } from '../notifications/NotificationBell';
import { getRoleTheme } from '../../utils/RoleTheme';
import logo from '../../images/logo.png';
import { getSavedBOQCount } from '../floor-plan/SavedBOQsView';
import { getSavedEstimationCount } from '../estimation/SavedEstimationsView';

type View =
  | 'home' | 'dashboard' | 'workspace' | 'create-survey'
  | 'todo' | 'assignment' | 'missing' | 'done' | 'history'
  | 'approval' | 'finalize'
  | 'ongoing' | 'upcoming' | 'missing-notif' | 'approval-notif' | 'finalize-notif'
  | 'notifications' | 'calendar' | 'floor-plan'
  | 'cctv' | 'fire_alarm' | 'fire_protection' | 'access_control' | 'burglar_alarm' | 'other'
  | 'ai-reader' | 'estimation-hub' | 'saved-folders' | 'saved-boqs' | 'saved-estimations';

interface Props {
  user: User;
  currentView: View;
  onNavigate: (view: View) => void;
  notifications?: Notification[];
  projects?: Project[];
  aiScans?: AIScanGroup[];
  onNewSurvey?: () => void;
  isMobile?: boolean;
  isDark?: boolean;
}

const navIcons: Record<string, (active: boolean) => React.ReactNode> = {
  home: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.06l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 0 0 1.061 1.06l8.69-8.69Z" />
      <path d="M12 5.432 8.159 9.59a.75.75 0 0 0-.159.372v8.788c0 .621.504 1.125 1.125 1.125H9.75v-4.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21h1.125c.621 0 1.125-.504 1.125-1.125V9.963a.75.75 0 0 0-.159-.372L12 5.432Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  dashboard: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Z" />
      <path d="M3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25Z" />
      <path d="M13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Z" />
      <path d="M13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
    </svg>
  ),
  workspace: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4.5 21a.75.75 0 0 1 0-1.5h15a.75.75 0 0 1 0 1.5h-15Z" />
      <path d="M3 5.25a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 5.25V18a.75.75 0 0 1-.75.75H3.75A.75.75 0 0 1 3 18V5.25Z" />
      <path d="M9 7.5a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H9Z" />
      <path d="M12.75 7.5a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5h-2.25Z" />
      <path d="M9 11.25a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H9Z" />
      <path d="M12.75 11.25a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5h-2.25Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  'create-survey': (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H5.25a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  assignment: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5.625 3.75a2.625 2.625 0 0 0-2.625 2.625v11.25a2.625 2.625 0 0 0 2.625 2.625h12.75a2.625 2.625 0 0 0 2.625-2.625V9.843a2.625 2.625 0 0 0-.769-1.856l-4.218-4.218a2.625 2.625 0 0 0-1.856-.769H5.625Z" />
      <path d="M12.75 4.875v3.375c0 .621.504 1.125 1.125 1.125h3.375" />
      <path d="M8.25 12.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5Z" />
      <path d="M8.25 15.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  missing: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  done: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-8.25-3.75a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 .3.6l3 2.25a.75.75 0 1 0 .9-1.2l-2.7-2.025V8.25Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  history: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .204.082.4.228.545l3 3a.75.75 0 1 0 1.06-1.06l-2.788-2.788V6Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  approval: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516 11.209 11.209 0 0 1-7.877-3.08Z" />
      <path d="m9.75 12.75 1.5 1.5 3.75-4.5" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  finalize: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-10.5 4.5a.75.75 0 0 1-.53-.22l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.47-5.47a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 0 1-.53.22Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  ongoing: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.439 2.17a.75.75 0 0 0-1.018.523l-3.75 12.75a.75.75 0 0 0 .718.947h5.011l-1.334 5.443a.75.75 0 0 0 1.254.732l7.5-8.25a.75.75 0 0 0-.525-1.265H14.93l2.759-7.726a.75.75 0 0 0-.52-.99L12.44 2.17Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  upcoming: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18 3.75a2.25 2.25 0 0 1 2.25 2.25v12.75A2.25 2.25 0 0 1 18 21H6a2.25 2.25 0 0 1-2.25-2.25V6A2.25 2.25 0 0 1 6 3.75h.75V2.25a.75.75 0 0 1 1.5 0V3.75h7.5V2.25a.75.75 0 0 1 1.5 0V3.75H18Z" />
      <path d="M6.75 8.25h10.5v1.5H6.75v-1.5Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  'missing-notif': (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5.25 9A6.75 6.75 0 0 1 18 9v2.156c0 1.856.664 3.659 1.873 5.076l.05.058a1.5 1.5 0 0 1-1.157 2.46H3.234a1.5 1.5 0 0 1-1.157-2.46l.05-.058A7.718 7.718 0 0 0 5.25 11.157V9Z" />
      <path d="M10 20.25a2 2 0 0 0 4 0" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  'approval-notif': (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516 11.209 11.209 0 0 1-7.877-3.08Z" />
      <path d="m9.75 12.75 1.5 1.5 3.75-4.5" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  'finalize-notif': (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-10.5 4.5a.75.75 0 0 1-.53-.22l-3-3a.75.75 0 1 1 1.06-1.06l2.47 2.47 5.47-5.47a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 0 1-.53.22Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  notifications: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5.25 9A6.75 6.75 0 0 1 18 9v2.156c0 1.856.664 3.659 1.873 5.076l.05.058a1.5 1.5 0 0 1-1.157 2.46H3.234a1.5 1.5 0 0 1-1.157-2.46l.05-.058A7.718 7.718 0 0 0 5.25 11.157V9Z" />
      <path d="M10 20.25a2 2 0 0 0 4 0" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  calendar: (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18 3.75a2.25 2.25 0 0 1 2.25 2.25v12.75A2.25 2.25 0 0 1 18 21H6a2.25 2.25 0 0 1-2.25-2.25V6A2.25 2.25 0 0 1 6 3.75h.75V2.25a.75.75 0 0 1 1.5 0V3.75h7.5V2.25a.75.75 0 0 1 1.5 0V3.75H18Z" />
      <path d="M6.75 8.25h10.5v1.5H6.75v-1.5Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  'ai-reader': () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
    </svg>
  ),
  'floor-plan': (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm11 1.5v3h4.5v-3H14Zm4.5 4.5H14v4.5h4.5V12ZM12.5 16.5v-9h-6v9h6Z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6ZM13.5 3.75v16.5M3.75 10.5h9.75" />
    </svg>
  ),
  'estimation-hub': (active) => active ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      <path d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
    </svg>
  ),
  'saved-folders': (active) => (
    <svg className="w-4 h-4" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      {active ? (
        <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.125V6a3 3 0 0 1 3-3h5.25a3 3 0 0 1 2.25.975l.9.975a1.5 1.5 0 0 0 1.125.488H19.5a3 3 0 0 1 3 3v1.688A4.5 4.5 0 0 0 19.5 9h-15a4.5 4.5 0 0 0-3 1.125Z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      )}
    </svg>
  ),
  'saved-boqs': (active) => (
    <svg className="w-4 h-4" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      {active ? (
        <path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm11 1.5v3h4.5v-3H14Zm4.5 4.5H14v4.5h4.5V12ZM12.5 16.5v-9h-6v9h6Z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      )}
    </svg>
  ),
  'saved-estimations': (active) => (
    <svg className="w-4 h-4" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      {active ? (
        <path d="M5.625 3.75a2.625 2.625 0 0 0-2.625 2.625v11.25a2.625 2.625 0 0 0 2.625 2.625h12.75a2.625 2.625 0 0 0 2.625-2.625V9.843a2.625 2.625 0 0 0-.769-1.856l-4.218-4.218a2.625 2.625 0 0 0-1.856-.769H5.625Zm2.625 9a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      )}
    </svg>
  ),

};

export default function Sidebar({ user, currentView, onNavigate, notifications, projects, aiScans, onNewSurvey, isMobile, isDark }: Props) {
  const isAdmin = user.role === 'ADMIN';
  const theme = getRoleTheme(user.role, isDark);
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = isMobile ? false : collapsedState;
  const [dashboardDropdownOpen, setDashboardDropdownOpen] = useState(true);
  const [savedBOQCount, setSavedBOQCount] = useState(0);
  const [savedEstCount, setSavedEstCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setSavedBOQCount(getSavedBOQCount());
      setSavedEstCount(getSavedEstimationCount());
    };
    refresh();
    // Re-read whenever the view changes (covers saves done in-session)
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [currentView]);

  const categoryCounts = useMemo(() => {
    try {
      const projectList = projects || [];
      const companyFolders = projectList.filter(p => p.buildingType === 'Other');
      const actualProjects = projectList.filter(p => p.buildingType !== 'Other');
      const counts: Record<string, number> = { CCTV: 0, FIRE_ALARM: 0, FIRE_PROTECTION: 0, ACCESS_CONTROL: 0, BURGLAR_ALARM: 0, OTHER: 0 };

      const categorySysTypes: Record<string, string[]> = {
        CCTV: ['CCTV'],
        FIRE_ALARM: ['FDAS'],
        FIRE_PROTECTION: ['FIRE_PROTECTION'],
        ACCESS_CONTROL: ['ACCESS_CONTROL'],
        BURGLAR_ALARM: ['BURGLAR_ALARM'],
        OTHER: ['DOOR_LOCK', 'EAS_SYSTEM', 'FIXED_ARM_ELEVATOR', 'INTERCOM_NURSE_CALL', 'PABX_PAGING', 'PARKING_BARRIER', 'POS_SYSTEM', 'ROOM_ALERT', 'XRAY_SECURITY'],
      };

      for (const [key, sysTypes] of Object.entries(categorySysTypes)) {
        counts[key] = companyFolders.filter(folder => {
          if (folder.systemTypes && folder.systemTypes.length > 0) {
            if (folder.systemTypes.some(sys => sysTypes.includes(sys))) return true;
          }
          const clean = (s?: string) => (s || '').trim().toLowerCase();
          const folderName = clean(folder.name);
          const folderClientName = clean(folder.clientName);
          const children = actualProjects.filter(
            p => clean(p.clientName) === folderName || clean(p.clientName) === folderClientName
          );
          if (children.length === 0) return false;
          return children.some(p => {
            if (!p.systemTypes || p.systemTypes.length === 0) return true;
            return p.systemTypes.some(sys => sysTypes.includes(sys));
          });
        }).length;
      }

      return counts;
    } catch (e) {
      return { CCTV: 0, FIRE_ALARM: 0, FIRE_PROTECTION: 0, ACCESS_CONTROL: 0, BURGLAR_ALARM: 0, OTHER: 0 };
    }
  }, [projects]);

  const getUnreadCount = (viewName: View) => {
    if (!notifications) return 0;
    if (viewName === 'notifications') {
      return notifications.filter(n => !n.read).length;
    }
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

  const getNotificationCount = (viewName: View) => {
    if (!notifications) return 0;
    if (viewName === 'notifications') {
      return notifications.length;
    }
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
    return notifications.filter(n => n.type === notifType).length;
  };

  const isNotificationView = [
    'notifications', 'ongoing', 'upcoming', 'missing-notif', 'approval-notif'
  ].includes(currentView);

  const isAccounting = user.role === 'ACCOUNTING';
  const isProcurement = user.role === 'PROCUREMENT';
  const canApprove = isAdmin || isAccounting;
  const canUseEstimationHub = isAdmin || isAccounting || isProcurement;
  const canViewSavedBOQs = isAdmin || isAccounting || isProcurement;

  const navGroups: { label: string; items: { label: string; view: View; accent?: string; _count?: number }[] }[] = isNotificationView ? [
    {
      label: 'NOTIFICATION',
      items: [
        { view: 'notifications', label: 'All Notifications', accent: '#2563EB' },
        { view: 'ongoing', label: 'Ongoing Surveys', accent: '#2563EB' },
        { view: 'upcoming', label: 'Upcoming Surveys', accent: '#10B981' },
        { view: 'missing-notif', label: 'Missing Alerts', accent: '#F59E0B' },
        ...(canApprove
          ? [
            { view: 'approval-notif' as View, label: 'Approval Alerts', accent: '#2563EB' }
          ]
          : []),
      ],
    },
  ] : [
    {
      label: isAccounting ? 'FINANCE' : isProcurement ? 'SOURCING' : 'SURVEYS',
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
          : [{ view: 'done' as View, label: isProcurement ? 'Required Materials' : 'Completed Surveys', accent: '#10B981' }]),
        { view: 'history', label: 'History Archive', accent: '#64748B' },
      ],
    },
    ...(canUseEstimationHub
      ? [
        {
          label: 'TOOLS',
          items: [
            { view: 'estimation-hub' as View, label: 'Estimation Hub', accent: '#2563EB' },
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

  const initials = (user.fullName || user.email || 'Admin User')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const totalUnread = notifications ? notifications.filter(n => !n.read).length : 0;

  return (
    <aside
      className="flex flex-col h-full shrink-0 overflow-hidden transition-all duration-300 w-full"
      style={{
        width: isMobile ? '100%' : collapsed ? 68 : 280,
        background: theme.sidebarBg,
        borderRight: `1px solid ${theme.sidebarBorder}`,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* ── Brand Logo / Back + Collapse toggle ── */}
      <div
        className="px-4 h-16 flex items-center justify-between shrink-0"
        style={{ borderBottom: `1px solid ${theme.sidebarBorder}` }}
      >
        {isNotificationView ? (
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 font-bold text-xs transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#2563EB')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {!collapsed && <span>Back to Dashboard</span>}
          </button>
        ) : (
          <div
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity min-w-0"
            onClick={() => onNavigate('dashboard')}
          >
            <img
              src={logo}
              alt="AA2000 Logo"
              className="w-11 h-11 rounded-xl shrink-0 transition-transform hover:scale-105 object-contain"
            />
            {!collapsed && (
              <div className="min-w-0 overflow-hidden">
                <span
                  className="text-2xl font-bold leading-none block select-none"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '0',
                    color: '#2563EB',
                    lineHeight: 1,
                  }}
                >
                  AA2000
                </span>
                <p className="text-[11px] font-normal leading-tight text-[#94A3B8]" style={{ marginTop: '2px' }}>
                  Security and Technology Solutions Inc.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Collapse toggle (Desktop only) */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md transition-colors shrink-0 ml-auto cursor-pointer"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#2563EB')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#94A3B8')}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── "+ New Survey" Action Button (Below AA2000 Branding) — Admin only ── */}
      {isAdmin && (
        <div className={`px-3 pt-3 pb-1 shrink-0 ${collapsed ? 'flex justify-center px-2' : ''}`}>
          <button
            onClick={() => {
              if (onNewSurvey) {
                onNewSurvey();
              } else {
                onNavigate('create-survey');
              }
            }}
            title="Create New Site Survey"
            className={`w-full flex items-center justify-center gap-2 font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:brightness-105 active:scale-95 transition-all duration-200 cursor-pointer group ${
              collapsed
                ? 'w-10 h-10 rounded-xl p-0'
                : 'py-2.5 px-4 rounded-2xl text-xs sm:text-[13px] tracking-wide'
            }`}
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            }}
          >
            <svg
              className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} text-white shrink-0 transition-transform duration-200 group-hover:rotate-90`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {!collapsed && <span>New Survey</span>}
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-5">

        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: '#94A3B8' }}
              >
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isSubViewActive = ['cctv', 'fire_alarm', 'fire_protection', 'access_control', 'burglar_alarm', 'other'].includes(currentView);
                const active = currentView === item.view || (item.view === 'dashboard' && isSubViewActive);
                const isNotifItem = [
                  'notifications', 'ongoing', 'upcoming', 'missing-notif', 'approval-notif', 'finalize-notif'
                ].includes(item.view);

                const count = isNotifItem || item.view === 'missing' ? getNotificationCount(item.view) : getUnreadCount(item.view);
                // _count is used for saved-boqs / saved-estimations badge
                const savedCount = item._count ?? 0;
                const displayCount = savedCount > 0 ? savedCount : count;
                const accentColor = item.accent || '#2563EB';

                return (
                  <div key={item.view} className="space-y-0.5">
                    <button
                      onClick={() => onNavigate(item.view)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[15px] font-bold text-left transition-all relative group ${collapsed ? 'justify-center' : ''} ${!active ? 'hover:bg-blue-100/60 hover:text-blue-700' : ''}`}
                      style={
                        active
                          ? {
                            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4), 0 1px 3px rgba(0,0,0,0.1)',
                          }
                          : {
                            color: '#64748B',
                            borderRadius: '10px',
                          }
                      }
                    >
                      {/* Active Glowing Blue Selector Bar */}
                      {active && (
                        <span
                          className="absolute left-1 top-2 bottom-2 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]"
                        />
                      )}

                      <span
                        className={`shrink-0 transition-transform group-hover:scale-110 ${!active ? 'group-hover:text-blue-600' : ''}`}
                        style={{ color: active ? '#FFFFFF' : '#94A3B8' }}
                      >
                        {navIcons[item.view](active)}
                      </span>

                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate" style={{ color: active ? '#FFFFFF' : undefined }}>
                            {item.label}
                          </span>
                          {(isNotifItem || (displayCount > 0 && item.view !== 'missing')) && (
                            <span
                              className="ml-auto shrink-0 min-w-[18px] px-1.5 py-0.5 rounded-full text-[9px] font-black text-center transition-colors"
                              style={
                                active
                                  ? {
                                    background: 'rgba(255, 255, 255, 0.25)',
                                    color: '#FFFFFF',
                                    backdropFilter: 'blur(4px)',
                                  }
                                  : {
                                    background: `${accentColor}15`,
                                    color: accentColor,
                                  }
                              }
                            >
                              {displayCount}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom Section: User Profile Card + System status ── */}
      <div
        className="shrink-0"
        style={{ borderTop: `1px solid ${theme.sidebarBorder}` }}
      >
        {/* User Profile Card */}
        <div className="p-3">
          <div
            className={`flex items-center gap-3 p-2 rounded-2xl transition-all duration-200 ${
              collapsed
                ? 'justify-center p-1'
                : isDark
                ? 'bg-[#131B2E] hover:bg-[#162032] border border-slate-700/60 shadow-2xs'
                : 'bg-white/70 hover:bg-white border border-slate-200/60 shadow-2xs'
            }`}
          >
            <div className="relative shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                }}
              >
                {initials}
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 ${isDark ? 'border-[#131B2E]' : 'border-white'}`} />
              </div>
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-black truncate leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {user.fullName || user.email}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{
                      background: isDark ? 'rgba(59,130,246,0.20)' : 'rgba(37,99,235,0.12)',
                      color: isDark ? '#60A5FA' : '#2563EB',
                    }}
                  >
                    {user.role === 'ADMIN' ? 'Admin' :
                     user.role === 'PROCUREMENT' ? 'Procurement' : 'Accounting'}
                  </span>
                  {totalUnread > 0 && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{
                        background: isDark ? 'rgba(239,68,68,0.20)' : '#FEF2F2',
                        color: isDark ? '#F87171' : '#EF4444',
                        border: isDark ? '1px solid rgba(239,68,68,0.30)' : '1px solid #FEE2E2',
                      }}
                    >
                      {totalUnread} new
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System status */}
        {!collapsed ? (
          <div className="px-4 pb-3 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider">SYSTEM ONLINE</span>
            </div>
            <span className="text-slate-400 font-semibold">v5.0</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export type { View };
