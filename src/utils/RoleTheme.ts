// ─────────────────────────────────────────────
//  RoleTheme.ts — Central role-based color utility
//  Usage: const theme = getRoleTheme(user.role)
// ─────────────────────────────────────────────

export interface RoleTheme {
  role: 'ACCOUNTING' | 'PROCUREMENT' | 'ADMIN';
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
    'Welcome to your accounting & audit portal. Review project cost estimations, audit manpower and logistical fees, verify contractor/dealer margins, and approve commercial quotations.',
  quickActions: [
    { label: 'Audit Costs', icon: '' },
    { label: 'Commercial Quotes', icon: '' },
    { label: 'Financial Review', icon: '' },
    { label: 'Cost Reports', icon: '' },
  ],
};

const PROCUREMENT_THEME: RoleTheme = {
  role: 'PROCUREMENT',
  primary: '#D97706',
  primaryDark: '#B45309',
  primaryLight: '#F59E0B',
  secondary: '#EA580C',
  accent: '#FBBF24',
  heroGradient: 'linear-gradient(135deg, #78350F 0%, #B45309 45%, #D97706 100%)',
  sidebarGradient: 'linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 100%)',
  buttonGradient: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  primaryAlpha08: 'rgba(217,119,6,0.08)',
  primaryAlpha12: 'rgba(217,119,6,0.12)',
  primaryAlpha20: 'rgba(217,119,6,0.20)',
  primaryAlpha30: 'rgba(217,119,6,0.30)',
  onPrimary: '#FFFFFF',
  badgeBg: 'rgba(217,119,6,0.10)',
  badgeText: '#B45309',
  sidebarBg: '#FFFBEB',
  sidebarBorder: '#FEF3C7',
  roleLabel: 'Procurement & Sourcing',
  roleEmoji: '',
  heroSubtitle:
    'Welcome to your procurement & inventory workspace. Review Bill of Materials (BOM/BOQ), cross-reference hardware item specifications, track brand pricelists, and verify equipment quantities.',
  quickActions: [
    { label: 'View BOQ Lists', icon: '' },
    { label: 'Check Pricelist', icon: '' },
    { label: 'Material Audit', icon: '' },
    { label: 'Export BOM', icon: '' },
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

export function getRoleTheme(role?: string, isDark?: boolean): RoleTheme {
  let baseTheme: RoleTheme;
  switch (role) {
    case 'ADMIN':
      baseTheme = ADMIN_THEME;
      break;
    case 'PROCUREMENT':
      baseTheme = PROCUREMENT_THEME;
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
