// Common types shared across the application
type User = {
  id: string;
  fullName: string;
  email: string;
  role?: 'ACCOUNTING' | 'ADMIN';
  department?: string;
  phone?: string;
};

type Project = {
  id: string;
  name: string;
  clientName: string;
  clientContactName?: string;
  locationName: string;
  location: string;
  status: 'Pending' | 'In Progress' | 'Finalized' | 'Finalized - Approved' | 'Finalized - Rejected' | 'Completed';
  startDate?: string;
  assignedTechnicians: User[];
  technicianName?: string;
  technicianResponses?: Record<string, 'ACCEPTED' | 'DECLINED'>;
  completionDate?: string;
  finalization?: {
    actedAt: string;
    reviewer?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
};

type SurveyType = 'CCTV' | 'FIRE_ALARM' | 'FIRE_PROTECTION' | 'ACCESS_CONTROL' | 'BURGLAR_ALARM' | 'OTHER';

type SurveyData<T> = {
  surveyType: SurveyType;
  data: T;
  createdAt: string;
  completedBy?: string;
};

type EstimationDetail = {
  type: SurveyType;
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  logistics: EstimationAdditionalFeeEntry[];
  siteConstraints: EstimationSiteConstraintEntry;
  createdAt: string;
  updatedAt: string;
};

type EstimationManpowerEntry = {
  id: string;
  role: string;
  headcount: number;
  hours: number;
  manDays: number;
  dayRate?: number;
  totalCost?: number;
};

type EstimationConsumableEntry = {
  id: string;
  name: string;
  brand?: string;
  category: string;
  quantity: number;
  unit?: string;
  unitPrice: number;   // kept for internal use / future quotation app handoff
  totalPrice: number;  // kept for internal use / future quotation app handoff
  srp?: number;
  contractorPrice?: number;
  dealerPrice?: number;
  productId?: string;
  notes?: string;
};

type EstimationAdditionalFeeEntry = {
  id: string;
  type: 'Travel Fee' | 'Congestion Fee' | 'Short Notice Fee' | 'Overtime Fee' | 'Weekend Fee' | 'Holiday Fee' | 'Permit Fee' | 'Other';
  amount: number;      // kept for future quotation app handoff
  description: string;
  notes?: string;
};

type EstimationSiteConstraintEntry = {
  physicalConstraints: Record<string, string>;
  electricalConstraints: Record<string, string>;
  installationConstraints: Record<string, string>;
};

export type {
  User,
  Project,
  SurveyType,
  SurveyData,
  EstimationDetail,
  EstimationManpowerEntry,
  EstimationConsumableEntry,
  EstimationAdditionalFeeEntry,
  EstimationSiteConstraintEntry,
};
