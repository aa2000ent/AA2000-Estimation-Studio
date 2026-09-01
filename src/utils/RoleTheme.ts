// ─────────────────────────────────────────────
//  RoleTheme.ts — Central role-based color utility
//  Usage: const theme = getRoleTheme(user.role)
// ─────────────────────────────────────────────

export interface RoleTheme {
  role: 'ACCOUNTING' | 'ADMIN';
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  // Gradient strings
  heroGradient: string;
  sidebarGradient: string;
  buttonGradient: string;
  // Alpha / tint variants
  primaryAlpha08: string;
  primaryAlpha12: string;
  primaryAlpha20: string;
  primaryAlpha30: string;
  // Text colors on primary background
  onPrimary: string;
  // Badge / tag bg
  badgeBg: string;
  badgeText: string;
  // Sidebar bg
  sidebarBg: string;
  sidebarBorder: string;
  // Labels
  roleLabel: string;
  roleEmoji: string;
  // Dashboard hero copy
  heroSubtitle: string;
  // Quick action labels
  quickActions: { label: string; icon: string }[];
}

const ACCOUNTING_THEME: RoleTheme = {
  role: 'ACCOUNTING',
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#14B8A6',
  secondary: '#059669',
  accent: '#2DD4BF',
  heroGradient: 'linear-gradient(135deg, #134E4A 0%, #0F766E 45%, #0D9488 100%)',
  sidebarGradient: 'linear-gradient(180deg, #F0FDFA 0%, #CCFBF1 100%)',
  buttonGradient: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
  primaryAlpha08: 'rgba(13,148,136,0.08)',
  primaryAlpha12: 'rgba(13,148,136,0.12)',
  primaryAlpha20: 'rgba(13,148,136,0.20)',
  primaryAlpha30: 'rgba(13,148,136,0.30)',
  onPrimary: '#FFFFFF',
  badgeBg: 'rgba(13,148,136,0.10)',
  badgeText: '#0F766E',
  sidebarBg: '#F0FDFA',
  sidebarBorder: '#CCFBF1',
  roleLabel: 'Accounting & Finance',
  roleEmoji: '',
  heroSubtitle:
    'Welcome to your accounting & finance portal. Review project cost estimations, audit manpower and logistical fees, verify contractor/dealer margins, and approve commercial quotations.',
  quickActions: [
    { label: 'Audit Costs', icon: '' },
    { label: 'Commercial Quotes', icon: '' },
    { label: 'Financial Review', icon: '' },
    { label: 'Cost Reports', icon: '' },
  ],
};

const ADMIN_THEME: RoleTheme = {
  role: 'ADMIN',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',
  secondary: '#0284C7',
  accent: '#38BDF8',
  heroGradient: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 45%, #2563EB 100%)',
  sidebarGradient: 'linear-gradient(180deg, #EFF6FF 0%, #DBEAFE 100%)',
  buttonGradient: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
  primaryAlpha08: 'rgba(37,99,235,0.08)',
  primaryAlpha12: 'rgba(37,99,235,0.12)',
  primaryAlpha20: 'rgba(37,99,235,0.20)',
  primaryAlpha30: 'rgba(37,99,235,0.30)',
  onPrimary: '#FFFFFF',
  badgeBg: 'rgba(37,99,235,0.10)',
  badgeText: '#1D4ED8',
  sidebarBg: '#EFF6FF',
  sidebarBorder: '#DBEAFE',
  roleLabel: 'System Administrator',
  roleEmoji: '',
  heroSubtitle:
    'Welcome to the system control center. Create estimation projects, assign technical teams, review surveys, and approve final equipment pricing estimates.',
  quickActions: [
    { label: 'Assign Project', icon: '' },
    { label: 'Review Approvals', icon: '' },
    { label: 'Manage Teams', icon: '' },
    { label: 'Generate Reports', icon: '' },
  ],
};

const TECHNICIAN_THEME: RoleTheme = {
  role: 'TECHNICIAN' as any,
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#6366F1',
  secondary: '#0284C7',
  accent: '#38BDF8',
  heroGradient: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 45%, #4F46E5 100%)',
  sidebarGradient: 'linear-gradient(180deg, #EEF2FF 0%, #E0E7FF 100%)',
  buttonGradient: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
  primaryAlpha08: 'rgba(79,70,229,0.08)',
  primaryAlpha12: 'rgba(79,70,229,0.12)',
  primaryAlpha20: 'rgba(79,70,229,0.20)',
  primaryAlpha30: 'rgba(79,70,229,0.30)',
  onPrimary: '#FFFFFF',
  badgeBg: 'rgba(79,70,229,0.10)',
  badgeText: '#4338CA',
  sidebarBg: '#EEF2FF',
  sidebarBorder: '#E0E7FF',
  roleLabel: 'Field Technician & Surveyor',
  roleEmoji: '🛠️',
  heroSubtitle:
    'Welcome to your technician survey workspace. Conduct site surveys, map room layouts & equipment counts, and submit technical specifications for engineering review.',
  quickActions: [
    { label: 'Start Survey', icon: '📝' },
    { label: 'View Floor Plan', icon: '📐' },
    { label: 'My Projects', icon: '📂' },
    { label: 'Survey Reports', icon: '📊' },
  ],
};

export function getRoleTheme(role?: string, isDark?: boolean): RoleTheme {
  let baseTheme: RoleTheme;
  switch (role) {
    case 'ADMIN':
      baseTheme = ADMIN_THEME;
      break;
    case 'TECHNICIAN':
      baseTheme = TECHNICIAN_THEME;
      break;
    case 'ACCOUNTING':
    default:
      baseTheme = ACCOUNTING_THEME;
      break;
  }

  if (isDark) {
    return {
      ...baseTheme,
      sidebarBg: '#0D1527',
      sidebarBorder: '#1E293B',
      sidebarGradient: 'linear-gradient(180deg, #0D1527 0%, #131B2E 100%)',
    };
  }

  return baseTheme;
}
