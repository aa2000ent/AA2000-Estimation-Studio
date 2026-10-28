import React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { Project, User } from '../../App';
import type { EstimationManpowerEntry, EstimationConsumableEntry, EstimationAdditionalFeeEntry } from '../../types';
import type { FloorPlanEstimation } from '../../services/geminiFloorPlanService';
import { systemBadgeIcons, Users, StatCalendar, Package as PackageIcon, Plug, Document, User as UserIcon, ArrowRight } from '../../utils/Icons';
import { useToast } from '../utils/Toast';
import { getEstimatedItemPricing, searchPricelist } from '../../services/pricelistService';
import { computeEstimationStats, computeEstimationTotals } from '../../services/estimationStats';
import ProductCatalogModal from './ProductCatalogModal';
import type { CatalogProduct } from '../../services/api/products';
import QuotationModal, { type QuotationHeaderState, type ScopeOfWorkEntry, generateSystemScopeOfWorks } from './QuotationModal';
import reportHeaderBackground from '../../assets/pdf/PDF_header.png';
import reportLogo from '../../assets/pdf/aa2000_logo.png';
import { buildStandardEstimationReportHtml } from '../../utils/standardEstimationReport';

function mapCategoryToOption(cat: string): string {
  const c = cat.toUpperCase();
  if (c.includes('CABLE') || c.includes('WIRE') || c.includes('UTP') || c.includes('RG59') || c.includes('RG6')) {
    return 'Wires & Cables';
  }
  if (c.includes('CONSUMABLE') || c.includes('TAPE') || c.includes('CONNECTOR') || c.includes('RJ45') || c.includes('MOUNT') || c.includes('BRACKET')) {
    return 'Mounting Hardware';
  }
  if (c.includes('TOOL')) {
    return 'Tools';
  }
  if (c.includes('SAFETY') || c.includes('GLOVE') || c.includes('HELMET')) {
    return 'Safety Equipment';
  }
  if (c.includes('LABEL') || c.includes('TAG')) {
    return 'Labels & Brackets';
  }
  if (c.includes('PIPE') || c.includes('CONDUIT') || c.includes('PVC') || c.includes('FLEXIBLE') || c.includes('MOULDING')) {
    return 'Protective Coverings';
  }
  if (c.includes('HARDWARE') || c.includes('CAMERA') || c.includes('NVR') || c.includes('DVR') || c.includes('SWITCH') || c.includes('READER') || c.includes('DETECTOR') || c.includes('LOCK')) {
    return 'Hardware';
  }
  return 'Other';
}

function getBrandFromProduct(p: any): string {
  if (p.brand && p.brand !== 'N/A' && p.brand !== '-') {
    return p.brand;
  }
  const sheet = (p.sheetName || '').toUpperCase();
  if (sheet.includes('HIKVISION')) return 'Hikvision';
  if (sheet.includes('DAHUA')) return 'Dahua';
  if (sheet.includes('EZVIZ')) return 'Ezviz';
  if (sheet.includes('ZKTECO') || sheet.includes('ZK_') || sheet.startsWith('ZK')) return 'ZkTeco';
  if (sheet.includes('HONEYWELL')) return 'Honeywell';
  if (sheet.includes('PARADOX')) return 'Paradox';
  if (sheet.includes('ASENWARE')) return 'Asenware';
  if (sheet.includes('HOCHIKI')) return 'Hochiki';
  if (sheet.includes('NOTIFIER')) return 'Notifier';
  if (sheet.includes('SIMPLEX')) return 'Simplex';
  if (sheet.includes('GST')) return 'GST';
  if (sheet.includes('AIPHONE')) return 'Aiphone';
  if (sheet.includes('FARFISA')) return 'Farfisa';
  if (sheet.includes('TOA')) return 'TOA';
  if (sheet.includes('AVTECH')) return 'Avtech';
  if (sheet.includes('GARRETT')) return 'Garrett';
  if (sheet.includes('UNIQSCAN')) return 'Uniqscan';
  if (sheet.includes('DAOSAFE')) return 'Daosafe';
  if (sheet.includes('EDWARDS')) return 'Edwards';
  if (sheet.includes('GAMEWELL')) return 'Gamewell';
  if (sheet.includes('HORING-LIH')) return 'Horing-Lih';
  if (sheet.includes('TYY')) return 'TYY';
  return '';
}

function detectBrandFromName(name: string): string {
  const upper = name.toUpperCase();
  
  if (upper.startsWith('DS-')) return 'Hikvision';
  if (upper.startsWith('DH-')) return 'Dahua';
  if (upper.startsWith('CP-')) return 'CP Plus';
  
  const brands = [
    'HIKVISION', 'DAHUA', 'EZVIZ', 'ZKTECO', 'HONEYWELL', 'PARADOX', 
    'ASENWARE', 'HOCHIKI', 'NOTIFIER', 'SIMPLEX', 'GST', 'AIPHONE', 
    'FARFISA', 'TOA', 'AVTECH', 'GARRETT', 'UNIQSCAN', 'DAOSAFE', 
    'EDWARDS', 'GAMEWELL', 'HORING-LIH', 'TYY', 'MAKITA', 'COMMSCOPE', 
    'PANDUIT', 'ALANTEK', 'SYSTIMAX', 'LINKBASIC'
  ];
  
  for (const b of brands) {
    if (upper.includes(b)) {
      if (b === 'ZKTECO') return 'ZkTeco';
      return b.charAt(0) + b.slice(1).toLowerCase();
    }
  }
  return '';
}

// Maps each system type to the sheetName values in products.json that belong to it.
// 'SHARED' sheets (consumables, wires) are always included regardless of system.
const SYSTEM_SHEET_MAP: Record<string, string[]> = {
  CCTV: [
    'CCTV ACCESSORIES', 'CCTV_AVTECH', 'CCTV_BOSCH', 'CCTV_DAHUA',
    'CCTV_EZVIZ', 'CCTV_HIKVISION', 'CCTV_HONEYWELL', 'CCTV_PANASONIC',
  ],
  FDAS: [
    'Copy of FDAS_ACCESSORIES', 'FDAS_ASENWARE', 'FDAS_EDWARDS',
    'FDAS_GAMEWELL BY HONEYWELL', 'FDAS_GST', 'FDAS_HOCHIKI',
    'FDAS_HONEYWELL', 'FDAS_HORING-LIH', 'FDAS_NOTIFIER',
    'FDAS_SIMPLEX', 'FDAS_TYY',
  ],
  ACCESS_CONTROL: [
    'HONEYWELL_Vista and Winpak', 'ZKTECO_A&C Accessory', 'ZKTECO_A&C Device',
    'ZKTECO_Accessories_BioCV', 'ZKTECO_Biometrics Reader', 'ZKTECO_Control Panel',
    'ZKTECO_Products_BioCV', 'ZKTECO_Smart video system', 'ZKTECO_T&A Accessory',
    'ZKTECO_Time Attendance', 'ZKTECO_UHF', 'ZKTECO_UHF Accessories',
    'ZK_Smart Business Digital Board',
  ],
  BURGLAR_ALARM: [
    'PARADOX', 'PARADOX PACKAGE, di me sigurado',
  ],
  DOOR_LOCK: [
    'HOTEL DOOR LOCK', 'ZKTECO_Lock Accessory', 'ZKTECO_Smart Hotel Solution',
    'ZKTECO_Smart Lock',
  ],
  EAS_SYSTEM: [
    'ZKTECO_EAS Products',
  ],
  FIRE_PROTECTION: [
    'ASENWARE-FIREPRO', 'EXTINGUISHER', 'FIRE PUMP', 'FIRE-PRO',
    'HONEYWELL GAS &FLAME DETECTOR  ', 'MARINE VALVE ', 'SPRINKLER',
  ],
  FIXED_ARM_ELEVATOR: [
    'ZKTECO Elevator', 'ZKTECO Fixed Arm',
  ],
  INTERCOM_NURSE_CALL: [
    'AIPHONE INTERCOM', 'FARFISA INTERCOM', 'ZKTECO VIDEO INTERCOM',
  ],
  PABX_PAGING: [
    'PABX', 'PAGING SYSTEM - HONEYWELL BRAND', 'PAGING SYSTEM - ITC BRAND',
    'PAGING SYSTEM - TOA BRAND',
  ],
  PARKING_BARRIER: [
    'BARRIER GATE', 'ZKTECO_Parking Barrier', 'ZK_Parking Barrier Accessories',
    'ZK_Parking Lock Accessories', 'ZK_Parking Lock Product', 'ZK_Vehicle Inspection',
  ],
  POS_SYSTEM: [
    'ZKTECO_POS Peripheral', 'ZKTECO_POS Terminal',
  ],
  ROOM_ALERT: [
    'AVTECH ROOM ALERT',
  ],
  XRAY_SECURITY: [
    'DAHUA_XRAY BAGGAGE & WALKTHRU', 'DAOSAFE_TURNSTILE ', 'GARRETT',
    'UNIQSCAN XRAY BAGGAGE & WALKTHR', 'ZKTECO_Explosive Detector',
    'ZKTECO_Turnstile', 'ZKTECO_X-ray', 'ZK_(E&C)optional accessories',
  ],
};

// Sheets that are always shown regardless of system type (general consumables, cabling, etc.)
const ALWAYS_INCLUDED_SHEETS = [
  'CONSUMABLES', 'CONSUMABLES Updated', 'Copy of CONSUMABLES - Wag dito',
  'Copy of CONSUMABLES - Wag dito ', 'WIRES', 'ROBART',
];

interface Props {
  project: Project;
  user: User | null;
  onBack: () => void;
  onUpdateStatus?: (projectId: string, status: string) => void;
  isDark?: boolean;
}

function getRoleDefaultDayRate(_role: string): number {
  return 1000;
}

function createManpower(): EstimationManpowerEntry {
  const dayRate = 1000;
  return { id: crypto.randomUUID(), role: 'Systems Installer', headcount: 1, hours: 8, manDays: 1, dayRate, totalCost: dayRate * 1 };
}

function createConsumable(): EstimationConsumableEntry {
  return { id: crypto.randomUUID(), name: '', brand: '', category: 'Hardware', quantity: 1, unit: 'pcs', unitPrice: undefined as unknown as number, totalPrice: 0 };
}

function consumableFromCatalog(product: CatalogProduct): EstimationConsumableEntry {
  const price = Number(product.prod_price) || 0;
  const name = product.prod_Name || product.item_description || product.model || product.prod_Code || '';
  return {
    id: crypto.randomUUID(),
    name,
    brand: product.brand || detectBrandFromName(name),
    category: mapCategoryToOption(product.category || name),
    quantity: 1,
    unit: 'pcs',
    unitPrice: price,
    // The database carries one price; it stands as SRP and the tier switch keeps it.
    srp: price,
    totalPrice: price,
    productId: product.model || product.prod_Code || undefined,
  };
}

