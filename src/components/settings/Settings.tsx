import React, { useState } from 'react';
import type { User } from '../../App';
import NotificationBell from '../notifications/NotificationBell';
import type { Notification } from '../notifications/NotificationBell';
import { Document, ChatBubble } from '../../utils/Icons';

interface Props {
  user: User;
  onBack: () => void;
  onLogout?: () => void;
  notifications?: Notification[];
}

type SettingsTab = 'account' | 'position' | 'userid' | 'privacy' | 'help' | 'accessibility';

const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'account',
    label: 'Account Info',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    key: 'position',
    label: 'Position in Company',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    key: 'userid',
    label: 'User ID Reference',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
      </svg>
    ),
  },
  {
    key: 'privacy',
    label: 'Settings & Privacy',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    key: 'help',
    label: 'Help & Support',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    key: 'accessibility',
    label: 'Display & Layout',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className="w-11 h-6 rounded-full p-0.5 transition-all duration-300 relative bg-[#E2E8F0]"
      style={{
        background: on ? '#1E3A8A' : '#E2E8F0',
      }}
    >
      <div
        className="w-5 h-5 rounded-full transition-all duration-300 bg-white"
        style={{
          transform: on ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

export default function Settings({ user, onBack, onLogout, notifications = [] }: Props) {
  const [tab, setTab] = useState<SettingsTab>('account');

  const isAdmin = user.role === 'ADMIN';
  const initials = (user.fullName || user.email || 'Admin User').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  };

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] pb-12">
      {/* Top Header Card */}
      <div className="px-8 pt-6 pb-4 bg-white border-b border-slate-200 shadow-sm animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Account & Settings</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-100">
                {user.role === 'ADMIN' ? 'Administrator' :
                 user.role === 'PROCUREMENT' ? 'Procurement & Sourcing' : 'Accounting & Finance'}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Manage your profile, system preferences, and platform configurations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Log out</span>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Settings Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-sm"
                style={{
                  background: active ? '#1E3A8A' : '#F8FAFC',
                  color: active ? '#FFFFFF' : '#475569',
                  border: active ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                }}
              >
                <span style={{ color: active ? '#FFFFFF' : '#64748B' }}>{t.icon}</span>
                <span style={{ color: active ? '#FFFFFF' : '#475569' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Content Body */}
      <main className="px-8 py-6 max-w-5xl mx-auto">
        <h2 className="text-sm font-black mb-4 text-slate-800 uppercase tracking-wider">
          {tabs.find(t => t.key === tab)?.label}
        </h2>

        <div className="w-full">
          {/* Account Info */}
          {tab === 'account' && (
            <div>
              {/* Avatar card */}
              <div
                className="rounded-2xl p-6 mb-4 flex items-center gap-4 bg-white border border-slate-100"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0"
                  style={{ background: '#1E3A8A' }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-base font-black text-slate-800">{user.fullName || user.email}</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">{user.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Role',
                    value: user.role === 'ADMIN' ? 'Administrator' :
                           user.role === 'PROCUREMENT' ? 'Procurement & Sourcing' : 'Accounting & Finance',
                    color: '#1E3A8A'
                  },
                  { label: 'User ID Reference', value: user.id, mono: true, color: '#64748B' },
                  { label: 'Network Connection', value: 'Live Active', color: '#10B981' },
                  { label: 'Platform Region', value: 'Philippines (PHP)', color: '#64748B' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-4 bg-white border border-slate-200">
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-1 text-slate-400">{item.label}</p>
                    <p className={`text-xs font-black ${item.mono ? 'font-mono' : ''}`} style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'position' && (
            <div className="rounded-2xl p-6 bg-white border border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Company Position</p>
              <p className="text-base font-black text-slate-800 mb-2">
                {user.role === 'ADMIN' ? 'Administrator' :
                 user.role === 'PROCUREMENT' ? 'Procurement & Sourcing Specialist' : 'Accounting & Financial Auditor'}
              </p>
              <p className="text-xs text-slate-400 font-semibold">Department: Security and Technology Solutions</p>
            </div>
          )}

          {tab === 'userid' && (
            <div className="rounded-2xl p-6 bg-white border border-slate-200">
              <p className="text-[9px] font-bold uppercase tracking-wider mb-2 text-slate-400">User Reference ID</p>
              <p className="font-mono text-xl font-black text-[#1E3A8A]">{user.id}</p>
            </div>
          )}

          {tab === 'privacy' && (
            <div>
              {[
                { label: 'Email Notifications', desc: 'Receive updates about assignments', on: true },
                { label: 'Push Notifications', desc: 'Get real-time alerts on your device', on: false },
                { label: 'Location Tracking', desc: 'Allow technician mapping during site survey', on: true },
                { label: 'Activity Logs', desc: 'Record your login and activity history', on: true },
              ].map(item => (
                <div key={item.label} style={cardStyle}>
                  <div>
                    <p className="text-xs font-black text-slate-700">{item.label}</p>
                    <p className="text-[11px] font-semibold mt-0.5 text-slate-400">{item.desc}</p>
                  </div>
                  <Toggle defaultOn={item.on} />
                </div>
              ))}
            </div>
          )}

          {tab === 'help' && (
            <div className="rounded-2xl p-6 space-y-4 bg-white border border-slate-200">
              <p className="text-xs font-semibold text-slate-500">
                Need help? Contact our command center support at{' '}
                <span className="font-bold text-[#1E3A8A]">support@aa2000.com.ph</span>
              </p>
              {[
                { label: 'Connect User Manual', icon: Document, desc: 'Read the platform user guide' },
                { label: 'Direct Tech Support', icon: ChatBubble, desc: 'Chat with our support team' },
                { label: 'Report system anomaly', icon: undefined, desc: 'Submit a ticket directly' },
              ].map(item => (
                <div
                  key={item.label}
                  className="px-4 py-3 rounded-xl cursor-pointer border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">{item.icon && React.createElement(item.icon, { className: 'w-4 h-4' })}{item.label}</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'accessibility' && (
            <div>
              <div style={cardStyle}>
                <div>
                  <p className="text-xs font-black text-slate-700">Light Theme (Screenshot Standard)</p>
                  <p className="text-[11px] font-semibold mt-0.5 text-slate-400">Locked to default light mode as requested</p>
                </div>
                <div className="px-3 py-1 rounded bg-[#E0E7FF] text-[#1E3A8A] text-[9px] font-black uppercase tracking-wider">ACTIVE</div>
              </div>
              {[
                { label: 'Compact Mode Layout', desc: 'Use denser margins for small monitors', on: false },
                { label: 'High Contrast Mode', desc: 'Increase outline contrast on tables', on: false },
                { label: 'Reduced Motion Engine', desc: 'Disable spline map animations', on: false },
              ].map(item => (
                <div key={item.label} style={cardStyle}>
                  <div>
                    <p className="text-xs font-black text-slate-700">{item.label}</p>
                    <p className="text-[11px] font-semibold mt-0.5 text-slate-400">{item.desc}</p>
                  </div>
                  <Toggle defaultOn={item.on} />
                </div>
              ))}
            </div>
          )}
          </div>
        </main>
    </div>
  );
}
