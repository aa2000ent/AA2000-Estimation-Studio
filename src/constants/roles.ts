// Constants for roles and permissions
export const ROLES = {
  ACCOUNTING: 'ACCOUNTING',
  PROCUREMENT: 'PROCUREMENT',
  ADMIN: 'ADMIN',
  TECHNICIAN: 'TECHNICIAN',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ── Hardcoded user credentials for testing ──
export interface UserCredential {
  employeeId: string;
  pin: string;
  fullName: string;
  role: Role;
}

export const USER_CREDENTIALS: UserCredential[] = [
  { employeeId: 'ACCOUNTING',  pin: '111111', fullName: 'Accounting',  role: 'ACCOUNTING' },
  { employeeId: 'PROCUREMENT', pin: '111111', fullName: 'Procurement', role: 'PROCUREMENT' },
  { employeeId: 'ADMIN',       pin: '111111', fullName: 'Admin',       role: 'ADMIN' },
  { employeeId: 'TECHNICIAN',  pin: '111111', fullName: 'Technician',  role: 'TECHNICIAN' },
];

// User roles and their permissions
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [ROLES.ACCOUNTING]: [
    'view_all_projects',
    'view_estimates',
    'audit_costs',
    'view_pricing',
    'approve_financials',
    'export_reports',
    'view_quotations',
  ],
  [ROLES.PROCUREMENT]: [
    'view_all_projects',
    'view_estimates',
    'view_materials',
    'manage_pricelists',
    'export_boq',
    'view_boq_breakdown',
    'audit_hardware',
  ],
  [ROLES.ADMIN]: [
    'view_all_projects',
    'create_projects',
    'edit_all_projects',
    'approve_estimates',
    'manage_users',
    'manage_surveys',
    'manage_settings',
  ],
  [ROLES.TECHNICIAN]: [
    'view_all_projects',
    'view_estimates',
    'view_materials',
    'manage_surveys',
  ],
};

export function canViewPrices(userRole?: string | null, user?: { id?: string; role?: string; email?: string } | null): boolean {
  const role = (userRole || user?.role || '').toUpperCase();
  if (role === 'TECHNICIAN') return false;
  if (user?.id?.toLowerCase().includes('tech') || user?.email?.toLowerCase().includes('tech')) return false;
  return true;
}

// Survey status states
export const SURVEY_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  REVIEWING: 'Reviewing',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

export type SurveyStatus = typeof SURVEY_STATUS[keyof typeof SURVEY_STATUS];

// Project status states
export const PROJECT_STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  FINALIZED: 'Finalized',
  FINALIZED_APPROVED: 'Finalized - Approved',
  FINALIZED_REJECTED: 'Finalized - Rejected',
  COMPLETED: 'Completed',
} as const;

export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

// User session status
export const SESSION_STATUS = {
  ACTIVE: 'Active',
  IDLE: 'Idle',
  EXPIRED: 'Expired',
  LOGGED_OUT: 'Logged Out',
} as const;

export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

// Material categories for estimation
export const MATERIAL_CATEGORIES = {
  HARDWARE: 'Hardware',
  WIRES_CABLES: 'Wires & Cables',
  MOUNTING_HARDWARE: 'Mounting Hardware',
  TOOLS: 'Tools',
  SAFETY_EQUIPMENT: 'Safety Equipment',
  LABELS_BRACKETS: 'Labels & Brackets',
  PROTECTIVE_COVERINGS: 'Protective Coverings',
  OTHER: 'Other',
} as const;

export type MaterialCategory = typeof MATERIAL_CATEGORIES[keyof typeof MATERIAL_CATEGORIES];

export const DEFAULT_TECHNICIANS = [
  { id: 'aa0085', fullName: 'Jherwin', email: '' },
  { id: 'aa0051', fullName: 'Christopher', email: '' },
  { id: 'aa0052', fullName: 'Eula', email: '' },
  { id: 'aa0004', fullName: 'Mary Grace', email: '' },
];