function createFee(): EstimationAdditionalFeeEntry {
  return { id: crypto.randomUUID(), type: 'Other', amount: undefined as unknown as number, description: '' };
}

function createScopeOfWork(count: number): ScopeOfWorkEntry {
  return {
    id: crypto.randomUUID(),
    itemNumber: count + 1,
    description: '',
    unit: '1 LOT',
    totalPrice: 0,
  };
}

interface EstimationSnapshotInput {
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks: ScopeOfWorkEntry[];
  constraints?: { physical?: string; electrical?: string; installation?: string };
  priceTier?: string;
  aiQuotation?: unknown;
  aiBaseline?: unknown;
  technicianNotes?: string;
  discrepancyJustifications?: string[] | null;
}

type EstimationSection = 'manpower' | 'consumables' | 'fees' | 'scopeOfWorks' | 'fieldNotes' | 'constraints';

const ESTIMATION_SECTION_FIELDS: Record<EstimationSection, string[]> = {
  manpower: ['manpower'],
  consumables: ['consumables', 'priceTier'],
  fees: ['fees'],
  scopeOfWorks: ['scopeOfWorks'],
  fieldNotes: ['technicianNotes', 'discrepancyJustifications'],
  constraints: ['constraints'],
};

function serializeEstimationSnapshot(input: EstimationSnapshotInput): string {
  return JSON.stringify({
    manpower: input.manpower,
    consumables: input.consumables,
    fees: input.fees,
    scopeOfWorks: input.scopeOfWorks,
    constraints: {
      physical: input.constraints?.physical ?? '',
      electrical: input.constraints?.electrical ?? '',
      installation: input.constraints?.installation ?? '',
    },
    priceTier: input.priceTier ?? 'srp',
    aiQuotation: input.aiQuotation ?? null,
    aiBaseline: input.aiBaseline ?? null,
    technicianNotes: input.technicianNotes ?? '',
    discrepancyJustifications: input.discrepancyJustifications ?? [],
  });
}

function getChangedEstimationSections(currentSnapshot: string, savedSnapshot: string | null): Set<EstimationSection> {
  if (!savedSnapshot) return new Set();

  try {
    const current = JSON.parse(currentSnapshot) as Record<string, unknown>;
    const saved = JSON.parse(savedSnapshot) as Record<string, unknown>;
    const changed = new Set<EstimationSection>();

    (Object.entries(ESTIMATION_SECTION_FIELDS) as [EstimationSection, string[]][]).forEach(([section, fields]) => {
      if (fields.some(field => JSON.stringify(current[field]) !== JSON.stringify(saved[field]))) {
        changed.add(section);
      }
    });

    return changed;
  } catch {
    return new Set();
  }
}

function parseEstimationSnapshot(snapshot: string | null): Record<string, any> | null {
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot);
  } catch {
    return null;
  }
}

function getChangedRowFields(
  currentRow: Record<string, any>,
  savedRows: unknown,
  fields: string[],
): Set<string> {
  if (!Array.isArray(savedRows)) return new Set();

  const savedRow = savedRows.find(row => row?.id === currentRow.id);

  if (!savedRow) return new Set(fields);

  return new Set(fields.filter(field => (
    JSON.stringify(currentRow[field]) !== JSON.stringify(savedRow[field])
  )));
}

const getInputStyle = (dark: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: '8px',
  background: dark ? '#0D1527' : '#FFFFFF',
  border: dark ? '1px solid #1E293B' : '1px solid #E2E8F0',
  color: dark ? '#F1F5F9' : '#1E293B',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
});

const getTableHeadStyle = (dark: boolean): React.CSSProperties => ({
  paddingBottom: '10px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: dark ? '#94A3B8' : '#94A3B8',
  borderBottom: dark ? '1px solid #1E293B' : '1px solid #E2E8F0',
  textAlign: 'left',
});

import { canViewPrices } from '../../constants/roles';
import { submitEstimationToDB } from '../../services/estimationSubmission';

