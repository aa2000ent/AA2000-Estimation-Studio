import { useState, useEffect, useRef } from 'react';
import type { User } from '../../App';
import { getRoleTheme } from '../../utils/RoleTheme';

interface Props {
  user: User;
  onLogout: () => void;
  onSettings: () => void;
}

export default function AccountDropdown({ user, onLogout, onSettings }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = getRoleTheme(user.role);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initials = (user.fullName || user.email || 'User')
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleLabel =
    user.role === 'ADMIN' ? 'Administrator' :
    user.role === 'TECHNICIAN' ? 'Field Technician' : 'Accounting & Finance';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs transition-all focus:outline-none cursor-pointer btn-press"
        style={{
          background: theme.buttonGradient,
          boxShadow: open ? `0 0 0 3px ${theme.primary}30` : undefined,
        }}
        title="Account Menu"
      >
        {initials}
      </button>
      <span className="absolute -right-0.5 -bottom-0.5 z-10 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0D1527] pointer-events-none" />

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-60 rounded-2xl bg-white border shadow-xl overflow-hidden animate-scale-in"
          style={{ borderColor: '#E2E8F0' }}
        >
          {/* Header */}
          <div
            className="px-4 py-4 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${theme.primary}08, ${theme.accent}05)` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0"
                style={{ background: theme.buttonGradient }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user.fullName || user.email}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                <span
                  className="inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1 uppercase tracking-wide"
                  style={{ background: theme.primaryAlpha12, color: theme.primary }}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
            {/* Online indicator */}
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[9px] font-bold text-emerald-700">Online & Active</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: '#F1F5F9' }} />

          {/* Actions */}
          <div className="p-2 space-y-0.5">
            <button
              onClick={() => { setOpen(false); onSettings(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors text-left cursor-pointer group"
            >
              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              Account Settings
            </button>

            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-left cursor-pointer group"
            >
              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-red-100 transition-colors shrink-0">
                <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
