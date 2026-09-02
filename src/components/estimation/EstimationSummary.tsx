import React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { Project, User } from '../../App';
import type { EstimationManpowerEntry, EstimationConsumableEntry, EstimationAdditionalFeeEntry } from '../../types';
import { analyzeFloorPlan, type FloorPlanEstimation } from '../../services/geminiFloorPlanService';
import { parseFile } from '../../services/fileParser';
import { systemBadgeIcons, Users, StatCalendar, Package as PackageIcon, Plug, Map as MapIcon, ExclamationTriangle, Plus, Document, User as UserIcon, MagnifyingGlass, ArrowRight, Check } from '../../utils/Icons';
import { useToast } from '../utils/Toast';
import { getEstimatedItemPricing, searchPricelist } from '../../services/pricelistService';
import QuotationModal, { type QuotationHeaderState, type ScopeOfWorkEntry, generateSystemScopeOfWorks } from './QuotationModal';

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

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  color: '#1E293B',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
};

const tableHeadStyle: React.CSSProperties = {
  paddingBottom: '10px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94A3B8',
  borderBottom: '1px solid #E2E8F0',
  textAlign: 'left',
};

const AI_STEPS = [
  'Reading floor plan layout & room structure...',
  'Identifying camera coverage zones & blind spots...',
  'Calculating cable routing distances & conduit paths...',
  'Estimating technician headcount & man-day requirements...',
  'Compiling materials bill-of-quantities & unit counts...',
];

import { canViewPrices } from '../../constants/roles';