export default function EstimationSummary({ project, user, onBack, onUpdateStatus, isDark }: Props) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const [isInitialStateLoaded, setIsInitialStateLoaded] = useState(false);
  const showPrices = canViewPrices(user?.role, user);

  // Sync dark theme reactive state
  const [themeDark, setThemeDark] = useState<boolean>(() => {
    if (typeof isDark === 'boolean') return isDark;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        localStorage.getItem('aa2000_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (typeof isDark === 'boolean') {
      setThemeDark(isDark);
    }
  }, [isDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateTheme = () => {
      const isDocDark = document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        localStorage.getItem('aa2000_theme') === 'dark';
      setThemeDark(isDocDark);
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    window.addEventListener('storage', updateTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', updateTheme);
    };
  }, []);

  const dark = themeDark;
  const inputStyle = getInputStyle(dark);
  const tableHeadStyle = getTableHeadStyle(dark);

  const [priceTier, setPriceTier] = useState<'srp' | 'contractorPrice' | 'dealerPrice'>('srp');
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showProductCatalog, setShowProductCatalog] = useState(false);
  const [manpower, setManpower] = useState<EstimationManpowerEntry[]>([]);
  const [consumables, setConsumables] = useState<EstimationConsumableEntry[]>([]);
  const [fees, setFees] = useState<EstimationAdditionalFeeEntry[]>([]);
  const [scopeOfWorks, setScopeOfWorks] = useState<ScopeOfWorkEntry[]>([]);
  const [constraints, setConstraints] = useState({ physical: '', electrical: '', installation: '' });

  // ── AI Baseline & Technician Ground Validation Tracking ───────────────────
  const [aiBaseline, setAiBaseline] = useState<any>(null);
  const [technicianNotes, setTechnicianNotes] = useState<string>('');
  const [discrepancyJustifications, setDiscrepancyJustifications] = useState<string[]>([]);

  // ── AI-generated full quotation structure ─────────────────────────────────
  const [aiQuotation, setAiQuotation] = useState<FloorPlanEstimation | null>(null);
  const [quotHeader, setQuotHeader] = useState<QuotationHeaderState>({
    referenceCode: '',
    attentionTo: '',
    thru: 'Building Manager',
    emailAdd: '',
    contactNo: '',
    company: '',
    address: '',
    projectSite: '',
    projectTitle: '',
    quoteDate: '',
    validityPeriod: '30 days from date of this quotation',
  });
  const [showEditQuotation, setShowEditQuotation] = useState(false);

  const currentEstimationSnapshot = serializeEstimationSnapshot({
    manpower,
    consumables,
    fees,
    scopeOfWorks,
    constraints,
    priceTier,
    aiQuotation,
    aiBaseline,
    technicianNotes,
    discrepancyJustifications,
  });
  const hasUnsavedChanges = isInitialStateLoaded && (
    savedSnapshotRef.current === null || currentEstimationSnapshot !== savedSnapshotRef.current
  );
  const changedSections = getChangedEstimationSections(currentEstimationSnapshot, savedSnapshotRef.current);
  const savedSnapshotData = parseEstimationSnapshot(savedSnapshotRef.current);
  const currentSnapshotData = parseEstimationSnapshot(currentEstimationSnapshot) || {};
  const isSavedFieldChanged = (field: string) => savedSnapshotData !== null && (
    JSON.stringify(currentSnapshotData[field]) !== JSON.stringify(savedSnapshotData[field])
  );
  const isSavedNestedFieldChanged = (section: string, field: string) => savedSnapshotData !== null && (
    JSON.stringify(currentSnapshotData[section]?.[field]) !== JSON.stringify(savedSnapshotData[section]?.[field])
  );
  const getInputChangedStyle = (changed: boolean): React.CSSProperties => changed ? {
    backgroundColor: dark ? '#2B2412' : '#FFFBEB',
    border: dark ? '1px solid #92400E' : '1px solid #FCD34D',
    boxShadow: dark ? '0 0 0 1px rgba(245, 158, 11, 0.18)' : '0 0 0 1px rgba(245, 158, 11, 0.16)',
  } : {};
  const editedBadge = (section: EstimationSection) => changedSections.has(section) ? (
    <span
      title="This section has unsaved changes"
      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
        dark ? 'bg-amber-950/60 text-amber-300' : 'bg-amber-100 text-amber-700'
      }`}
    >
      Edited
    </span>
  ) : null;

  // Recalculate consumable prices when priceTier changes
  useEffect(() => {
    setConsumables(prev => prev.map(c => {
      const unitPrice = c[priceTier] !== undefined ? (c as any)[priceTier] : (c.unitPrice || 0);
      return {
        ...c,
        unitPrice,
        totalPrice: unitPrice * c.quantity
      };
    }));
  }, [priceTier]);

  // Wizard-applied AI results (Create Estimation flow): notice until the user accepts them.
  const wizardAiAcceptedKey = `aa2000_wizard_ai_accepted_${project.id}`;
  const [wizardAiAccepted, setWizardAiAccepted] = useState(() => {
    try {
      return localStorage.getItem(wizardAiAcceptedKey) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      setWizardAiAccepted(localStorage.getItem(wizardAiAcceptedKey) === '1');
    } catch {
      setWizardAiAccepted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Product catalog search state
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Build the allowed sheet set based on the project's selected system types
  const getAllowedSheets = (): Set<string> | null => {
    const types = project.systemTypes;
    if (!types || types.length === 0) return null; // null = show all
    const sheets = new Set<string>(ALWAYS_INCLUDED_SHEETS);
    types.forEach(t => {
      const key = t.toUpperCase().replace('-', '_');
      if (key === 'OTHER') {
        const otherKeys = [
          'DOOR_LOCK', 'EAS_SYSTEM', 'FIXED_ARM_ELEVATOR', 'INTERCOM_NURSE_CALL',
          'PABX_PAGING', 'PARKING_BARRIER', 'POS_SYSTEM', 'ROOM_ALERT', 'XRAY_SECURITY'
        ];
        otherKeys.forEach(ok => {
          (SYSTEM_SHEET_MAP[ok] || []).forEach(s => sheets.add(s));
        });
      } else {
        (SYSTEM_SHEET_MAP[key] || SYSTEM_SHEET_MAP[t] || []).forEach(s => sheets.add(s));
      }
    });
    return sheets;
  };
  const getFilteredProducts = (query: string) => {
    // No local products database search needed.
    return [];
  };

  const getSystemBrand = (systemType: string): string => {
    const brands = new Set<string>();
    consumables.forEach(c => {
      if (c.brand && c.brand.trim() !== '' && c.brand !== 'Generalized / Any Brand') brands.add(c.brand);
    });
    if (brands.size > 0) {
      return Array.from(brands).join(', ');
    }
    return '';
  };

  const [isSearchingPricing, setIsSearchingPricing] = useState<string | null>(null);

  const handleAiPricingLookup = async (id: string, name: string) => {
    setIsSearchingPricing(id);
    try {
      const estimation = await getEstimatedItemPricing(name, priceTier === 'contractorPrice' ? 'contractor' : priceTier === 'dealerPrice' ? 'dealer' : 'srp');

      setConsumables(prev => prev.map(item => {
        if (item.id === id) {
          const srp = estimation.price;
          const contractorPrice = estimation.contractorPrice;
          const dealerPrice = estimation.dealerPrice;
          const unitPrice = priceTier === 'srp' ? srp : priceTier === 'contractorPrice' ? contractorPrice : dealerPrice;
          return {
            ...item,
            name: estimation.model && estimation.model !== name ? `${estimation.brand} ${estimation.model}` : item.name,
            brand: estimation.brand || item.brand || '',
            srp,
            contractorPrice,
            dealerPrice,
            unitPrice,
            totalPrice: unitPrice * item.quantity,
          };
        }
        return item;
      }));

      if (estimation.foundInPricelist) {
        toast.success(`Matched in pricelist: ${estimation.sourceFile}`);
      } else {
        toast.info(`Item not in pricelist. Estimated PH market average.`);
      }
    } catch (err: any) {
      console.error('Pricing lookup error:', err);
      toast.error(`Could not fetch pricing: ${err.message}`);
    } finally {
      setIsSearchingPricing(null);
      setActiveSearchId(null);
    }
  };

  // Stat cards + BOQ totals — same helper the AI result panels use, so both
  // screens always show identical numbers for these rows.
  const estimationStats = computeEstimationStats(manpower, consumables, fees);
  const { totalHeadcount, totalManDays, totalMaterialLines, cableTotal } = estimationStats;

  const updateManpower = (id: string, field: keyof EstimationManpowerEntry, value: number | string) => {
    setManpower(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: value };
      if (field === 'headcount' || field === 'hours') {
        const hc = field === 'headcount' ? Number(value) : m.headcount;
        const hr = field === 'hours' ? Number(value) : m.hours;
        updated.manDays = Math.ceil(hc * hr / 8);
      }
      // Re-calculate totalCost when manDays or dayRate is modified
      const rate = field === 'dayRate' ? Number(value) : (m.dayRate || getRoleDefaultDayRate(updated.role));
      updated.dayRate = rate;
      updated.totalCost = rate * updated.manDays;
      return updated;
    }));
  };

  const updateConsumable = (id: string, field: keyof EstimationConsumableEntry, value: number | string) => {
    setConsumables(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      if (field === 'name') {
        const detected = detectBrandFromName(String(value));
        if (detected) {
          updated.brand = detected;
        }
      }
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : c.quantity;
        const prc = field === 'unitPrice' ? Number(value) : (c.unitPrice ?? 0);
        updated.totalPrice = qty * prc;
      }
      return updated;
    }));
  };

  const updateFee = (id: string, field: keyof EstimationAdditionalFeeEntry, value: string | number) => {
    setFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const runEstimateFromSurveys = (surveysList: any[]) => {
    const getCameraSearchTerm = (type: string, resolution: string) => {
      let resTerm = '';
      if (resolution === '2MP') resTerm = '2.0 MP';
      else if (resolution === '5MP') resTerm = '5MP';
      else if (resolution === '8MP') resTerm = '8MP';
      else if (resolution === '12MP') resTerm = '12MP';
      return `${resTerm} ${type}`;
    };

    // Priority lookup from official pricelistData.json catalog
    const matchDbProduct = (searchName: string, defaultName: string, defaultCategory: string, defaultUnit: string, quantity: number, preferredBrand?: string) => {
      const brand = preferredBrand || detectBrandFromName(searchName) || (project.systemTypes?.[0] === 'FIRE_ALARM' ? 'Asenware' : 'Hikvision');
      
      // 1. Direct search in official AA2000 pricelistData.json
      const matches = searchPricelist(searchName, { brand: preferredBrand, maxResults: 1 });
      if (matches && matches.length > 0) {
        const item = matches[0];
        const srp = item.price || 3500;
        const contractorPrice = item.contractorPrice || Math.round(srp * 0.85);
        const dealerPrice = item.dealerPrice || Math.round(srp * 0.75);
        const unitPrice = srp;

        return {
          id: crypto.randomUUID(),
          name: `${item.brand} ${item.model || defaultName} (${item.description || defaultName})`,
          brand: item.brand,
          category: defaultCategory,
          quantity,
          unit: defaultUnit,
          unitPrice,
          srp,
          contractorPrice,
          dealerPrice,
          totalPrice: unitPrice * quantity,
        };
      }

      // 2. Fallback pricing if unlisted
      let srp = 3500;
      const lower = searchName.toLowerCase();
      if (lower.includes('facp') || lower.includes('fire alarm control') || lower.includes('control panel')) srp = 145000;
      else if (lower.includes('nvr') || lower.includes('dvr')) srp = 25000;
      else if (lower.includes('camera') || lower.includes('dome') || lower.includes('bullet')) srp = 4500;
      else if (lower.includes('smoke') || lower.includes('heat detector')) srp = 1850;
      else if (lower.includes('pull station') || lower.includes('manual call')) srp = 3200;
      else if (lower.includes('horn') || lower.includes('strobe') || lower.includes('sounder')) srp = 2800;
      else if (lower.includes('module')) srp = 4200;
      else if (lower.includes('cable') || lower.includes('utp') || lower.includes('wire')) srp = 65;
      else if (lower.includes('conduit') || lower.includes('tray')) srp = 240;
      else if (lower.includes('switch') || lower.includes('poe')) srp = 12000;
      else if (lower.includes('ups')) srp = 18500;
      else if (lower.includes('cabinet')) srp = 8500;
      else if (lower.includes('reader') || lower.includes('biometric')) srp = 8500;
      else if (lower.includes('lock') || lower.includes('bracket')) srp = 4500;
      else if (lower.includes('button')) srp = 1200;

      const contractorPrice = Math.round(srp * 0.85);
      const dealerPrice = Math.round(srp * 0.75);
      const unitPrice = srp;

      return {
        id: crypto.randomUUID(),
        name: defaultName,
        brand,
        category: defaultCategory,
        quantity,
        unit: defaultUnit,
        unitPrice,
        srp,
        contractorPrice,
        dealerPrice,
        totalPrice: unitPrice * quantity,
      };
    };

    let totalItemsCount = 0;
    const items: EstimationConsumableEntry[] = [];
    const constraintsList: string[] = [];

    // Several surveys of one type (e.g. two CCTV areas) are numbered so the report
    // can show each as its own section.
    const surveysPerType = surveysList.reduce<Record<string, number>>((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {});
    const surveySeen: Record<string, number> = {};

    surveysList.forEach(s => {
      const firstItemIndex = items.length;
      if (s.type === 'CCTV') {
        const cameraCount = Number(s.data.cameraCount) || 8;
        const cableLength = Number(s.data.cableLength) || (cameraCount * 45);
        const prefBrand = s.data.preferredBrand;
        totalItemsCount += cameraCount + 2;

        // 1. Camera Types and Quantities based on CameraForm checkboxes
        const selectedTypes = s.data.cameraTypes && s.data.cameraTypes.length > 0
          ? s.data.cameraTypes
          : ['Dome', 'Bullet']; // Default if none checked
        
        const countPerType = Math.ceil(cameraCount / selectedTypes.length);
        
        selectedTypes.forEach((type: string) => {
          const searchTerm = getCameraSearchTerm(type, s.data.resolution);
          items.push(matchDbProduct(searchTerm, `${s.data.resolution || 'IP'} ${type} Camera`, 'Hardware', 'pcs', countPerType, prefBrand));
        });

        // 2. NVR matching preferred brand and channel count
        let nvrSearch = 'NVR';
        if (cameraCount <= 8) nvrSearch = '8 Channel NVR';
        else if (cameraCount <= 16) nvrSearch = '16 Channel NVR';
        else nvrSearch = '32 Channel NVR';
        
        const nvrItem = matchDbProduct(nvrSearch, `NVR ${cameraCount} Channels`, 'Hardware', 'pcs', 1, prefBrand);
        items.push(nvrItem);

        // 3. PoE Network Switch sized to camera count
        let switchSearch = 'PoE Switch';
        if (cameraCount <= 8) switchSearch = '8-port PoE';
        else if (cameraCount <= 16) switchSearch = '16-port PoE';
        else switchSearch = '24-port PoE';
        
        const switchItem = matchDbProduct(switchSearch, `PoE Switch`, 'Hardware', 'pcs', 1, prefBrand);
        items.push(switchItem);

        // 4. Infrastructure - Cable Type (e.g. Cat6, Fiber, Coax)
        const cableSearch = s.data.cableType || 'UTP Cable';
        const prefCableBrand = s.data.preferredCableBrand;
        items.push(matchDbProduct(cableSearch, `${cableSearch} Cable`, 'Wires & Cables', 'meters', cableLength, prefCableBrand));

        // 5. Infrastructure - Cable Path (Conduit/Cable Tray) accessories
        if (s.data.cablePath === 'Conduit') {
          items.push(matchDbProduct('PVC Conduit', 'PVC Conduit Pipe 20mm', 'Roughing-ins', 'lengths', Math.ceil(cableLength / 3)));
        } else if (s.data.cablePath === 'Cable Tray') {
          items.push(matchDbProduct('Cable Tray', 'Metal Cable Tray', 'Roughing-ins', 'lengths', Math.ceil(cableLength / 3)));
        }

        // 6. Accessories - Data Cabinet sized to layout
        let cabinetSearch = '6U';
        if (cameraCount <= 8) cabinetSearch = '4U';
        else if (cameraCount <= 16) cabinetSearch = '9U';
        else cabinetSearch = '12U';
        items.push(matchDbProduct(cabinetSearch, `${cabinetSearch} Data Cabinet`, 'Hardware', 'pcs', 1));

        // 7. Accessories - UPS backup power
        let upsSearch = '1KVA';
        if (cameraCount > 16) upsSearch = '2KVA';
        items.push(matchDbProduct(upsSearch, `Online UPS ${upsSearch}`, 'Hardware', 'pcs', 1));

        // 8. Accessories - Micro SD Cards for Edge Storage
        items.push(matchDbProduct('SD CARD', '64GB MicroSD Card', 'Hardware', 'pcs', cameraCount));

        // 9. Accessories - RJ45 connectors
        items.push(matchDbProduct('RJ45', 'RJ45 Connectors Box', 'Consumables', 'box', 1));

        if (s.data.buildingType) {
          constraintsList.push(`Building: ${s.data.buildingType} (${s.data.floors || 1} floors).`);
        }
        if (s.data.coreDrilling) {
          constraintsList.push('Core drilling required for cable paths.');
          items.push(matchDbProduct('Drill Bit', 'Masonry Core Drill Bit', 'Consumables', 'pcs', 1));
        }
        if (s.data.cablePath) {
          constraintsList.push(`Routing path: ${s.data.cablePath} on ${s.data.wallType || 'concrete'} walls.`);
        }
      } else if (s.type === 'FIRE_ALARM') {
        const smoke = Number(s.data.smokeDetectors) || 457;
        const heat = Number(s.data.heatDetectors) || 18;
        const mcp = Number(s.data.mcpCount) || 36;
        const sounders = Number(s.data.sounders) || 36;
        const prefBrand = s.data.preferredBrand || 'Asenware';
        totalItemsCount += smoke + heat + mcp + sounders + 1;

        if (smoke > 0) items.push(matchDbProduct('Optical Smoke Detector with Base', 'Optical Smoke Detector with Base', 'Hardware', 'pcs', smoke, prefBrand));
        if (heat > 0) items.push(matchDbProduct('Heat Detector Rate of Rise', 'Heat Detector Rate of Rise', 'Hardware', 'pcs', heat, prefBrand));
        if (sounders > 0) items.push(matchDbProduct('Horn Strobe 24VDC Red', 'Horn Strobe 24VDC Red', 'Hardware', 'pcs', sounders, prefBrand));
        if (mcp > 0) items.push(matchDbProduct('Manual Pull Station Addressable Dual Action', 'Manual Pull Station Addressable Dual Action', 'Hardware', 'pcs', mcp, prefBrand));
        items.push(matchDbProduct('Input / Monitor Module for Waterflow/Tamper Switch', 'Input / Monitor Module for Waterflow/Tamper Switch', 'Hardware', 'sets', 19, prefBrand));
        items.push(matchDbProduct('Addressable Fire Alarm Control Panel 4-Loop', 'Addressable Fire Alarm Control Panel 4-Loop', 'Hardware', 'unit', 1, prefBrand));
        items.push(matchDbProduct('Fire-Resistant Shielded Twisted Pair Cable 2x1.5mm2', 'Fire-Resistant Shielded Twisted Pair Cable 2x1.5mm2', 'Wires & Cables', 'meters', 1200));
        items.push(matchDbProduct('1/2" EMT Conduit Pipe with Connectors & Couplings', '1/2" EMT Conduit Pipe with Connectors & Couplings', 'Roughing-ins', 'lengths', 350));
      } else if (s.type === 'ACCESS_CONTROL') {
        const doors = Number(s.data.doorCount) || 4;
        totalItemsCount += doors * 2 + 1;

        if (doors > 0) {
          items.push(matchDbProduct(s.data.readerType || 'Reader', 'Biometric / RFID Card Reader', 'Hardware', 'pcs', doors, 'ZKTeco'));
          items.push(matchDbProduct(s.data.lockType || 'Lock', 'Electromagnetic Lock 600lbs with ZL Bracket', 'Hardware', 'pcs', doors, 'ZKTeco'));
          items.push(matchDbProduct('Exit Button', 'No-Touch Infrared Exit Button', 'Hardware', 'pcs', doors, 'ZKTeco'));
          items.push(matchDbProduct('Power Supply', 'Access Control Power Supply 12V 5A with Battery Backup', 'Hardware', 'pcs', Math.ceil(doors / 2), 'ZKTeco'));
        }
        items.push(matchDbProduct('Control Panel', 'Multi-Door Access Controller Panel', 'Hardware', 'pcs', Math.ceil(doors / 4), 'ZKTeco'));
        items.push(matchDbProduct('Cable', 'Belden 2-Pair Shielded Control Cable', 'Wires & Cables', 'meters', doors * 35));
      } else if (s.type === 'BURGLAR_ALARM') {
        const pir = Number(s.data.pirSensors) || 8;
        const contact = Number(s.data.doorContacts) || 4;
        const glass = Number(s.data.glassBreak) || 2;
        const outdoor = Number(s.data.outdoorSensors) || 2;
        totalItemsCount += pir + contact + glass + outdoor + 1;

        if (pir > 0) items.push(matchDbProduct('PIR', 'Honeywell Wireless PIR Motion Detector', 'Hardware', 'pcs', pir, 'HONEYWELL'));
        if (contact > 0) items.push(matchDbProduct('Contact', 'Honeywell Wireless Door/Window Contact Sensor', 'Hardware', 'pcs', contact, 'HONEYWELL'));
        if (glass > 0) items.push(matchDbProduct('Glass', 'Honeywell Wireless Glass Break Detector', 'Hardware', 'pcs', glass, 'HONEYWELL'));
        if (outdoor > 0) items.push(matchDbProduct('Sensor', 'Honeywell Wireless Outdoor Motion Sensor', 'Hardware', 'pcs', outdoor, 'HONEYWELL'));
        items.push(matchDbProduct('Control Panel', 'Honeywell Intrusion Alarm Control Panel', 'Hardware', 'pcs', 1, 'HONEYWELL'));
        items.push(matchDbProduct('Sounder', 'Honeywell Wireless Outdoor Siren/Strobe', 'Hardware', 'pcs', 2, 'HONEYWELL'));
      } else if (s.type === 'FIRE_PROTECTION') {
        const zones = Number(s.data.zones) || 1;
        const cylinders = Number(s.data.cylinders) || 1;
        totalItemsCount += cylinders + zones;

        items.push(matchDbProduct(s.data.suppressionType || 'Extinguisher', 'Clean Agent FM-200 Fire Suppression Cylinder', 'Hardware', 'pcs', cylinders));
        items.push(matchDbProduct('Valve', 'Electrically Actuated Release Valve', 'Hardware', 'pcs', zones));
      } else if (s.type === 'OTHER') {
        const qty = Number(s.data.quantity) || 1;
        totalItemsCount += qty;

        items.push(matchDbProduct(s.data.otherSystemType || 'Other', s.data.description || 'Custom Security Hardware', 'Hardware', 'pcs', qty));
      }

      surveySeen[s.type] = (surveySeen[s.type] || 0) + 1;
      const typeLabel = s.type === 'FIRE_ALARM' ? 'FDAS' : String(s.type || 'OTHER').replace(/_/g, ' ');
      const systemLabel = surveysPerType[s.type] > 1 ? `${typeLabel} ${surveySeen[s.type]}` : typeLabel;
      for (let i = firstItemIndex; i < items.length; i += 1) {
        items[i] = { ...items[i], systemType: s.type, surveyId: s.id, systemLabel };
      }
    });

    const hoursRequired = Math.max(80, totalItemsCount * 3);
    const leadDays = Math.max(10, Math.ceil(hoursRequired * 0.1 / 8));
    const installerDays = Math.max(30, Math.ceil(hoursRequired / 8));
    const safetyDays = Math.max(10, Math.ceil(hoursRequired * 0.1 / 8));
    const assistantDays = Math.max(20, Math.ceil(hoursRequired * 0.25 / 8));

    setManpower([
      { id: crypto.randomUUID(), role: 'Lead Security Engineer', headcount: 1, hours: leadDays * 8, manDays: leadDays, dayRate: 1000, totalCost: 1000 * leadDays },
      { id: crypto.randomUUID(), role: 'Safety Officer', headcount: 1, hours: safetyDays * 8, manDays: safetyDays, dayRate: 1000, totalCost: 1000 * safetyDays },
      { id: crypto.randomUUID(), role: 'Systems Installer', headcount: Math.max(2, Math.ceil(installerDays / 10)), hours: installerDays * 8, manDays: installerDays, dayRate: 1000, totalCost: 1000 * installerDays },
      { id: crypto.randomUUID(), role: 'Technical Assistant', headcount: 2, hours: assistantDays * 8, manDays: assistantDays, dayRate: 1000, totalCost: 1000 * assistantDays },
    ]);

    setConsumables(items.filter(item => item.name !== ''));
    setFees([
      { id: crypto.randomUUID(), type: 'Travel Fee', amount: 12500, description: 'Mobilization/Demobilization/Delivery of Equipment & Materials' },
      { id: crypto.randomUUID(), type: 'Other', amount: 10000, description: 'Site Management, Safety Signages and Supervision' },
      { id: crypto.randomUUID(), type: 'Other', amount: 5000, description: 'Administrative, Waste Disposal & Regular Coordination Works' },
    ]);

    const computedBasePrice = items.reduce((s, it) => s + (it.totalPrice || 0), 0) + (1000 * (leadDays + safetyDays + installerDays + assistantDays)) + 27500;
    setScopeOfWorks(generateSystemScopeOfWorks(project.systemTypes || ['CCTV'], items, project.name, computedBasePrice));

    setConstraints({
      physical: 'Ceiling height is ~3m with gypsum board and concrete walls. Limited space in server room for additional equipment. Main entrances and fire exits must remain unobstructed during installation.',
      electrical: 'Client must provide dedicated 220V power circuits for DVR, FACP, and access control panel. UPS backup required for critical systems (DVR, FACP, IDS Panel). Electrical DB room located near server room.',
      installation: 'Installation must be conducted during non-business hours (6PM-6AM) to avoid disruption. Access to all areas must be granted 24/7 for installation and testing. Safety officer required on-site at all times.',
    });
  };

  // Load initial estimate or pre-fill from completed surveys if available
  useEffect(() => {
    savedSnapshotRef.current = null;
    setIsInitialStateLoaded(false);

    const saved = localStorage.getItem(`aa2000_estimation_${project.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        savedSnapshotRef.current = serializeEstimationSnapshot({
          manpower: parsed.manpower || [],
          consumables: parsed.consumables || [],
          fees: parsed.fees || [],
          scopeOfWorks: parsed.scopeOfWorks || [],
          constraints: parsed.constraints,
          priceTier: parsed.priceTier,
          aiQuotation: parsed.aiQuotation,
          aiBaseline: parsed.aiBaseline,
          technicianNotes: parsed.technicianNotes,
          discrepancyJustifications: parsed.discrepancyJustifications,
        });
        if (parsed.manpower) setManpower(parsed.manpower);
        if (parsed.consumables) setConsumables(parsed.consumables);
        if (parsed.fees) setFees(parsed.fees);
        if (parsed.scopeOfWorks) setScopeOfWorks(parsed.scopeOfWorks);
        if (parsed.constraints) setConstraints(parsed.constraints);
        if (parsed.priceTier) setPriceTier(parsed.priceTier);
        if (parsed.aiBaseline) setAiBaseline(parsed.aiBaseline);
        if (parsed.aiQuotation) setAiQuotation(parsed.aiQuotation);
        if (parsed.technicianNotes) setTechnicianNotes(parsed.technicianNotes);
        if (parsed.discrepancyJustifications) setDiscrepancyJustifications(parsed.discrepancyJustifications);
        setIsInitialStateLoaded(true);
        return;
      } catch (e) {
        console.error('Failed to parse saved estimation', e);
      }
    }

    // Check if a dedicated AI baseline was saved earlier
    const baselineRaw = localStorage.getItem(`aa2000_ai_baseline_${project.id}`);
    if (baselineRaw) {
      try {
        const parsedBaseline = JSON.parse(baselineRaw);
        setAiBaseline(parsedBaseline);
      } catch (e) {}
    }

    if (manpower.length === 0 && consumables.length === 0) {
      const projectSurveys = JSON.parse(localStorage.getItem('aa2000_surveys') || '[]')
        .filter((s: any) => s.projectId === project.id);
      
      if (projectSurveys.length > 0) {
        runEstimateFromSurveys(projectSurveys);
      }
    }
    setIsInitialStateLoaded(true);
  }, [project.id]);

  // Populate editable quotation header fields whenever the modal is opened
  useEffect(() => {
    if (!showQuotationModal) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    const sysPfx = (project.systemTypes?.[0] || 'BOQ').replace(/_/g, '').slice(0, 4).toUpperCase();
    const refCode = aiQuotation?.quotationReferenceCode
      || `PQ-${sysPfx}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const qh = aiQuotation?.quotationHeader;
    setQuotHeader({
      referenceCode: refCode,
      attentionTo: qh?.attentionTo || (project as any).clientContactName || 'Client Representative',
      thru: qh?.thru || 'Building Manager',
      emailAdd: qh?.emailAdd || (project as any).clientEmail || '',
      contactNo: qh?.contactNo || (project as any).clientPhone || '',
      company: qh?.company || project.clientName,
      address: qh?.address || project.location,
      projectSite: qh?.projectSite || project.location,
      projectTitle: qh?.projectTitle || project.name.toUpperCase(),
      quoteDate: qh?.quoteDate || dateStr,
      validityPeriod: qh?.validityPeriod || '30 days from date of this quotation',
    });
    setShowEditQuotation(false);
  }, [showQuotationModal]);

  // Single source for the quotation preview and the PDF so the two never differ.
  const buildReportHtml = (isDraft: boolean) => buildStandardEstimationReportHtml({
    project,
    user,
    manpower,
    consumables,
    fees,
    scopeOfWorks,
    constraints,
    technicianNotes,
    totals: computeEstimationTotals(manpower, consumables, fees),
    showPrices,
    isDraft,
    // Header edits exist only once the quotation preview has been opened.
    header: quotHeader.referenceCode ? quotHeader : undefined,
    headerBackgroundUrl: reportHeaderBackground,
    logoUrl: reportLogo,
  });

  // asBlob=false downloads the PDF; asBlob=true returns the same document for backend upload.
  const generateReportPdf = async (asBlob = false): Promise<Blob | null> => {
    let outer: HTMLDivElement | null = null;

    try {
      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.querySelector<HTMLScriptElement>('script[data-aa2000-html2pdf]');
          // A prior failed CDN request leaves its script element behind. Remove it
          // so a later export can retry instead of waiting for an event that passed.
          existingScript?.remove();

          const script = document.createElement('script');
          script.dataset.aa2000Html2pdf = 'true';
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load PDF library'));
          document.head.appendChild(script);
        });
      }

      outer = document.createElement('div');
      Object.assign(outer.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '794px',
        height: '1px',
        overflow: 'hidden',
        zIndex: '99999',
        pointerEvents: 'none',
      });

      const container = document.createElement('div');
      // A download taken before saving is marked so it is not mistaken for the saved record.
      container.innerHTML = buildReportHtml(!asBlob && hasUnsavedChanges);

      outer.appendChild(container);
      document.body.appendChild(outer);

      const imageUrls = [reportHeaderBackground, reportLogo];
      await Promise.all(imageUrls.map(src => new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to load report asset: ${src}`));
        image.src = src;
      })));
      await document.fonts?.ready;
      await new Promise(resolve => setTimeout(resolve, 100));

      const safeProjectName = project.name
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'Project';
      const filename = `AA2000_Estimation_Report_${safeProjectName}.pdf`;
      const options = {
        // Standard A4 pages with a small printable margin on every page.
        // The larger bottom margin is reserved for the repeated page footer.
        margin: [10, 0, 40, 0],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF',
        },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['tr', '.keep', '.avoid'],
        },
      };

      const pdfWorker = (window as any)
        .html2pdf()
        .set(options)
        .from(container)
        .toPdf();

      await pdfWorker.get('pdf').then((pdf: any) => {
        const pageCount = pdf.internal.getNumberOfPages();
        const address = 'Unit 2-C Norkis Building, 11 Calbayog Cor., Domingo M. Guevara St., Mandaluyong City, Philippines 1550';
        const phone = 'T: (02) 8571-5693';
        const disclaimer = 'Disclaimer: This report is generated for client presentation and reflects finalized project details.';

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          pdf.setPage(pageNumber);
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const footerTop = pageHeight - 32;

          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.5);
          pdf.line(36, footerTop, pageWidth - 36, footerTop);

          pdf.setTextColor(100, 116, 139);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(5.3);
          pdf.text(address, 36, footerTop + 9);
          pdf.text(phone, 36, footerTop + 16);

          pdf.setTextColor(71, 85, 105);
          pdf.setFont('helvetica', 'bold');
          const disclaimerLines = pdf.splitTextToSize(disclaimer, 205);
          pdf.text(disclaimerLines, pageWidth - 36, footerTop + 9, { align: 'right' });
        }
      });

      const pdfBlob = await pdfWorker.outputPdf('blob') as Blob;

      if (!(pdfBlob instanceof Blob) || pdfBlob.size < 1000) {
        throw new Error('The generated PDF is empty or invalid.');
      }

      if (!asBlob) {
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }

      return pdfBlob;
    } catch (error) {
      console.error('PDF Export Error:', error);
      if (!asBlob) {
        toast.error(error instanceof Error
          ? `Could not generate the PDF: ${error.message}`
          : 'Could not generate the PDF. Please try again.');
      }
      return null;
    } finally {
      outer?.remove();
    }
  };

  const canExportPdf = isInitialStateLoaded && (consumables.length > 0 || manpower.length > 0);

  const handleExportPdf = async () => {
    if (isExportingPdf || isSubmitting) return;
    if (!canExportPdf) {
      toast.error('Add estimation items before exporting the PDF report.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const pdf = await generateReportPdf(false);
      if (pdf) toast.success('PDF report downloaded.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const sectionCard: React.CSSProperties = {
    background: dark ? '#131B2E' : '#FFFFFF',
    border: dark ? '1px solid #1E293B' : '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.02)',
  };

  const addBtn = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
        dark
          ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200'
          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
      }`}
    >
      + {label}
    </button>
  );

  const removeBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded cursor-pointer"
    >
      Remove
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto pb-16 transition-colors" style={{ background: dark ? '#0B132B' : '#F8FAFC' }}>
      {/* Header */}
      <header className={`sticky top-0 z-40 px-6 py-4 border-b shadow-sm backdrop-blur-md transition-colors ${
        dark
          ? 'bg-[#0D1527]/95 border-slate-800'
          : 'bg-gradient-to-r from-white/95 to-blue-50/95 border-slate-200'
      }`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className={`flex items-center gap-2 text-xs font-bold transition-colors px-3 py-2 rounded-lg cursor-pointer ${
              dark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Project
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || isSubmitting || !canExportPdf}
              aria-busy={isExportingPdf}
              title={!canExportPdf ? 'No estimation data to export yet.' : hasUnsavedChanges ? 'Exports the current, unsaved estimation as a draft report.' : undefined}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                dark
                  ? 'bg-[#131B2E] text-slate-300 border-slate-700 hover:text-blue-400 hover:border-blue-500/50'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-[#1E3A8A]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {isExportingPdf ? 'Generating PDF...' : 'Export PDF Report'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Project title card */}
        <div style={{ ...sectionCard, marginBottom: '24px' }}>
          <h1 className={`text-xl font-black ${dark ? 'text-white' : 'text-slate-800'}`}>{project.name}</h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{project.clientName} · {project.location}</p>

          {/* System type badges — MOST IMPORTANT CONTEXT */}
          {project.systemTypes && project.systemTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {project.systemTypes.map(type => {
                const COLORS: Record<string, { bg: string; color: string; label: string; icon: string }> = {
                  CCTV:                { bg: '#EFF6FF', color: '#1E3A8A', label: 'CCTV System',                        icon: '' },
                  FDAS:                { bg: '#FEF2F2', color: '#DC2626', label: 'FDAS / Fire Alarm System',           icon: '' },
                  ACCESS_CONTROL:      { bg: '#ECFDF5', color: '#065F46', label: 'Access Control System',              icon: '' },
                  BURGLAR_ALARM:       { bg: '#FFFBEB', color: '#92400E', label: 'Burglar Alarm System',               icon: '' },
                  DOOR_LOCK:           { bg: '#FFFBEB', color: '#B45309', label: 'Door Lock System',                   icon: '' },
                  EAS_SYSTEM:          { bg: '#FEF3C7', color: '#D97706', label: 'EAS System',                         icon: '' },
                  FIRE_PROTECTION:     { bg: '#FAF5FF', color: '#7E22CE', label: 'Fire Protection / Suppression',      icon: '' },
                  FIXED_ARM_ELEVATOR:  { bg: '#F0F9FF', color: '#0369A1', label: 'Fixed Arm & Elevator Related',       icon: '' },
                  INTERCOM_NURSE_CALL: { bg: '#F0FDFA', color: '#0F766E', label: 'Intercom & Nurse Call System',       icon: '' },
                  PABX_PAGING:         { bg: '#EEF2FF', color: '#4F46E5', label: 'PABX & Paging System',               icon: '' },
                  PARKING_BARRIER:     { bg: '#ECFEFF', color: '#0891B2', label: 'Parking Barrier System',             icon: '' },
                  POS_SYSTEM:          { bg: '#EFF6FF', color: '#2563EB', label: 'POS System',                         icon: '' },
                  ROOM_ALERT:          { bg: '#FFF1F2', color: '#E11D48', label: 'Room Alert System',                  icon: '' },
                  XRAY_SECURITY:       { bg: '#FAF5FF', color: '#6B21A8', label: 'X-Ray & Turnstile System',           icon: '' },
                };
                const cfg = COLORS[type] || { bg: '#F8FAFC', color: '#475569', label: type, icon: '' };
                const brand = getSystemBrand(type);
                const displayLabel = brand ? `${cfg.label} (${brand})` : cfg.label;
                const badgeBg = dark ? `${cfg.color}25` : cfg.bg;
                const badgeColor = dark ? (cfg.color === '#1E3A8A' ? '#60A5FA' : cfg.color === '#065F46' ? '#34D399' : cfg.color === '#92400E' ? '#FBBF24' : cfg.color === '#7E22CE' ? '#C084FC' : '#93C5FD') : cfg.color;
                return (
                  <span
                    key={type}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border"
                    style={{ background: badgeBg, color: badgeColor, borderColor: dark ? `${badgeColor}40` : cfg.color + '30' }}
                  >
                    {React.createElement(systemBadgeIcons[type] || systemBadgeIcons.OTHER, { className: 'w-3.5 h-3.5' })}
                    {displayLabel}
                  </span>
                );
              })}
              <span className="flex items-center text-[10px] font-bold text-slate-400 ml-1">← AI will estimate for these systems</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {[
              ...(project.buildingType ? [{ label: 'Building Type', value: project.buildingType }] : []),
              ...(project.floors ? [{ label: 'Floors', value: `${project.floors}` }] : []),
            ].map(item => (
              <div key={item.label} className={`px-3 py-1.5 rounded-lg border ${
                dark ? 'bg-[#0D1527] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}: </span>
                <span className={`text-xs font-bold ${dark ? 'text-slate-200' : 'text-slate-600'}`}>{item.value}</span>
              </div>
            ))}
            {project.surveyScope && (
              <div className={`px-3 py-1.5 rounded-lg border max-w-sm ${
                dark ? 'bg-[#0D1527] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Scope: </span>
                <span className={`text-xs font-semibold line-clamp-1 ${dark ? 'text-slate-200' : 'text-slate-600'}`}>{project.surveyScope}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Wizard-applied AI results: edit or accept ── */}
        {aiBaseline?.wizard && (manpower.length > 0 || consumables.length > 0) && !wizardAiAccepted && (
          <div
            className="rounded-2xl px-4 py-3 mb-5 flex flex-wrap items-center justify-between gap-3 border shadow-xs"
            style={{
              background: dark ? 'rgba(16,185,129,0.10)' : '#ECFDF5',
              borderColor: dark ? 'rgba(16,185,129,0.35)' : '#A7F3D0',
            }}
          >
            <div className="min-w-0">
              <p className="text-xs font-black" style={{ color: dark ? '#6EE7B7' : '#047857' }}>
                AI results applied from the {aiBaseline.wizard.mode === 'ai' ? 'floor plan' : 'estimation'} analysis
              </p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: dark ? '#A7F3D0' : '#065F46' }}>
                {manpower.length} manpower roles · {consumables.length} material lines · {scopeOfWorks.length}{' '}
                scope items are already in place — edit anything below, or accept them as-is.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setWizardAiAccepted(true);
                  try {
                    localStorage.setItem(wizardAiAcceptedKey, '1');
                  } catch {
                    /* storage unavailable: acceptance stays session-only */
                  }
                  toast.success('AI results accepted. Press "Save Estimation" when you are ready.');
                }}
                className="px-4 py-2 rounded-xl text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Accept as-is
              </button>
              <button
                type="button"
                onClick={() => setWizardAiAccepted(true)}
                className="px-3 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                style={{
                  color: dark ? '#A7F3D0' : '#065F46',
                  border: `1px solid ${dark ? 'rgba(16,185,129,0.35)' : '#A7F3D0'}`,
                }}
              >
                I'll edit
              </button>
            </div>
          </div>
        )}

        {/* ── Estimation Summary Cards ── */}
        {(manpower.length > 0 || consumables.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Headcount', value: `${totalHeadcount} pax`, icon: '', color: dark ? '#60A5FA' : '#1E3A8A', bg: dark ? '#1E3A8A25' : '#EFF6FF' },
              { label: 'Total Man-Days', value: `${totalManDays} days`, icon: '', color: dark ? '#34D399' : '#065F46', bg: dark ? '#065F4625' : '#ECFDF5' },
              { label: 'Material Lines', value: `${totalMaterialLines} items`, icon: '', color: dark ? '#FBBF24' : '#92400E', bg: dark ? '#92400E25' : '#FFFBEB' },
              { label: 'Cable Estimate', value: cableTotal > 0 ? `~${cableTotal.toLocaleString()} m` : '—', icon: '', color: dark ? '#C084FC' : '#6B21A8', bg: dark ? '#6B21A825' : '#FAF5FF' },
            ].map(card => (
              <div key={card.label} className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: card.bg, border: `1px solid ${card.color}25` }}>
                {card.label === 'Total Headcount' ? <Users className="w-5 h-5" /> : card.label === 'Total Man-Days' ? <StatCalendar className="w-5 h-5" /> : card.label === 'Material Lines' ? <PackageIcon className="w-5 h-5" /> : card.label === 'Cable Estimate' ? <Plug className="w-5 h-5" /> : null}
                <span className="text-lg font-black" style={{ color: card.color }}>{card.value}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: card.color + 'CC' }}>{card.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Baseline vs. Field Validated Variance Tracker ── */}
        {aiBaseline && (
          <div className={`rounded-2xl p-5 mb-5 border shadow-xs ${
            dark
              ? 'border-indigo-900/40 bg-[#131B2E]'
              : 'border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white'
          }`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b ${
              dark ? 'border-slate-800' : 'border-indigo-100/70'
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  🤖
                </div>
                <div>
                  <h3 className={`text-xs font-black uppercase tracking-wide ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
                    AI Pre-Estimate vs. Ground-Validated Variance
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    AI recommendation is baseline · Field technician and sales can adjust all counts, materials, and pricing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                  dark ? 'bg-emerald-950/50 text-emerald-300 border-emerald-900/50' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Editable Ground Overrides Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className={`p-3 rounded-xl border shadow-2xs ${dark ? 'bg-[#0D1527] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Headcount (Actual vs AI)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-sm font-black ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{totalHeadcount} pax</span>
                  <span className="text-[10px] text-slate-400 font-medium line-through">
                    {aiBaseline.manpower?.reduce((acc: number, m: any) => acc + (Number(m.headcount) || 0), 0) || 0} pax
                  </span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border shadow-2xs ${dark ? 'bg-[#0D1527] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Man-Days (Actual vs AI)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-sm font-black ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{totalManDays} days</span>
                  <span className="text-[10px] text-slate-400 font-medium line-through">
                    {aiBaseline.manpower?.reduce((acc: number, m: any) => acc + (Number(m.manDays) || 0), 0) || 0} days
                  </span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border shadow-2xs ${dark ? 'bg-[#0D1527] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material Items (Actual vs AI)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-sm font-black ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{totalMaterialLines} lines</span>
                  <span className="text-[10px] text-slate-400 font-medium line-through">
                    {aiBaseline.consumables?.length || 0} lines
                  </span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border shadow-2xs ${dark ? 'bg-[#0D1527] border-slate-800' : 'bg-white border-slate-200/80'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ground Justification</p>
                <div className="mt-1 truncate">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    discrepancyJustifications.length > 0
                      ? dark ? 'bg-blue-950/60 text-blue-300' : 'bg-blue-100 text-blue-800'
                      : dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {discrepancyJustifications.length > 0 ? `${discrepancyJustifications.length} field reason(s) noted` : 'No ground changes'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Manpower Section (Matches Reference Screenshot) ── */}
        <div style={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-[#1E3A8A]'}`}><UserIcon className="w-5 h-5" /></div>
              <h2 className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-slate-100' : 'text-slate-800'}`}>MANPOWER BREAKDOWN</h2>
              {editedBadge('manpower')}
            </div>
            <div className="flex items-center gap-3">
              {totalManDays > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-400'}`}>
                  {totalManDays} total man-days
                </span>
              )}
              {addBtn('Add Row', () => setManpower(prev => [...prev, createManpower()]))}
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                  {(showPrices 
                    ? ['Role', 'Headcount', 'Hours', 'Man-Days', 'Day Rate (₱)', 'Total Cost (₱)', '']
                    : ['Role', 'Headcount', 'Hours', 'Man-Days', '']
                  ).map(h => (
                    <th key={h} style={tableHeadStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manpower.map(m => {
                  const changedFields = getChangedRowFields(m, savedSnapshotData?.manpower, ['role', 'headcount', 'hours', 'manDays', 'dayRate']);
                  return (
                  <tr key={m.id} className={`border-b transition-colors ${dark ? 'border-slate-800/60 hover:bg-slate-800/30' : 'border-slate-50 hover:bg-slate-50/50'}`}>
                    <td className="py-2.5 pr-2">
                      <input value={m.role} onChange={e => updateManpower(m.id, 'role', e.target.value)} placeholder="e.g. Lead Security Engineer"
                        style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('role')), width: '220px', fontWeight: '600' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <input type="number" min={1} value={m.headcount} onChange={e => updateManpower(m.id, 'headcount', Number(e.target.value))}
                        style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('headcount')), width: '60px', textAlign: 'center' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <input type="number" min={1} value={m.hours} onChange={e => updateManpower(m.id, 'hours', Number(e.target.value))}
                        style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('hours')), width: '70px', textAlign: 'center' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <span style={getInputChangedStyle(changedFields.has('manDays'))} className={`text-xs font-black px-2 py-1 rounded-lg ${dark ? 'bg-blue-950/60 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>{m.manDays}</span>
                    </td>
                    {showPrices && (
                      <>
                        <td className="py-2.5 pr-2">
                          <input type="number" min={0} value={m.dayRate || ''} onChange={e => updateManpower(m.id, 'dayRate', Number(e.target.value))}
                            placeholder="1000" style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('dayRate')), width: '90px', textAlign: 'right' }} />
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <span className={`text-xs font-black ${dark ? 'text-slate-100' : 'text-slate-900'}`}>₱{((m.totalCost || (m.dayRate || 0) * m.manDays)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                      </>
                    )}
                    <td className="py-2.5">{removeBtn(() => setManpower(prev => prev.filter(x => x.id !== m.id)))}</td>
                  </tr>
                  );
                })}
                {showPrices && manpower.length > 0 && (
                  <tr className={`border-t-2 ${dark ? 'border-slate-800 bg-[#0D1527]/70' : 'border-slate-100 bg-slate-50/70'}`}>
                    <td colSpan={5} className={`py-2.5 text-right text-xs font-bold pr-3 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>Total Manpower Cost:</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span className={`text-sm font-black ${dark ? 'text-blue-400' : 'text-blue-700'}`}>
                        ₱{manpower.reduce((sum, m) => sum + (m.totalCost || ((m.dayRate || 1000) * m.manDays)), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td />
                  </tr>
                )}
                {manpower.length === 0 && (
                  <tr><td colSpan={showPrices ? 7 : 5} className="py-8 text-center text-xs text-slate-400 font-semibold">
                    No manpower rows yet — add rows manually, or run the AI Analysis in the estimation wizard.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bill of Materials Section (Matches Reference Screenshot) ── */}
        <div style={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><PackageIcon className="w-5 h-5" /></div>
              <h2 className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-slate-100' : 'text-slate-800'}`}>BILL OF MATERIALS</h2>
              {editedBadge('consumables')}
            </div>
            <div className="flex items-center gap-3">
              {consumables.length > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-400'}`}>
                  {consumables.length} Line Items
                </span>
              )}
              {showPrices && (
                <div
                  style={getInputChangedStyle(isSavedFieldChanged('priceTier'))}
                  className={`flex items-center gap-1 border rounded-xl p-1 ${dark ? 'bg-[#0D1527] border-slate-800' : 'bg-slate-50 border-slate-200'}`}
                >
                  {(['srp', 'contractorPrice', 'dealerPrice'] as const).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setPriceTier(tier)}
                      className="px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                      style={{
                        background: priceTier === tier ? (dark ? '#2563EB' : '#1E3A8A') : 'transparent',
                        color: priceTier === tier ? '#FFFFFF' : '#94A3B8',
                      }}
                    >
                      {tier === 'srp' ? 'SRP' : tier === 'contractorPrice' ? 'Contractor' : 'Dealer'}
                    </button>
                  ))}
                </div>
              )}
              {addBtn('Add Item', () => setShowProductCatalog(true))}
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                  {(showPrices
                    ? ['Item / Specification', 'Category', 'Qty', 'Unit', 'Unit Price (₱)', 'Total Price (₱)', '']
                    : ['Item / Specification', 'Category', 'Qty', 'Unit', '']
                  ).map(h => (
                    <th key={h} style={tableHeadStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consumables.map(c => {
                  const changedFields = getChangedRowFields(c, savedSnapshotData?.consumables, ['name', 'quantity', 'unit', 'unitPrice']);
                  return (
                  <tr key={c.id} className={`border-b transition-colors ${dark ? 'border-slate-800/60 hover:bg-slate-800/30' : 'border-slate-50 hover:bg-slate-50/50'}`}>
                    <td className="py-2.5 pr-2">
                      <input
                        value={c.name}
                        onChange={e => updateConsumable(c.id, 'name', e.target.value)}
                        placeholder="e.g. Hikvision DS-2CD2143G2-I"
                        style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('name')), width: '280px', fontWeight: '600' }}
                      />
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {c.category || 'Hardware'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <input type="number" min={1} value={c.quantity} onChange={e => updateConsumable(c.id, 'quantity', Number(e.target.value))}
                        style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('quantity')), width: '50px', textAlign: 'center', fontWeight: 'bold' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-slate-500 font-medium">
                      <input value={c.unit} onChange={e => updateConsumable(c.id, 'unit', e.target.value)}
                        placeholder="pcs" style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('unit')), width: '50px' }} />
                    </td>
                    {showPrices && (
                      <>
                        <td className="py-2.5 pr-2 text-right">
                          <input type="number" min={0} value={c.unitPrice || ''} onChange={e => updateConsumable(c.id, 'unitPrice', Number(e.target.value))}
                            placeholder="0" style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('unitPrice')), width: '90px', textAlign: 'right' }} />
                        </td>
                        <td className={`py-2.5 pr-2 text-right font-black ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
                          ₱{(c.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                    <td className="py-2.5">{removeBtn(() => setConsumables(prev => prev.filter(x => x.id !== c.id)))}</td>
                  </tr>
                  );
                })}
                {showPrices && consumables.length > 0 && (
                  <tr className={`border-t-2 ${dark ? 'border-slate-800 bg-[#0D1527]/70' : 'border-slate-100 bg-slate-50/70'}`}>
                    <td colSpan={5} className={`py-2.5 text-right text-xs font-bold pr-3 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>Total Materials Price:</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span className={`text-sm font-black ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        ₱{consumables.reduce((sum, c) => sum + (c.totalPrice || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Additional Fees Section ── */}
        <div style={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-rose-950/60 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9H9a2.25 2.25 0 0 0-2.25 2.25v3.75m0 0h15" />
                </svg>
              </div>
              <h2 className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-slate-100' : 'text-slate-800'}`}>ADDITIONAL FEES</h2>
              {editedBadge('fees')}
            </div>
            {addBtn('Add Fee', () => setFees(prev => [...prev, createFee()]))}
          </div>
          <div className="space-y-2">
            {fees.map(f => {
              const changedFields = getChangedRowFields(f, savedSnapshotData?.fees, ['type', 'description', 'amount']);
              return (
              <div key={f.id} className={`flex items-center justify-between py-2 border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <select value={f.type} onChange={e => updateFee(f.id, 'type', e.target.value)}
                    style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('type')), width: '160px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <option>Travel Fee</option>
                    <option>Permit Fee</option>
                    <option>Congestion Fee</option>
                    <option>Short Notice Fee</option>
                    <option>Overtime Fee</option>
                    <option>Weekend Fee</option>
                    <option>Holiday Fee</option>
                    <option>Other</option>
                  </select>
                  <input value={f.description} onChange={e => updateFee(f.id, 'description', e.target.value)}
                    placeholder="Describe the fee / requirement..."
                    style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('description')), width: '320px' }} />
                </div>
                <div className="flex items-center gap-3">
                  {showPrices && (
                    <input type="number" min={0} value={f.amount ?? ''} onChange={e => updateFee(f.id, 'amount', Number(e.target.value))}
                      style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('amount')), width: '110px', textAlign: 'right', fontWeight: 'bold' }} />
                  )}
                  {removeBtn(() => setFees(prev => prev.filter(x => x.id !== f.id)))}
                </div>
              </div>
              );
            })}
            {fees.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400 font-semibold">No additional fees configured.</p>
            )}
          </div>
        </div>

        {/* ── Overall BOQ Estimation Summary ── */}
        {showPrices && (() => {
          const { totalLabor, totalMaterials, totalFees } = estimationStats;
          const grandTotal = totalLabor + totalMaterials + totalFees;

          return (
            <div className={`rounded-2xl border-2 p-5 shadow-sm space-y-3 mb-5 ${
              dark
                ? 'border-blue-900/50 bg-[#0D1527]'
                : 'border-blue-200 bg-gradient-to-br from-blue-50/60 via-white to-slate-50'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${dark ? 'border-slate-800' : 'border-blue-100'}`}>
                <span className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-blue-300' : 'text-blue-950'}`}>OVERALL BOQ ESTIMATION SUMMARY</span>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-600 text-white uppercase tracking-wider">Grand Total</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className={`p-3.5 rounded-xl border shadow-2xs ${dark ? 'bg-[#131B2E] border-slate-800' : 'bg-white border-slate-100'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MANPOWER TOTAL</span>
                  <p className={`text-base font-black mt-0.5 ${dark ? 'text-blue-400' : 'text-blue-700'}`}>₱{totalLabor.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`p-3.5 rounded-xl border shadow-2xs ${dark ? 'bg-[#131B2E] border-slate-800' : 'bg-white border-slate-100'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MATERIALS TOTAL</span>
                  <p className={`text-base font-black mt-0.5 ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>₱{totalMaterials.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`p-3.5 rounded-xl border shadow-2xs ${dark ? 'bg-[#131B2E] border-slate-800' : 'bg-white border-slate-100'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADDITIONAL FEES</span>
                  <p className={`text-base font-black mt-0.5 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>₱{totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className={`flex items-center justify-between pt-3 border-t ${dark ? 'border-slate-800' : 'border-blue-100'}`}>
                <span className={`text-sm font-extrabold ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Grand Total BOQ Estimation:</span>
                <span className={`text-2xl font-black ${dark ? 'text-blue-400' : 'text-blue-700'}`}>₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          );
        })()}

        {/* ── Scope of Works Section (Section B) ── */}
        <div style={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                <Document className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-slate-100' : 'text-slate-800'}`}>Scope of Works &amp; Deliverables (Section B)</h2>
                  {editedBadge('scopeOfWorks')}
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">Specific procedural steps, cleaning, testing, and testing certificates</p>
              </div>
            </div>
            {addBtn('Add Scope Item', () => setScopeOfWorks(prev => [...prev, createScopeOfWork(prev.length)]))}
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th style={{ ...tableHeadStyle, width: '45px', textAlign: 'center' }}>Item</th>
                  <th style={tableHeadStyle}>Scope Description / Procedural Steps</th>
                  <th style={{ ...tableHeadStyle, width: '120px', textAlign: 'center' }}>Unit</th>
                  {showPrices && <th style={{ ...tableHeadStyle, width: '140px', textAlign: 'right' }}>Total Price (₱)</th>}
                  <th style={{ ...tableHeadStyle, width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {scopeOfWorks.map((s, idx) => {
                  const changedFields = getChangedRowFields(s, savedSnapshotData?.scopeOfWorks, ['description', 'unit', 'totalPrice']);
                  return (
                  <tr key={s.id} className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <td className={`py-2.5 pr-2 text-center font-bold text-xs ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-2">
                      <textarea
                        value={s.description}
                        onChange={e => {
                          const val = e.target.value;
                          setScopeOfWorks(prev => prev.map(x => x.id === s.id ? { ...x, description: val } : x));
                        }}
                        placeholder="SYSTEM / EQUIPMENT NAME&#10;General Cleaning&#10;1. Step one...&#10;2. Step two..."
                        rows={Math.max(2, s.description.split('\n').length)}
                        className={`w-full resize-y rounded-xl text-xs outline-none focus:border-blue-500 font-sans leading-relaxed ${dark ? 'text-slate-100 bg-[#0D1527]' : 'text-slate-700 bg-white'}`}
                         style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('description')), padding: '8px 10px' }}
                      />
                    </td>
                    <td className="py-2.5 pr-2">
                      <input
                        value={s.unit}
                        onChange={e => {
                          const val = e.target.value;
                          setScopeOfWorks(prev => prev.map(x => x.id === s.id ? { ...x, unit: val } : x));
                        }}
                        placeholder="1 LOT"
                         style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('unit')), textAlign: 'center' }}
                      />
                    </td>
                    {showPrices && (
                      <td className="py-2.5 pr-2">
                        <input
                          type="number"
                          min={0}
                          value={s.totalPrice || ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setScopeOfWorks(prev => prev.map(x => x.id === s.id ? { ...x, totalPrice: val } : x));
                          }}
                          placeholder="0.00"
                           style={{ ...inputStyle, ...getInputChangedStyle(changedFields.has('totalPrice')), textAlign: 'right', fontWeight: 'bold' }}
                        />
                      </td>
                    )}
                    <td className="py-2.5">
                      {removeBtn(() => setScopeOfWorks(prev => prev.filter(x => x.id !== s.id)))}
                    </td>
                  </tr>
                  );
                })}
                {scopeOfWorks.length === 0 && (
                  <tr>
                    <td colSpan={showPrices ? 5 : 4} className="py-8 text-center text-xs text-slate-400 font-semibold">
                      No scope of work items added yet. Click &quot;Add Scope Item&quot; to add one, or run the AI Analysis in the estimation wizard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Technician Ground Notes & Discrepancy Justification ── */}
        <div style={sectionCard}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
                    TECHNICIAN FIELD NOTES &amp; GROUND OVERRIDE REASONS
                  </h2>
                  {editedBadge('fieldNotes')}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Document any physical site changes or reasons why counts/manpower differ from AI recommendation for Sales &amp; Admin review
                </p>
              </div>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Quick Ground Tags / Justifications:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'High ceiling (>3.5m) - Scaffolding/Lift needed',
                'Thick concrete walls - Heavy coring required',
                'Blind spot identified - Extra device(s) added',
                'Long cable pathway (>80m) - Extended routing',
                'Power source distant - Dedicated breaker requested',
                'Client requested additional scope during site visit',
                'Existing conduits obstructed - Re-piping needed',
              ].map(tag => {
                const isSelected = discrepancyJustifications.includes(tag);
                const savedTags = Array.isArray(savedSnapshotData?.discrepancyJustifications)
                  ? savedSnapshotData.discrepancyJustifications
                  : [];
                const isTagChanged = savedSnapshotData !== null && savedTags.includes(tag) !== isSelected;
                return (
                  <button
                    key={tag}
                    type="button"
                    style={isTagChanged ? {
                      borderColor: dark ? '#D97706' : '#F59E0B',
                      boxShadow: dark ? '0 0 0 1px rgba(245, 158, 11, 0.18)' : '0 0 0 1px rgba(245, 158, 11, 0.16)',
                    } : undefined}
                    onClick={() => {
                      setDiscrepancyJustifications(prev =>
                        isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : dark
                        ? 'bg-[#0D1527] border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={technicianNotes}
            onChange={e => setTechnicianNotes(e.target.value)}
            rows={3}
            placeholder="Type additional technician observations, site inspection remarks, or specific agreements made with the client on site..."
            className={`w-full rounded-xl text-xs outline-none focus:border-blue-500 leading-relaxed ${dark ? 'text-slate-100 bg-[#0D1527]' : 'text-slate-700 bg-white'}`}
            style={{ ...inputStyle, ...getInputChangedStyle(isSavedFieldChanged('technicianNotes')), padding: '12px' }}
          />
        </div>

        {/* ── Installation Notes & Constraints (Matches Reference Screenshot) ── */}
        <div style={sectionCard}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <h2 className={`text-xs font-black uppercase tracking-wider ${dark ? 'text-slate-100' : 'text-slate-800'}`}>INSTALLATION NOTES &amp; CONSTRAINTS</h2>
            {editedBadge('constraints')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { key: 'physical' as const, label: 'PHYSICAL', placeholder: 'Ceiling height is ~3m with gypsum board and concrete walls. Limited space in server room for additional equipment. Main entrances and fire exits must remain unobstructed during installation.' },
              { key: 'electrical' as const, label: 'ELECTRICAL', placeholder: 'Client must provide dedicated 220V power circuits for DVR, FACP, and access control panel. UPS backup required for critical systems. Electrical DB room located near server room.' },
              { key: 'installation' as const, label: 'INSTALLATION', placeholder: 'Installation must be conducted during non-business hours (6PM-6AM) to avoid disruption. Access to all areas must be granted 24/7 for installation and testing. Safety officer required on-site at all times.' },
            ] as const).map(c => (
              <div key={c.key} className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{c.label}</label>
                <textarea
                  value={constraints[c.key]}
                  onChange={e => setConstraints(prev => ({ ...prev, [c.key]: e.target.value }))}
                  rows={4}
                  placeholder={c.placeholder}
                  className={`w-full resize-none rounded-xl text-xs outline-none focus:border-blue-500 leading-relaxed ${dark ? 'text-slate-100 bg-[#0D1527]' : 'text-slate-700 bg-white'}`}
                  style={{ ...inputStyle, ...getInputChangedStyle(isSavedNestedFieldChanged('constraints', c.key)), padding: '10px 12px' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-end justify-between gap-3 mt-4">
          <button onClick={onBack} className={`px-6 py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
            dark ? 'bg-[#131B2E] text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
          }`}>
            Back to Project
          </button>
          
          <div className="flex items-end gap-3">
            {showPrices && (
              <button
                onClick={() => setShowQuotationModal(true)}
                className={`px-6 py-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                  dark ? 'text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 border-indigo-800' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View AA2000 Commercial Quotation
              </button>
            )}

            <div className="flex flex-col items-end gap-1.5">
              <div
                id="estimation-save-status"
                role="status"
                aria-live="polite"
                className={`flex items-center gap-1.5 text-[10px] font-bold ${
                  isSubmitting
                    ? dark ? 'text-blue-300' : 'text-blue-600'
                    : hasUnsavedChanges
                    ? dark ? 'text-amber-300' : 'text-amber-700'
                    : dark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSubmitting ? 'bg-blue-500 animate-pulse' : hasUnsavedChanges ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                {isSubmitting
                  ? 'Saving estimation...'
                  : !isInitialStateLoaded
                  ? 'Loading estimation...'
                  : hasUnsavedChanges
                  ? changedSections.size > 0
                  ? `Unsaved changes · ${changedSections.size} section${changedSections.size === 1 ? '' : 's'} edited`
                  : 'Unsaved changes'
                  : 'No unsaved changes'}
              </div>

              <span
                title={
                  isSubmitting
                    ? 'The estimation is currently being saved.'
                    : !isInitialStateLoaded
                    ? 'The estimation is still loading.'
                    : !hasUnsavedChanges
                    ? 'There are no changes to save.'
                    : undefined
                }
              >
                <button
                  disabled={isSubmitting || !isInitialStateLoaded || !hasUnsavedChanges}
                  onClick={async () => {
                    if (isSubmitting || !isInitialStateLoaded || !hasUnsavedChanges) return;
                    const snapshotAtSubmit = currentEstimationSnapshot;
                    const estimationData = {
                      manpower,
                      consumables,
                      fees,
                      scopeOfWorks,
                      constraints,
                      priceTier,
                      aiQuotation,
                      aiBaseline,
                      technicianNotes,
                      discrepancyJustifications,
                      updatedAt: new Date().toISOString(),
                    };
                    // Local cache (offline fallback)
                    localStorage.setItem(`aa2000_estimation_${project.id}`, JSON.stringify(estimationData));

                    // Persist to the database
                    setIsSubmitting(true);
                    const reportPdf = await generateReportPdf(true); // null if generation failed
                    const result = await submitEstimationToDB({
                      project: project as any, user: user as any, manpower, consumables, fees, scopeOfWorks,
                      constraints, priceTier, aiQuotation, aiBaseline,
                      technicianNotes, discrepancyJustifications, reportPdf,
                    });
                    setIsSubmitting(false);
                    if (result.success && !result.fileUploaded) {
                      toast.warning('Estimation saved, but the PDF report could not be attached.');
                    }
                    if (!result.success) {
                      toast.error(`Could not submit to the database: ${result.message}. Your work is saved locally; please try again.`);
                      return; // keep status unchanged and stay on this screen
                    }

                    savedSnapshotRef.current = snapshotAtSubmit;

                    const isApproved = project.status === 'Completed' || project.status === 'Finalized - Approved';
                    const isAlreadyFinalized = project.status === 'Finalized';

                    if (onUpdateStatus && !isApproved && !isAlreadyFinalized) {
                      // Only set to 'Finalized' (Awaiting Approval) for unsubmitted/pending projects
                      onUpdateStatus(project.id, 'Finalized');
                    }

                    if (isApproved) {
                      toast.success('Estimation updated successfully.');
                    } else if (isAlreadyFinalized) {
                      toast.success('Estimation updated. The project remains awaiting approval from Admin or Sales.');
                    } else {
                      toast.success('Estimation saved. The project is now awaiting approval from Admin or Sales.');
                    }

                    onBack();
                  }}
                  aria-describedby="estimation-save-status"
                  style={isSubmitting || !isInitialStateLoaded || !hasUnsavedChanges ? {
                    backgroundColor: dark ? '#334155' : '#CBD5E1',
                    color: dark ? '#94A3B8' : '#475569',
                  } : undefined}
                  className="px-8 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 disabled:hover:opacity-100 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Save Estimation'}
                </button>
              </span>
            </div>
          </div>
        </div>

        {/* ── AA2000 OFFICIAL COMMERCIAL SALES QUOTATION MODAL ── */}
        {showProductCatalog && (
          <ProductCatalogModal
            onSelect={product => setConsumables(prev => [...prev, consumableFromCatalog(product)])}
            onAddCustom={() => {
              setConsumables(prev => [...prev, createConsumable()]);
              setShowProductCatalog(false);
            }}
            onClose={() => setShowProductCatalog(false)}
            isDark={dark}
          />
        )}

        {showPrices && showQuotationModal && (
          <QuotationModal
            quotHeader={quotHeader}
            setQuotHeader={setQuotHeader}
            buildReportHtml={() => buildReportHtml(hasUnsavedChanges)}
            onDownloadPdf={handleExportPdf}
            isExportingPdf={isExportingPdf}
            onClose={() => setShowQuotationModal(false)}
            isDark={dark}
          />
        )}

      </main>
    </div>
  );
}