export default function EstimationSummary({ project, user, onBack, onUpdateStatus }: Props) {
  const { toast } = useToast();
  const showPrices = canViewPrices(user?.role, user);

  const [priceTier, setPriceTier] = useState<'srp' | 'contractorPrice' | 'dealerPrice'>('srp');
  const [showQuotationModal, setShowQuotationModal] = useState(false);
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
  const [quotDiscount, setQuotDiscount] = useState<number>(0);
  const [showEditQuotation, setShowEditQuotation] = useState(false);

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

  // Floor plan upload — multiple files (images + PDFs)
  const [floorPlanFiles, setFloorPlanFiles] = useState<File[]>([]);
  const [floorPlanPreviews, setFloorPlanPreviews] = useState<{ name: string; url: string | null; type: string }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TOR upload
  const [torFiles, setTorFiles] = useState<File[]>([]);
  const [torPreviews, setTorPreviews] = useState<{ name: string; content: string }[]>([]);
  const [isTorDragOver, setIsTorDragOver] = useState(false);
  const torInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [isAiEstimating, setIsAiEstimating] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiMode, setAiMode] = useState<'real' | 'simulation'>('simulation');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiObservations, setAiObservations] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  // Auto-dismiss safety timer for completed estimation scan modal
  useEffect(() => {
    if (isAiEstimating && aiStep >= AI_STEPS.length) {
      const timer = setTimeout(() => {
        setIsAiEstimating(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAiEstimating, aiStep]);

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

  // Summary counts for the stat cards
  const totalHeadcount = manpower.reduce((sum, m) => sum + m.headcount, 0);
  const totalManDays = manpower.reduce((sum, m) => sum + m.manDays, 0);
  const totalMaterialLines = consumables.length;

  // Cable/meter total for quick reference
  const cableTotal = consumables
    .filter(c => c.unit?.toLowerCase().includes('meter') || c.unit?.toLowerCase() === 'm' || c.category === 'Wires & Cables')
    .reduce((sum, c) => sum + c.quantity, 0);

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

  // Handle file selection — appends to existing list
  const handleFilesSelect = (newFiles: FileList | File[]) => {
    const valid: File[] = [];
    const previews: { name: string; url: string | null; type: string }[] = [];
    Array.from(newFiles).forEach(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isImage && !isPdf) return;
      valid.push(file);
      previews.push({
        name: file.name,
        url: isImage ? URL.createObjectURL(file) : null,
        type: isPdf ? 'pdf' : 'image',
      });
    });
    if (!valid.length) { toast.warning('Please upload image files (JPG, PNG) or PDF documents.'); return; }
    setFloorPlanFiles(prev => [...prev, ...valid]);
    setFloorPlanPreviews(prev => [...prev, ...previews]);
    setAiError(null);
    setAiObservations(null);
    setAiConfidence(null);
  };

  const removeFile = (idx: number) => {
    setFloorPlanFiles(prev => prev.filter((_, i) => i !== idx));
    setFloorPlanPreviews(prev => {
      const removed = prev[idx];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleTorSelect = async (newFiles: FileList | File[]) => {
    const valid: File[] = [];
    const previews: { name: string; content: string }[] = [];
    
    for (const file of Array.from(newFiles)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['xls', 'xlsx', 'csv', 'docx', 'doc', 'txt', 'pdf'];
      if (!validExtensions.includes(ext || '')) continue;
      
      valid.push(file);
      try {
        const parsed = await parseFile(file);
        previews.push({
          name: file.name,
          content: parsed.content || ''
        });
      } catch (err) {
        console.error('Error parsing TOR file:', err);
        previews.push({
          name: file.name,
          content: ''
        });
      }
    }

    if (!valid.length) {
      toast.warning('Please upload spreadsheet, text or PDF specification documents.');
      return;
    }

    setTorFiles(prev => [...prev, ...valid]);
    setTorPreviews(prev => [...prev, ...previews]);
    setAiError(null);
    setAiObservations(null);
    setAiConfidence(null);
  };

  const removeTorFile = (idx: number) => {
    setTorFiles(prev => prev.filter((_, i) => i !== idx));
    setTorPreviews(prev => prev.filter((_, i) => i !== idx));
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

    surveysList.forEach(s => {
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
    const saved = localStorage.getItem(`aa2000_estimation_${project.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.manpower) setManpower(parsed.manpower);
        if (parsed.consumables) setConsumables(parsed.consumables);
        if (parsed.fees) setFees(parsed.fees);
        if (parsed.scopeOfWorks) setScopeOfWorks(parsed.scopeOfWorks);
        if (parsed.constraints) setConstraints(parsed.constraints);
        if (parsed.priceTier) setPriceTier(parsed.priceTier);
        if (parsed.aiBaseline) setAiBaseline(parsed.aiBaseline);
        if (parsed.technicianNotes) setTechnicianNotes(parsed.technicianNotes);
        if (parsed.discrepancyJustifications) setDiscrepancyJustifications(parsed.discrepancyJustifications);
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
  }, [project.id]);

  // Sync TOR documents uploaded in the survey wizard
  useEffect(() => {
    const projectSurveys = JSON.parse(localStorage.getItem('aa2000_surveys') || '[]')
      .filter((s: any) => s.projectId === project.id);
    
    const surveyTorContents: { name: string; content: string }[] = [];
    projectSurveys.forEach((s: any) => {
      if (s.data?.torContent) {
        const names = s.data.torFileName ? s.data.torFileName.split(', ') : ['Survey Specification Document'];
        names.forEach((name: string) => {
          surveyTorContents.push({
            name,
            content: s.data.torContent,
          });
        });
      }
    });

    if (surveyTorContents.length > 0) {
      setTorPreviews(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        const filtered = surveyTorContents.filter(c => !existingNames.has(c.name));
        return [...prev, ...filtered];
      });
      setTorFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const newStubs = surveyTorContents
          .filter(c => !existingNames.has(c.name))
          .map(c => new File([c.content], c.name, { type: 'text/plain' }));
        return [...prev, ...newStubs];
      });
    }
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
    setQuotDiscount(aiQuotation?.costBreakdown?.discount || 0);
    setShowEditQuotation(false);
  }, [showQuotationModal]);

  // Real AI estimation runner
  const runAiEstimation = async () => {
    setAiError(null);
    setAiObservations(null);
    setAiConfidence(null);
    setAiStep(0);

    // Build the surveyType string from project.systemTypes (comma-separated for the AI)
    const surveyTypeStr = (project.systemTypes && project.systemTypes.length > 0)
      ? project.systemTypes.join(',')
      : (project.buildingType || 'CCTV');

    setAiMode('real');
    setIsAiEstimating(true);

    let stepInterval: ReturnType<typeof setInterval>;
    let currentStep = 0;
    stepInterval = setInterval(() => {
      currentStep = Math.min(currentStep + 1, AI_STEPS.length - 1);
      setAiStep(currentStep);
    }, 800);

    try {
      const torContent = torPreviews.map(t => `--- ${t.name} ---\n${t.content}`).join('\n\n');

      const result = await analyzeFloorPlan(
        floorPlanFiles,
        surveyTypeStr,
        {
          buildingType: project.buildingType,
          floors: project.floors,
          location: project.location,
          projectName: project.name,
          surveyScope: project.surveyScope,
          torContent,
        }
      );

      clearInterval(stepInterval);
      setAiStep(AI_STEPS.length);

      setManpower(
        result.manpower.map(m => {
          const dayRate = getRoleDefaultDayRate(m.role);
          return {
            id: crypto.randomUUID(),
            role: m.role,
            headcount: m.headcount,
            hours: m.hours,
            manDays: m.manDays,
            dayRate,
            totalCost: m.totalCost || (dayRate * m.manDays),
          };
        })
      );

      setConsumables(
        result.consumables.map(c => {
          const srp = Number(c.srp) || c.unitPrice || 0;
          const contractorPrice = Number(c.contractorPrice) || Math.round(srp * 0.85);
          const dealerPrice = Number(c.dealerPrice) || Math.round(srp * 0.75);
          const unitPrice = priceTier === 'srp' ? srp : priceTier === 'contractorPrice' ? contractorPrice : dealerPrice;
          return {
            id: crypto.randomUUID(),
            name: c.name,
            brand: (c as any).brand || detectBrandFromName(c.name) || '',
            category: mapCategoryToOption(c.category),
            quantity: c.quantity,
            unit: c.unit || 'pcs',
            srp,
            contractorPrice,
            dealerPrice,
            unitPrice,
            totalPrice: unitPrice * c.quantity,
          };
        })
      );

      setFees(
        result.fees.map(f => ({
          id: crypto.randomUUID(),
          type: f.type as EstimationAdditionalFeeEntry['type'],
          amount: f.amount || 0,
          description: f.description,
        }))
      );

      if (result.scopeOfWorks && result.scopeOfWorks.length > 0) {
        setScopeOfWorks(
          result.scopeOfWorks.map((s, idx) => ({
            id: crypto.randomUUID(),
            itemNumber: s.itemNumber || idx + 1,
            description: s.description || '',
            unit: s.unit || '1 LOT',
            totalPrice: s.totalPrice || 0,
          }))
        );
      }

      if (result.constraints) {
        setConstraints({
          physical: result.constraints.physical || '',
          electrical: result.constraints.electrical || '',
          installation: result.constraints.installation || '',
        });
      }

      if (result.observations) {
        setAiObservations(result.observations);
      }

      if (result.confidenceScore >= 0) {
        setAiConfidence(result.confidenceScore);
      }

      // Store full AI-generated quotation structure for the modal
      setAiQuotation(result);

      // Save baseline object for AI-vs-Tech ground validation tracking
      const baselineObj = {
        manpower: result.manpower.map(m => ({ ...m })),
        consumables: result.consumables.map(c => ({ ...c })),
        fees: result.fees.map(f => ({ ...f })),
        constraints: result.constraints,
        observations: result.observations,
        confidenceScore: result.confidenceScore,
        generatedAt: new Date().toISOString(),
      };
      setAiBaseline(baselineObj);
      localStorage.setItem(`aa2000_ai_baseline_${project.id}`, JSON.stringify(baselineObj));

      // Fast, smooth auto-close so the user doesn't wait
      setTimeout(() => {
        setIsAiEstimating(false);
        toast.success('Bill of Quantities generated successfully!');
      }, 500);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setAiError(err instanceof Error ? err.message : 'AI estimation failed. Please try again.');
    }
  };

  const handleExportPdf = async () => {
    const exportBtn = document.activeElement as HTMLButtonElement;
    const originalText = exportBtn ? exportBtn.innerHTML : 'Export PDF';
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerText = 'Generating PDF...';
    }

    try {
      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = (e) => reject(new Error('Failed to load PDF library'));
          document.head.appendChild(script);
        });
      }

      const totalLabor = manpower.reduce((sum, m) => sum + (m.totalCost || ((m.dayRate || 1000) * m.manDays)), 0);
      const totalMaterials = consumables.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
      const totalFees = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
      const subtotal = totalLabor + totalMaterials + totalFees;
      const vat = subtotal * 0.12;
      const grandTotalWithVAT = subtotal * 1.12;

      const hardwareTotal = consumables
        .filter(c => c.category !== 'Wires & Cables')
        .reduce((sum, c) => sum + (c.totalPrice || 0), 0);

      const cablingTotal = consumables
        .filter(c => c.category === 'Wires & Cables')
        .reduce((sum, c) => sum + (c.totalPrice || 0), 0);

      const systemLabelsWithBrands = (project.systemTypes || []).map(type => {
        const brand = getSystemBrand(type);
        return brand ? `${type} (${brand})` : type;
      });
      const systemLabel = systemLabelsWithBrands.join(' & ') || 'Security & Technology';

      const formattedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const constraintTexts = [
        constraints.physical ? `Physical: ${constraints.physical}` : '',
        constraints.electrical ? `Electrical: ${constraints.electrical}` : '',
        constraints.installation ? `Cabling/Shift: ${constraints.installation}` : ''
      ].filter(Boolean).join(' | ');

      const technicianName = project.technicianName || (user?.fullName || 'Demo Technician');

      // Create a 1px hidden outer wrapper to bypass browser paint optimization
      const outer = document.createElement('div');
      outer.style.position = 'fixed';
      outer.style.top = '0';
      outer.style.left = '0';
      outer.style.width = '816px';
      outer.style.height = '1px';
      outer.style.overflow = 'hidden';
      outer.style.zIndex = '99999';
      outer.style.pointerEvents = 'none';

      const container = document.createElement('div');
      container.style.width = '816px';
      container.style.padding = '0';
      container.style.boxSizing = 'border-box';
      container.style.background = '#FFFFFF';
      container.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
      container.style.color = '#1E293B';

      const headerHtml = `
        <!-- HEADER BANNER -->
        <div style="background: #1E3A8A; color: #FFFFFF; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; border-radius: 2px;">
          <div style="display: flex; align-items: center;">
            <!-- Camera Lens Logo -->
            <div style="width: 32px; height: 32px; border-radius: 50%; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #FFFFFF 30%, transparent 70%); margin-right: 12px; flex-shrink: 0;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: #FFFFFF;"></div>
            </div>
            <div>
              <div style="font-size: 26px; font-weight: 900; line-height: 1; letter-spacing: 0.05em; font-family: 'Inter', sans-serif;">AA2000</div>
              <div style="font-size: 10px; font-weight: 600; opacity: 0.9; margin-top: 1px; font-family: 'Inter', sans-serif; letter-spacing: 0.02em;">Security and Technology Solutions Inc.</div>
            </div>
          </div>
          <div style="text-align: right; font-size: 8px; line-height: 1.45; max-width: 380px; opacity: 0.95; font-family: 'Inter', sans-serif;">
            <div>Unit 2-C Norkis Building, 11 Calbayog Cor., Domingo M. Guevara St., Mandaluyong City, Philippines 1550</div>
            <div>T: (02) 8571-5693 &nbsp;|&nbsp; M: 0917-884-8844 &nbsp;|&nbsp; E: aa2000ent@gmail.com &nbsp;|&nbsp; Web: www.aa2000ph.com</div>
          </div>
        </div>
      `;

      const footerHtml = `
        <!-- FOOTER -->
        <div style="position: absolute; bottom: 35px; left: 40px; right: 40px; border-top: 1px dashed #CBD5E1; padding-top: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; color: #64748B; font-size: 8px; font-family: 'Inter', sans-serif;">
            <div>Unit 2-C Norkis Building, 11 Calbayog Cor., Domingo M. Guevara St., Mandaluyong City, Philippines 1550 &nbsp;|&nbsp; T: (02) 8571-5693</div>
            <div style="font-weight: 700; color: #475569;">Disclaimer: This report is generated for client presentation and reflects finalized project details.</div>
          </div>
        </div>
      `;

      container.innerHTML = `
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
        
        <!-- PAGE 1: SUMMARY & COST SUMMARY -->
        <div style="box-sizing: border-box; width: 100%; height: 1045px; padding: 40px; position: relative; page-break-after: always; background: #FFFFFF; border: 1px solid #CBD5E1;">
          ${headerHtml}
          
          <!-- REPORT TITLE -->
          <div style="margin-top: 25px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px;">
            <div>
              <h1 style="color: #1E3A8A; font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.01em;">FINALIZED PROJECT REPORT</h1>
              <p style="font-size: 11px; color: #475569; font-weight: 700; margin: 4px 0 0 0;">Project Name: ${project.name}</p>
            </div>
            <div style="font-size: 11px; color: #64748B; font-weight: 700;">${formattedDate}</div>
          </div>

          <!-- PROJECT SUMMARY -->
          <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 20px 0 6px 0; letter-spacing: 0.05em;">Project Summary</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: 'Inter', sans-serif;">
            <tr>
              <td style="width: 16%; padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Company Name</td>
              <td style="width: 34%; padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${project.clientName}</td>
              <td style="width: 16%; padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Client Name</td>
              <td style="width: 34%; padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${project.clientContactName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Address</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${project.location}</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Client Contact</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${project.clientPhone || 'No Contact'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Client Email</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${project.clientEmail || 'No Email'}</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Technician</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${technicianName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Status</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #059669; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.02em;">${project.status === 'Completed' ? 'Finalized - Approved' : project.status}</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Finalized at</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; background: #F8FAFC; font-weight: 700; color: #475569;">Total Cost</td>
              <td colspan="3" style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E3A8A; font-weight: 900; font-size: 11px;">PHP ${grandTotalWithVAT.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>

          <!-- COST BREAKDOWN -->
          <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 25px 0 6px 0; letter-spacing: 0.05em;">Cost Breakdown Summary</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: 'Inter', sans-serif;">
            <thead>
              <tr style="background: #F8FAFC; text-align: left;">
                <th style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 22%;">Category</th>
                <th style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 44%;">Item/Role</th>
                <th style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 12%; text-align: center;">Qty/Hours</th>
                <th style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 11%; text-align: right;">Unit Cost</th>
                <th style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 11%; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <!-- Hardware Subtotal -->
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-weight: 700; color: #64748B;">Cost Summary</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${systemLabel}: Hardware</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">PHP ${hardwareTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <!-- Cabling Subtotal -->
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-weight: 700; color: #64748B;">Cost Summary</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${systemLabel}: Cabling</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">PHP ${cablingTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <!-- Labor Subtotal -->
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-weight: 700; color: #64748B;">Cost Summary</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${systemLabel}: Labor</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center; color: #1E293B; font-weight: 600;">${totalManDays}d x ${totalHeadcount} tech</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">PHP ${(totalManDays > 0 ? totalLabor / totalManDays : 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">PHP ${totalLabor.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <!-- Logistics / Fees -->
              ${totalFees > 0 ? `
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-weight: 700; color: #64748B;">Cost Summary</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">Logistics & Special Fees</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">PHP ${totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>` : ''}
              <!-- VAT Row -->
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-weight: 700; color: #64748B;">Cost Summary</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">VAT (12%)</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #64748B;">-</td>
                <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 700;">PHP ${vat.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <!-- Grand Total row -->
              <tr style="background: #EFF6FF;">
                <td colspan="4" style="padding: 10px 10px; border: 1px solid #E2E8F0; font-weight: 900; color: #1E3A8A; text-transform: uppercase; text-align: right;">Total Cost (Project, VAT Inc.)</td>
                <td style="padding: 10px 10px; border: 1px solid #E2E8F0; text-align: right; color: #1E3A8A; font-weight: 900; font-size: 11px;">PHP ${grandTotalWithVAT.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          
          ${footerHtml}
        </div>

        <!-- PAGE 2: TECHNICAL DETAILS, ROLES & CONSUMABLES -->
        <div style="box-sizing: border-box; width: 100%; height: 1045px; padding: 40px; position: relative; background: #FFFFFF; border: 1px solid #CBD5E1;">
          ${headerHtml}
          
          <!-- TECHNICAL BREAKDOWN -->
          <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 25px 0 6px 0; letter-spacing: 0.05em;">Technical Breakdown</h2>
          <div style="font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 8px;">System: ${systemLabel}</div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; font-family: 'Inter', sans-serif; margin-bottom: 15px;">
            <thead>
              <tr style="background: #F8FAFC; text-align: left;">
                <th style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%;">Duration</th>
                <th style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%;">Technicians</th>
                <th style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 60%;">Site Constraints</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${totalManDays} day(s)</td>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${totalHeadcount} tech(s)</td>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${constraintTexts || 'None recorded'}</td>
              </tr>
            </tbody>
          </table>

          <!-- Manpower & Consumables Details Side-by-side -->
          <div style="display: flex; gap: 15px; margin-top: 15px;">
            <!-- Manpower Role Details -->
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.02em;">Manpower Role Breakdown</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; font-family: 'Inter', sans-serif;">
                <thead>
                  <tr style="background: #F8FAFC; text-align: left;">
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 60%;">Manpower Role</th>
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%; text-align: center;">Count</th>
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%; text-align: center;">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  ${manpower.length > 0 ? manpower.map(m => `
                    <tr>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600;">${m.role}</td>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; text-align: center; color: #1E293B; font-weight: 600;">${m.headcount}</td>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; text-align: center; color: #1E293B; font-weight: 600;">${m.hours}</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="3" style="padding: 8px; border: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-weight: 600;">No manpower breakdown recorded</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>

            <!-- Consumables Details -->
            <div style="flex: 1.2;">
              <div style="font-size: 9px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.02em;">Consumables & Wires</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; font-family: 'Inter', sans-serif;">
                <thead>
                  <tr style="background: #F8FAFC; text-align: left;">
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 45%;">Consumable</th>
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%;">Brand</th>
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 15%; text-align: center;">Qty</th>
                    <th style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%; text-align: right;">Line Cost</th>
                  </tr>
                </thead>
                <tbody>
                  ${consumables.length > 0 ? consumables.map(c => `
                    <tr>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600; line-clamp: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 135px;" title="${c.name}">${c.name}</td>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 600; line-clamp: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60px;" title="${c.brand || ''}">${c.brand || '-'}</td>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; text-align: center; color: #1E293B; font-weight: 600;">${c.quantity} ${c.unit || 'pcs'}</td>
                      <td style="padding: 5px 6px; border: 1px solid #E2E8F0; text-align: right; color: #1E293B; font-weight: 600;">PHP ${(c.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="4" style="padding: 8px; border: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-weight: 600;">No consumables recorded</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <!-- REMARKS -->
          <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 25px 0 6px 0; letter-spacing: 0.05em;">Remarks</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; font-family: 'Inter', sans-serif;">
            <thead>
              <tr style="background: #F8FAFC; text-align: left;">
                <th style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 20%;">Source</th>
                <th style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 80%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 700;">Technician</td>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 600;">${project.surveyScope || 'No technician remarks recorded.'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: 700;">Department</td>
                <td style="padding: 6px 8px; border: 1px solid #E2E8F0; color: #475569; font-weight: 600;">No department remarks recorded.</td>
              </tr>
            </tbody>
          </table>
          
          ${footerHtml}
        </div>
      `;

      outer.appendChild(container);
      document.body.appendChild(outer);

      // Wait 250ms for browser layout & font loading
      await new Promise(resolve => setTimeout(resolve, 250));

      const opt = {
        margin:       0,
        filename:     `AA2000_Report_${project.name.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await (window as any).html2pdf().set(opt).from(container).save();
      document.body.removeChild(outer);
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('An error occurred while generating the PDF. Please try again.');
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalText;
      }
    }
  };

  const hasFiles = floorPlanFiles.length > 0;
  const sectionCard: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  };

  const addBtn = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:bg-slate-50 text-slate-600"
    >
      + {label}
    </button>
  );

  const removeBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
    >
      Remove
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto pb-16" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 px-6 py-4 bg-gradient-to-r from-white/95 to-blue-50/95 border-b border-slate-200 shadow-sm backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors px-3 py-2 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Project
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={runAiEstimation}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-all hover:opacity-95"
              style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)' }}
            >
              <svg className="w-3.5 h-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              {hasFiles ? `ANALYZE ${floorPlanFiles.length} FLOOR PLAN${floorPlanFiles.length > 1 ? 'S' : ''}` : 'AI ESTIMATE SCAN'}
            </button>

            <button
              onClick={handleExportPdf}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:text-[#1E3A8A] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Project title card */}
        <div style={{ ...sectionCard, marginBottom: '24px' }}>
          <h1 className="text-xl font-black text-slate-800">{project.name}</h1>
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
                return (
                  <span
                    key={type}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border"
                    style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '30' }}
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
              <div key={item.label} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}: </span>
                <span className="text-xs font-bold text-slate-600">{item.value}</span>
              </div>
            ))}
            {project.surveyScope && (
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 max-w-sm">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Scope: </span>
                <span className="text-xs font-semibold text-slate-600 line-clamp-1">{project.surveyScope}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Estimation Summary Cards ── */}
        {(manpower.length > 0 || consumables.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Headcount', value: `${totalHeadcount} pax`, icon: '', color: '#1E3A8A', bg: '#EFF6FF' },
              { label: 'Total Man-Days', value: `${totalManDays} days`, icon: '', color: '#065F46', bg: '#ECFDF5' },
              { label: 'Material Lines', value: `${totalMaterialLines} items`, icon: '', color: '#92400E', bg: '#FFFBEB' },
              { label: 'Cable Estimate', value: cableTotal > 0 ? `~${cableTotal.toLocaleString()} m` : '—', icon: '', color: '#6B21A8', bg: '#FAF5FF' },
            ].map(card => (
              <div key={card.label} className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: card.bg, border: `1px solid ${card.color}18` }}>
                {card.label === 'Total Headcount' ? <Users className="w-5 h-5" /> : card.label === 'Total Man-Days' ? <StatCalendar className="w-5 h-5" /> : card.label === 'Material Lines' ? <PackageIcon className="w-5 h-5" /> : card.label === 'Cable Estimate' ? <Plug className="w-5 h-5" /> : null}
                <span className="text-lg font-black" style={{ color: card.color }}>{card.value}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: card.color + 'AA' }}>{card.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Baseline vs. Field Validated Variance Tracker ── */}
        {aiBaseline && (
          <div className="rounded-2xl p-5 mb-5 border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-indigo-100/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  🤖
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    AI Pre-Estimate vs. Ground-Validated Variance
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    AI recommendation is baseline · Field technician and sales can adjust all counts, materials, and pricing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Editable Ground Overrides Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Headcount (Actual vs AI)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm font-black text-slate-800">{totalHeadcount} pax</span>
                  <span className="text-[10px] text-slate-400 font-medium line-through">
                    {aiBaseline.manpower?.reduce((acc: number, m: any) => acc + (Number(m.headcount) || 0), 0) || 0} pax
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Man-Days (Actual vs AI)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm font-black text-slate-800">{totalManDays} days</span>
                  <span className="text-[10px] text-slate-400 font-medium line-through">
                    {aiBaseline.manpower?.reduce((acc: number, m: any) => acc + (Number(m.manDays) || 0), 0) || 0} days
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material Items (Actual vs AI)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm font-black text-slate-800">{totalMaterialLines} lines</span>
                  <span className="text-[10px] text-slate-400 font-medium line-through">
                    {aiBaseline.consumables?.length || 0} lines
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ground Justification</p>
                <div className="mt-1 truncate">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    discrepancyJustifications.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {discrepancyJustifications.length > 0 ? `${discrepancyJustifications.length} field reason(s) noted` : 'No ground changes'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Floor Plan Upload Section ── */}
        <div style={{ ...sectionCard, border: hasFiles ? '1px solid #2563EB' : '1px solid #E2E8F0', background: hasFiles ? '#F8FAFC' : '#FFFFFF' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <MapIcon className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Floor Plan Upload</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              Powers AI Analysis
            </span>
          </div>

          {/* AI Observations & Confidence */}
          {aiObservations && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">AI Floor Plan Observations</p>
                {aiConfidence !== null && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 rounded-full bg-blue-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${aiConfidence}%`,
                          background: aiConfidence >= 80 ? '#16A34A' : aiConfidence >= 60 ? '#D97706' : '#DC2626',
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-black"
                      style={{
                        color: aiConfidence >= 80 ? '#16A34A' : aiConfidence >= 60 ? '#D97706' : '#DC2626',
                      }}
                    >
                      {aiConfidence}% confident
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs font-semibold text-blue-800">{aiObservations}</p>
            </div>
          )}

          {/* Error display */}
          {aiError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
              <ExclamationTriangle className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700">{aiError}</p>
                {aiError.includes('Settings') && (
                  <p className="text-[11px] text-red-500 mt-1">Contact your administrator to add an API key.</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Floor Plan Drawings Dropzone & List */}
            <div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2 block">Floor Plan Drawings</span>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onPaste={e => { e.preventDefault(); }}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files.length) handleFilesSelect(e.dataTransfer.files);
                }}
                className="border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-8 cursor-pointer transition-all"
                style={{
                  borderColor: isDragOver ? '#2563EB' : hasFiles ? '#93C5FD' : '#E2E8F0',
                  background: isDragOver ? '#EFF6FF' : hasFiles ? '#F8FAFC' : '#F8FAFC',
                }}
              >
                {hasFiles ? <Plus className="w-8 h-8 text-slate-300 mb-3" /> : <MapIcon className="w-8 h-8 text-slate-300 mb-3" />}
                <p className="text-xs font-black text-slate-700">
                  {hasFiles ? 'Add more floor plans' : 'Drop floor plans here'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">JPG, PNG or PDF · Multiple files</p>
              </div>

              {floorPlanPreviews.length > 0 && (
                <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {floorPlanPreviews.map((fp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-blue-100"
                    >
                      {fp.url ? (
                        <img src={fp.url} alt={fp.name} className="w-10 h-8 object-contain rounded border border-slate-200 bg-slate-50 shrink-0" />
                      ) : (
                        <div className="w-10 h-8 rounded border border-red-100 bg-red-50 flex items-center justify-center shrink-0">
                          <Document className="w-3.5 h-3.5 text-red-500" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{fp.name}</p>
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide"
                          style={fp.type === 'pdf'
                            ? { background: '#FEF2F2', color: '#DC2626' }
                            : { background: '#EFF6FF', color: '#2563EB' }
                          }
                        >
                          {fp.type === 'pdf' ? 'PDF' : 'Image'}
                        </span>
                      </div>

                      <button
                        onClick={() => removeFile(idx)}
                        className="w-5 h-5 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center text-xs font-black transition-colors shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TOR / Spec Documents Dropzone & List */}
            <div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2 block">Terms of Reference (TOR) Specs (Optional)</span>
              <div
                onClick={() => torInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsTorDragOver(true); }}
                onDragLeave={() => setIsTorDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsTorDragOver(false);
                  if (e.dataTransfer.files.length) handleTorSelect(e.dataTransfer.files);
                }}
                className="border-2 border-dashed rounded-2xl flex flex-col items-center justify-center py-8 cursor-pointer transition-all"
                style={{
                  borderColor: isTorDragOver ? '#2563EB' : torFiles.length > 0 ? '#93C5FD' : '#E2E8F0',
                  background: isTorDragOver ? '#EFF6FF' : torFiles.length > 0 ? '#FAFAFE' : '#F8FAFC',
                }}
              >
                {torFiles.length > 0 ? <Plus className="w-8 h-8 text-slate-300 mb-3" /> : <Document className="w-8 h-8 text-slate-300 mb-3" />}
                <p className="text-xs font-black text-slate-700">
                  {torFiles.length > 0 ? 'Add more TOR files' : 'Drop TOR / Spec files here'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Excel, Word, Text or PDF · Multiple files</p>
              </div>

              {torFiles.length > 0 && (
                <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {torFiles.map((tf, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-blue-100"
                    >
                      <div className="w-10 h-8 rounded border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
                        <Document className="w-3.5 h-3.5 text-blue-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{tf.name}</p>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide">
                          TOR Specs
                        </span>
                      </div>

                      <button
                        onClick={() => removeTorFile(idx)}
                        className="w-5 h-5 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center text-xs font-black transition-colors shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) {
                const files = Array.from(e.target.files);
                e.target.value = '';
                handleFilesSelect(files);
              }
            }}
          />

          <input
            ref={torInputRef}
            type="file"
            accept=".xls,.xlsx,.csv,.docx,.doc,.txt,.pdf"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) {
                const files = Array.from(e.target.files);
                e.target.value = '';
                handleTorSelect(files);
              }
            }}
          />

          <p className="text-[10px] font-semibold text-slate-400 mt-3">
            {hasFiles
              ? <><Check className="w-3 h-3 inline text-emerald-500 mr-0.5" /> {floorPlanFiles.length} file{floorPlanFiles.length > 1 ? 's' : ''} ready {torFiles.length > 0 ? `(${torFiles.length} TOR spec file${torFiles.length > 1 ? 's' : ''} loaded)` : ''} — click "ANALYZE {floorPlanFiles.length} FLOOR PLAN{floorPlanFiles.length > 1 ? 'S' : ''}" to run AI scan</>
              : 'Without a floor plan, "AI ESTIMATE SCAN" uses building type + floor count as a simulation instead'}
          </p>
        </div>

        {/* ── Manpower Section (Matches Reference Screenshot) ── */}
        <div style={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 text-[#1E3A8A]"><UserIcon className="w-5 h-5" /></div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">MANPOWER BREAKDOWN</h2>
            </div>
            <div className="flex items-center gap-3">
              {totalManDays > 0 && (
                <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100">
                  {totalManDays} total man-days
                </span>
              )}
              {addBtn('Add Row', () => setManpower(prev => [...prev, createManpower()]))}
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {(showPrices 
                    ? ['Role', 'Headcount', 'Hours', 'Man-Days', 'Day Rate (₱)', 'Total Cost (₱)', '']
                    : ['Role', 'Headcount', 'Hours', 'Man-Days', '']
                  ).map(h => (
                    <th key={h} style={tableHeadStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manpower.map(m => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 pr-2">
                      <input value={m.role} onChange={e => updateManpower(m.id, 'role', e.target.value)} placeholder="e.g. Lead Security Engineer"
                        style={{ ...inputStyle, width: '220px', fontWeight: '600' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <input type="number" min={1} value={m.headcount} onChange={e => updateManpower(m.id, 'headcount', Number(e.target.value))}
                        style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <input type="number" min={1} value={m.hours} onChange={e => updateManpower(m.id, 'hours', Number(e.target.value))}
                        style={{ ...inputStyle, width: '70px', textAlign: 'center' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <span className="text-xs font-black text-blue-600 px-2 py-1 rounded-lg bg-blue-50">{m.manDays}</span>
                    </td>
                    {showPrices && (
                      <>
                        <td className="py-2.5 pr-2">
                          <input type="number" min={0} value={m.dayRate || ''} onChange={e => updateManpower(m.id, 'dayRate', Number(e.target.value))}
                            placeholder="1000" style={{ ...inputStyle, width: '90px', textAlign: 'right' }} />
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <span className="text-xs font-black text-slate-900">₱{((m.totalCost || (m.dayRate || 0) * m.manDays)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                      </>
                    )}
                    <td className="py-2.5">{removeBtn(() => setManpower(prev => prev.filter(x => x.id !== m.id)))}</td>
                  </tr>
                ))}
                {showPrices && manpower.length > 0 && (
                  <tr className="border-t-2 border-slate-100 bg-slate-50/70">
                    <td colSpan={5} className="py-2.5 text-right text-xs font-bold text-slate-700 pr-3">Total Manpower Cost:</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span className="text-sm font-black text-blue-700">
                        ₱{manpower.reduce((sum, m) => sum + (m.totalCost || ((m.dayRate || 1000) * m.manDays)), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td />
                  </tr>
                )}
                {manpower.length === 0 && (
                  <tr><td colSpan={showPrices ? 7 : 5} className="py-8 text-center text-xs text-slate-400 font-semibold">
                    Upload a floor plan and click "ANALYZE FLOOR PLAN", or click "AI ESTIMATE SCAN" to simulate, or add rows manually.
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600"><PackageIcon className="w-5 h-5" /></div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">BILL OF MATERIALS</h2>
            </div>
            <div className="flex items-center gap-3">
              {consumables.length > 0 && (
                <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100">
                  {consumables.length} Line Items
                </span>
              )}
              {showPrices && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                  {(['srp', 'contractorPrice', 'dealerPrice'] as const).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setPriceTier(tier)}
                      className="px-3 py-1 rounded-lg text-[10px] font-black transition-all"
                      style={{
                        background: priceTier === tier ? '#1E3A8A' : 'transparent',
                        color: priceTier === tier ? '#FFFFFF' : '#94A3B8',
                      }}
                    >
                      {tier === 'srp' ? 'SRP' : tier === 'contractorPrice' ? 'Contractor' : 'Dealer'}
                    </button>
                  ))}
                </div>
              )}
              {addBtn('Add Item', () => setConsumables(prev => [...prev, createConsumable()]))}
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {(showPrices
                    ? ['Item / Specification', 'Category', 'Qty', 'Unit', 'Unit Price (₱)', 'Total Price (₱)', '']
                    : ['Item / Specification', 'Category', 'Qty', 'Unit', '']
                  ).map(h => (
                    <th key={h} style={tableHeadStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consumables.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 pr-2">
                      <input
                        value={c.name}
                        onChange={e => updateConsumable(c.id, 'name', e.target.value)}
                        placeholder="e.g. Hikvision DS-2CD2143G2-I"
                        style={{ ...inputStyle, width: '280px', fontWeight: '600' }}
                      />
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {c.category || 'Hardware'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-center">
                      <input type="number" min={1} value={c.quantity} onChange={e => updateConsumable(c.id, 'quantity', Number(e.target.value))}
                        style={{ ...inputStyle, width: '50px', textAlign: 'center', fontWeight: 'bold' }} />
                    </td>
                    <td className="py-2.5 pr-2 text-slate-500 font-medium">
                      <input value={c.unit} onChange={e => updateConsumable(c.id, 'unit', e.target.value)}
                        placeholder="pcs" style={{ ...inputStyle, width: '50px' }} />
                    </td>
                    {showPrices && (
                      <>
                        <td className="py-2.5 pr-2 text-right">
                          <input type="number" min={0} value={c.unitPrice || ''} onChange={e => updateConsumable(c.id, 'unitPrice', Number(e.target.value))}
                            placeholder="0" style={{ ...inputStyle, width: '90px', textAlign: 'right' }} />
                        </td>
                        <td className="py-2.5 pr-2 text-right font-black text-slate-900">
                          ₱{(c.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                    <td className="py-2.5">{removeBtn(() => setConsumables(prev => prev.filter(x => x.id !== c.id)))}</td>
                  </tr>
                ))}
                {showPrices && consumables.length > 0 && (
                  <tr className="border-t-2 border-slate-100 bg-slate-50/70">
                    <td colSpan={5} className="py-2.5 text-right text-xs font-bold text-slate-700 pr-3">Total Materials Price:</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span className="text-sm font-black text-emerald-700">
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 text-rose-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9H9a2.25 2.25 0 0 0-2.25 2.25v3.75m0 0h15" />
                </svg>
              </div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">ADDITIONAL FEES</h2>
            </div>
            {addBtn('Add Fee', () => setFees(prev => [...prev, createFee()]))}
          </div>
          <div className="space-y-2">
            {fees.map(f => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <select value={f.type} onChange={e => updateFee(f.id, 'type', e.target.value)}
                    style={{ ...inputStyle, width: '160px', cursor: 'pointer', fontWeight: 'bold' }}>
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
                    style={{ ...inputStyle, width: '320px' }} />
                </div>
                <div className="flex items-center gap-3">
                  {showPrices && (
                    <input type="number" min={0} value={f.amount ?? ''} onChange={e => updateFee(f.id, 'amount', Number(e.target.value))}
                      style={{ ...inputStyle, width: '110px', textAlign: 'right', fontWeight: 'bold' }} />
                  )}
                  {removeBtn(() => setFees(prev => prev.filter(x => x.id !== f.id)))}
                </div>
              </div>
            ))}
            {fees.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400 font-semibold">No additional fees configured.</p>
            )}
          </div>
        </div>

        {/* ── Overall BOQ Estimation Summary ── */}
        {showPrices && (() => {
          const totalLabor = manpower.reduce((sum, m) => sum + (m.totalCost || ((m.dayRate || 1000) * m.manDays)), 0);
          const totalMaterials = consumables.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
          const totalFees = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
          const grandTotal = totalLabor + totalMaterials + totalFees;

          return (
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/60 via-white to-slate-50 p-5 shadow-sm space-y-3 mb-5">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <span className="text-xs font-black text-blue-950 uppercase tracking-wider">OVERALL BOQ ESTIMATION SUMMARY</span>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-600 text-white uppercase tracking-wider">Grand Total</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MANPOWER TOTAL</span>
                  <p className="text-base font-black text-blue-700 mt-0.5">₱{totalLabor.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MATERIALS TOTAL</span>
                  <p className="text-base font-black text-emerald-700 mt-0.5">₱{totalMaterials.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ADDITIONAL FEES</span>
                  <p className="text-base font-black text-slate-700 mt-0.5">₱{totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-blue-100">
                <span className="text-sm font-extrabold text-slate-800">Grand Total BOQ Estimation:</span>
                <span className="text-2xl font-black text-blue-700">₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          );
        })()}

        {/* ── Scope of Works Section (Section B) ── */}
        <div style={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-700">
                <Document className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Scope of Works &amp; Deliverables (Section B)</h2>
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
                {scopeOfWorks.map((s, idx) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-center font-bold text-xs text-slate-700">
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
                        className="w-full resize-y rounded-xl text-xs outline-none focus:border-[#1E3A8A] font-sans leading-relaxed"
                        style={{ ...inputStyle, padding: '8px 10px' }}
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
                        style={{ ...inputStyle, textAlign: 'center' }}
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
                          style={{ ...inputStyle, textAlign: 'right', fontWeight: 'bold' }}
                        />
                      </td>
                    )}
                    <td className="py-2.5">
                      {removeBtn(() => setScopeOfWorks(prev => prev.filter(x => x.id !== s.id)))}
                    </td>
                  </tr>
                ))}
                {scopeOfWorks.length === 0 && (
                  <tr>
                    <td colSpan={showPrices ? 5 : 4} className="py-8 text-center text-xs text-slate-400 font-semibold">
                      No scope of work items added yet. Click &quot;Add Scope Item&quot; or run &quot;AI ESTIMATE SCAN&quot; to auto-generate standard multi-line procedural steps.
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  TECHNICIAN FIELD NOTES &amp; GROUND OVERRIDE REASONS
                </h2>
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
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setDiscrepancyJustifications(prev =>
                        isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
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
            className="w-full rounded-xl text-xs outline-none focus:border-[#1E3A8A] leading-relaxed text-slate-700 bg-white"
            style={{ ...inputStyle, padding: '12px' }}
          />
        </div>

        {/* ── Installation Notes & Constraints (Matches Reference Screenshot) ── */}
        <div style={sectionCard}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">INSTALLATION NOTES &amp; CONSTRAINTS</h2>
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
                  className="w-full resize-none rounded-xl text-xs outline-none focus:border-[#1E3A8A] leading-relaxed text-slate-700 bg-white"
                  style={{ ...inputStyle, padding: '10px 12px' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-8">
          <button onClick={onBack} className="px-6 py-3 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:text-slate-800 transition-colors">
            Back to Project
          </button>
          
          <div className="flex items-center gap-3">
            {showPrices && (
              <button
                onClick={() => setShowQuotationModal(true)}
                className="px-6 py-3 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View AA2000 Commercial Quotation
              </button>
            )}

            <button
              onClick={() => {
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
                localStorage.setItem(`aa2000_estimation_${project.id}`, JSON.stringify(estimationData));

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
              className="px-8 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95"
              style={{ background: '#1E3A8A' }}
            >
              Save Estimation
            </button>
          </div>
        </div>

        {/* ── AA2000 OFFICIAL COMMERCIAL SALES QUOTATION MODAL ── */}
        {showPrices && showQuotationModal && (
          <QuotationModal
            userRole={user?.role}
            project={project}
            aiQuotation={aiQuotation}
            consumables={consumables}
            manpower={manpower}
            fees={fees}
            scopeOfWorks={scopeOfWorks}
            quotHeader={quotHeader}
            setQuotHeader={setQuotHeader}
            quotDiscount={quotDiscount}
            setQuotDiscount={setQuotDiscount}
            showEditQuotation={showEditQuotation}
            setShowEditQuotation={setShowEditQuotation}
            onClose={() => setShowQuotationModal(false)}
          />
        )}

      </main>

      {/* AI Scan Modal */}
      {isAiEstimating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 text-center overflow-hidden relative">
            {/* Close Button */}
            <button
              onClick={() => setIsAiEstimating(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl opacity-40 animate-pulse" style={{ background: '#2563EB' }}></div>
            <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-30 animate-pulse" style={{ background: '#3B82F6' }}></div>

            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-slate-50 border border-slate-200 relative z-10">
              <svg className="w-8 h-8 animate-pulse text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>

            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider relative z-10">AA2000 CONNECT</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 relative z-10 text-blue-600">
              {hasFiles ? 'Mistral Vision Floor Plan Analysis' : 'AI Neural Estimation Scan'}
            </p>

            {aiError ? (
              <div className="my-6 text-left bg-red-50 border border-red-200 rounded-2xl p-4 relative z-10">
                <span className="text-[10px] font-black text-red-600 uppercase tracking-wider mb-1 block">Scan Failed</span>
                <p className="text-xs font-bold text-red-700 leading-relaxed mb-4">{aiError}</p>
                <button
                  onClick={() => { setAiError(null); setIsAiEstimating(false); }}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Dismiss & Close
                </button>
              </div>
            ) : (
              <>
                {hasFiles && (
                  <div className="mt-3 relative z-10 flex flex-wrap gap-1.5 justify-center">
                    {floorPlanPreviews.map((fp, idx) => (
                      <span key={idx} className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        {fp.type === 'pdf' ? <Document className="w-4 h-4" /> : <MagnifyingGlass className="w-4 h-4" />} {fp.name.length > 20 ? fp.name.slice(0, 18) + '…' : fp.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="my-6 text-left space-y-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-4 relative z-10">
                  {AI_STEPS.map((stepText, idx) => {
                    const isDone = aiStep > idx;
                    const isCurrent = aiStep === idx;
                    return (
                      <div key={idx} className="flex items-center gap-2.5 text-[11px]">
                        <span className="shrink-0 flex items-center justify-center">
                          {isDone ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : isCurrent ? (
                            <span className="h-2 w-2 rounded-full animate-ping bg-blue-600" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-200" />
                          )}
                        </span>
                        <span className={`font-bold transition-colors ${isDone ? 'text-slate-400' : isCurrent ? 'text-slate-800' : 'text-slate-300'}`}>
                          {stepText}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative z-10">
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-blue-600"
                    style={{
                      width: `${(aiStep / AI_STEPS.length) * 100}%`,
                    }}
                  />
                </div>

                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 relative z-10">
                  {aiStep < AI_STEPS.length
                    ? (hasFiles ? 'Mistral Vision processing your floor plan...' : 'Processing Neural Model Data...')
                    : 'Bill of quantities computed successfully'}
                </p>

                {aiStep >= AI_STEPS.length && (
                  <div className="mt-4 relative z-10">
                    <button
                      onClick={() => setIsAiEstimating(false)}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-md shadow-blue-500/20 cursor-pointer animate-fade-in"
                    >
                      View Estimation Results
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
