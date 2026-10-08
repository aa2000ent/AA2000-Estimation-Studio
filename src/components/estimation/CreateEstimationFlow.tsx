import { useEffect, useRef, useState } from 'react';
import {
  Folder,
  StatBuilding,
  SysShield,
  ChartBar,
  ArrowUpTray,
  Check,
  MagnifyingGlass,
  systemBadgeIcons,
} from '../../utils/Icons';
import type { SurveyFormData, SystemType } from './CreateSurveyForm';
import { SYSTEM_OPTIONS } from './CreateSurveyForm';
import { parseFile } from '../../services/fileParser';
import LeafletMap from '../utils/LeafletMap';
import {
  analyzeFloorPlan,
  analyzeEstimation,
  extractSectionRequirements,
} from '../../services/api/estimationFlow';
import type {
  EstimationAnalyzeResult,
  FloorPlanAnalyzeResult,
  FloorPlanProjectContext,
  FloorPlanSection,
  SectionRequirementsResult,
  SupplementalDocument,
} from '../../services/api/estimationFlow';
import {
  EstimationAnalysisResultPanel,
  FloorPlanAnalysisPanel,
  SectionRequirementsPanel,
} from './EstimationAiPanels';
import type { EstimationFlowAiContext } from '../../services/estimationWizardSnapshot';

interface Props {
  userRole?: string;
  /** Persists the estimation to the database; resolves with the save outcome. */
  onSave: (data: SurveyFormData, ai: EstimationFlowAiContext) => Promise<{ success: boolean; message?: string }>;
  onExit: () => void;
  initialCompanyName?: string;
  initialLocationName?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  initialClientName?: string;
  initialClientEmail?: string;
  initialClientContactNumber?: string;
  initialSystemTypes?: SystemType[];
  /** Full form prefill (e.g. reopening an existing project's data). */
  initialData?: SurveyFormData;
  isDark?: boolean;
}

type FlowMode = 'manual' | 'ai';

const MANUAL_STEPS = [
  'Project Information',
  'Site Information',
  'Project-Specific',
  'AI Analysis',
];

const AI_STEPS = [
  'Project Information',
  'Floor Plan Analysis',
  'Section Requirements',
];

const MAX_PLAN_FILES = 6;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ACCEPTED_PLAN =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp,application/pdf';

// Optional TOR / Proposal documents: parsed to text in the wizard and sent to
// every analysis endpoint as supplemental context for the AI.
const SUPP_ACCEPTED = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt';
const MAX_SUPP_DOCS = 4;
const MAX_SUPP_CHARS = 12000;

export const BUILDING_TYPES = [
  'Office', 'Office Building', 'Retail', 'Mall / Retail', 'Warehouse',
  'Warehouse / Logistics', 'School', 'School / University', 'Hospital',
  'Hospital / Medical', 'Residential', 'Residential / Condo',
  'Hotel / Hospitality', 'Government / BPO', 'Industrial',
  'Industrial / Factory', 'Parking Structure', 'Data Center', 'Other',
];

// Per-system configuration defaults (editable in the Project-Specific step).
// The manual flow edits them directly; the AI flow falls back to these, with
// equipment counts detected from the floor plan (API #1) taking precedence.
const SYSTEM_CONFIG_DEFAULTS = {
  cameraCount: '10',
  resolution: '5MP',
  environment: 'Both',
  fdasType: 'Addressable',
  smokeDetectors: '10',
  heatDetectors: '2',
  mcpCount: '2',
  sounders: '4',
  doorCount: '5',
  doorType: 'Wood',
  readerType: 'Proximity',
  lockType: 'Maglock',
  pirSensors: '8',
  doorContacts: '6',
  glassBreak: '4',
  outdoorSensors: '4',
  suppressionType: 'Sprinkler',
  zones: '2',
  cylinders: '2',
};

type SystemConfig = typeof SYSTEM_CONFIG_DEFAULTS;

// Non-core SystemType values mapped to API #3's OTHER bucket.
const OTHER_SYSTEM_TYPES: SystemType[] = [
  'DOOR_LOCK', 'EAS_SYSTEM', 'FIXED_ARM_ELEVATOR', 'INTERCOM_NURSE_CALL',
  'PABX_PAGING', 'PARKING_BARRIER', 'POS_SYSTEM', 'ROOM_ALERT', 'XRAY_SECURITY',
];

const OTHER_TYPE_MAP: Partial<Record<SystemType, string>> = {
  PARKING_BARRIER: 'Parking',
  INTERCOM_NURSE_CALL: 'Intercom',
  XRAY_SECURITY: 'Turnstile',
};

function num(value: string, fallback: number, min = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export default function CreateEstimationFlow({
  userRole: _userRole,
  onSave,
  onExit,
  initialCompanyName = '',
  initialLocationName = '',
  initialLatitude,
  initialLongitude,
  initialClientName = '',
  initialClientEmail = '',
  initialClientContactNumber = '',
  initialSystemTypes = [],
  initialData,
  isDark,
}: Props) {
  const dark =
    isDark ??
    (typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const [mode, setMode] = useState<FlowMode | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SurveyFormData>({
    // Explicit initial* props win only where the full prefill has no data.
    companyName: initialData?.companyName || String(initialCompanyName || ''),
    projectName: initialData?.projectName || '',
    clientEmail: initialData?.clientEmail || initialClientEmail,
    clientName: initialData?.clientName || initialClientName,
    clientContactNumber: initialData?.clientContactNumber || initialClientContactNumber,
    locationName: initialData?.locationName || initialLocationName,
    latitude: initialData?.latitude ?? initialLatitude ?? 14.5995,
    longitude: initialData?.longitude ?? initialLongitude ?? 120.9842,
    surveyScope: initialData?.surveyScope || '',
    systemTypes:
      initialData?.systemTypes?.length
        ? initialData.systemTypes
        : initialSystemTypes && initialSystemTypes.length > 0
          ? initialSystemTypes
          : [],
    buildingType: initialData?.buildingType || '',
    floors: initialData?.floors || '',
    buildingLength: initialData?.buildingLength || '',
    buildingWidth: initialData?.buildingWidth || '',
    floorHeight: initialData?.floorHeight || '',
    startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
  });
  const [isNewBuilding, setIsNewBuilding] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(SYSTEM_CONFIG_DEFAULTS);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Manual flow — API #3
  const [useAi, setUseAi] = useState<boolean | null>(null);
  const [estResult, setEstResult] = useState<EstimationAnalyzeResult | null>(null);
  const [estLoading, setEstLoading] = useState(false);
  const [estError, setEstError] = useState('');

  // AI-assisted flow — API #1
  const [planFiles, setPlanFiles] = useState<File[]>([]);
  const [planResult, setPlanResult] = useState<FloorPlanAnalyzeResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');

  // Optional TOR / Proposal documents — supplemental context for the AI in
  // both the manual and the AI-assisted flow (attached before running).
  const [suppDocs, setSuppDocs] = useState<SupplementalDocument[]>([]);
  const [suppParsing, setSuppParsing] = useState(false);
  const suppInputRef = useRef<HTMLInputElement>(null);

  // AI-assisted flow — API #2
  const [selectedSection, setSelectedSection] = useState<FloorPlanSection | null>(null);
  const [reqResult, setReqResult] = useState<SectionRequirementsResult | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const reqRanForRef = useRef<string | null>(null);

  useEffect(() => {
    setErrorMsg('');
  }, [step, mode]);

  const steps = mode === 'manual' ? MANUAL_STEPS : mode === 'ai' ? AI_STEPS : [];

  const update = (field: keyof SurveyFormData, value: string) => {
    let finalValue = value;
    if (field === 'clientContactNumber') {
      finalValue = value.replace(/\D/g, '').slice(0, 11);
    }
    setForm(prev => ({ ...prev, [field]: finalValue }));
  };

  const updateConfig = (field: keyof SystemConfig, value: string) => {
    setSystemConfig(prev => ({ ...prev, [field]: value }));
  };

  // Map pin → exact coordinates + reverse-geocoded address (LeafletMap/Nominatim).
  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng, locationName: address }));
  };

  const toggleSystemType = (type: SystemType) => {
    setForm(prev => ({
      ...prev,
      systemTypes: prev.systemTypes.includes(type)
        ? prev.systemTypes.filter(t => t !== type)
        : [...prev.systemTypes, type],
    }));
  };

  const validateStep = (s: number): string | null => {
    if (mode === 'manual') {
      if (s === 0) {
        if (!form.companyName.trim()) return 'Please enter the Company Name.';
        if (!form.projectName.trim()) return 'Please enter the Project Name.';
        return null;
      }
      if (s === 1) {
        if (!form.locationName.trim()) return 'Please enter the Location Name.';
        if (!form.buildingType) return 'Please select the Building Type.';
        if (!form.startDate) return 'Please select the Schedule Date.';
        return null;
      }
      if (s === 2 && form.systemTypes.length === 0) {
        return 'Please select at least one system type.';
      }
      return null;
    }
    if (mode === 'ai') {
      if (s === 0) {
        if (!form.companyName.trim()) return 'Please enter the Company Name.';
        if (!form.projectName.trim()) return 'Please enter the Project Name.';
        if (!form.locationName.trim()) return 'Please enter the Location Name.';
        if (!form.buildingType) return 'Please select the Building Type.';
        if (!form.startDate) return 'Please select the Schedule Date.';
        if (form.systemTypes.length === 0) return 'Please select at least one system type.';
        return null;
      }
      if (s === 1) {
        if (!planResult) return 'Analyze a floor plan before continuing.';
        return null;
      }
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(step);
    if (error) {
      setErrorMsg(error);
      return;
    }
    setStep(step + 1);
  };

  // -- Manual flow: build + call API #3 ------------------------------------

  const buildProjectContext = (): FloorPlanProjectContext => ({
    buildingType: form.buildingType || undefined,
    floors: form.floors === '' ? undefined : Number(form.floors),
    systemTypes: form.systemTypes,
  });

  const runEstimationAnalysis = async () => {
    if (estLoading) return;
    if (!form.buildingType) {
      setEstError('Building Type is required. Fill it in the Site Information step.');
      return;
    }
    setEstLoading(true);
    setEstError('');
    try {
      const cfg = systemConfig;
      const floorsRaw = Number(form.floors);
      const floors = Number.isFinite(floorsRaw) && floorsRaw > 0 ? floorsRaw : 1;
      const toNum = (v: string | number) => {
        const parsed = Number(v);
        return v === '' || !Number.isFinite(parsed) ? undefined : parsed;
      };
      const length = toNum(form.buildingLength);
      const width = toNum(form.buildingWidth);
      const height = toNum(form.floorHeight);
      // Floor-plan context (AI flow): the drawing's measured area fills in when
      // the manual dimensions are missing, and the extracted room count goes
      // into siteInfo so API #3 sees what API #1 found.
      const planSummary = planResult?.summary;
      const totalFloorArea =
        length && width
          ? length * width * Math.max(1, floors)
          : planSummary?.totalArea;
      // Detected equipment from the floor plan (API #1) — the AI flow never
      // visits the Project-Specific step, so its counts override the defaults.
      const detectedCoverage = (name: string) => {
        const coverage = planSummary?.systemsCoverage;
        if (!coverage) return undefined;
        return (
          coverage[name] ??
          coverage[name.toLowerCase()] ??
          Object.entries(coverage).find(
            ([key]) => key.toUpperCase().replace(/[^A-Z]/g, '') === name
          )?.[1]
        );
      };
      const systems: Record<string, Record<string, unknown>> = {
        CCTV: { enabled: false },
        FDAS: { enabled: false },
        ACCESS_CONTROL: { enabled: false },
        BURGLAR_ALARM: { enabled: false },
        FIRE_PROTECTION: { enabled: false },
        OTHER: { enabled: false },
      };
      const selected = form.systemTypes;

      if (selected.includes('CCTV')) {
        const detectedCameras = detectedCoverage('CCTV')?.cameraCount;
        systems.CCTV = {
          enabled: true,
          cameraCount:
            detectedCameras && detectedCameras > 0
              ? detectedCameras
              : num(cfg.cameraCount, 1, 1),
          resolution: cfg.resolution,
          environment: cfg.environment,
        };
      }
      if (selected.includes('FDAS')) {
        systems.FDAS = {
          enabled: true,
          systemType: cfg.fdasType,
          smokeDetectors: num(cfg.smokeDetectors, 0),
          heatDetectors: num(cfg.heatDetectors, 0),
          mcpCount: num(cfg.mcpCount, 0),
          sounders: num(cfg.sounders, 0),
        };
      }
      if (selected.includes('ACCESS_CONTROL')) {
        systems.ACCESS_CONTROL = {
          enabled: true,
          doorCount: num(cfg.doorCount, 1, 1),
          doorType: cfg.doorType,
          readerType: cfg.readerType,
          lockType: cfg.lockType,
        };
      }
      if (selected.includes('BURGLAR_ALARM')) {
        systems.BURGLAR_ALARM = {
          enabled: true,
          pirSensors: num(cfg.pirSensors, 0),
          doorContacts: num(cfg.doorContacts, 0),
          glassBreak: num(cfg.glassBreak, 0),
          outdoorSensors: num(cfg.outdoorSensors, 0),
        };
      }
      if (selected.includes('FIRE_PROTECTION')) {
        systems.FIRE_PROTECTION = {
          enabled: true,
          suppressionType: cfg.suppressionType,
          zones: num(cfg.zones, 1, 1),
          cylinders: num(cfg.cylinders, 1, 1),
        };
      }
      const otherSelected = OTHER_SYSTEM_TYPES.filter(t => selected.includes(t));
      if (otherSelected.length > 0) {
        const mapped = otherSelected
          .map(t => OTHER_TYPE_MAP[t])
          .find(Boolean);
        systems.OTHER = {
          enabled: true,
          otherSystemType: mapped || 'Other Systems',
          description: otherSelected
            .map(t => SYSTEM_OPTIONS.find(o => o.type === t)?.label || t)
            .join(', '),
          quantity: otherSelected.length,
          powerRequired: false,
        };
      }

      const result = await analyzeEstimation({
        siteInfo: {
          buildingType: form.buildingType,
          floors: Number.isFinite(floors) ? floors : undefined,
          buildingLength: length,
          buildingWidth: width,
          floorHeight: height,
          totalFloorArea,
          roomsCount: planSummary?.totalRooms,
          locationName: form.locationName,
          latitude: Number(form.latitude) || 0,
          longitude: Number(form.longitude) || 0,
          surveyScope: form.surveyScope || undefined,
          scheduleDate: form.startDate,
          isNewBuilding,
        },
        systems: systems as never,
        supplementalDocuments: suppDocs.length > 0 ? suppDocs : undefined,
        clientContext: {
          companyName: form.companyName,
          projectName: form.projectName,
          clientName: form.clientName,
          clientEmail: form.clientEmail,
          clientContactNumber: form.clientContactNumber,
          budgetTier: 'standard',
          prioritySystems: form.systemTypes.slice(0, 3),
          existingInfrastructure: false,
        },
        analysisOptions: {
          includeLaborBreakdown: true,
          includeMaterialAlternates: true,
          includePhaseSchedule: true,
          confidenceThreshold: 50,
          currency: 'PHP',
          market: 'philippines',
        },
      });
      setEstResult(result);
    } catch (error) {
      setEstError(error instanceof Error ? error.message : 'Estimation analysis failed.');
    } finally {
      setEstLoading(false);
    }
  };

  // -- AI flow: API #1 floor plan analysis ---------------------------------

  const addPlanFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...planFiles];
    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_PLAN_FILES) break;
      if (file.size > MAX_FILE_BYTES) {
        setErrorMsg(`"${file.name}" exceeds the 12 MB file limit.`);
        continue;
      }
      if (!next.some(f => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    setPlanFiles(next);
    // New files invalidate any previous analysis/selection.
    setPlanResult(null);
    setSelectedSection(null);
    setReqResult(null);
    reqRanForRef.current = null;
    setPlanError('');
    setReqError('');
  };

  const removePlanFile = (index: number) => {
    setPlanFiles(prev => prev.filter((_, i) => i !== index));
    setPlanResult(null);
    setSelectedSection(null);
    setReqResult(null);
    reqRanForRef.current = null;
  };

  // -- Shared: optional TOR / Proposal documents (supplemental AI context) --

  const addSuppFiles = async (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const files = Array.from(incoming);
    if (files.length === 0) return;
    setSuppParsing(true);
    setErrorMsg('');
    try {
      const next = [...suppDocs];
      for (const file of files) {
        if (next.length >= MAX_SUPP_DOCS) {
          setErrorMsg(`Attach up to ${MAX_SUPP_DOCS} TOR / Proposal files.`);
          break;
        }
        if (next.some(doc => doc.name === file.name)) continue;
        try {
          const parsed = await parseFile(file);
          const content = (parsed.content || '').trim();
          if (!content || content.startsWith('[Unsupported file type')) {
            setErrorMsg(`"${file.name}" has no readable text.`);
            continue;
          }
          next.push({ name: file.name, content: content.slice(0, MAX_SUPP_CHARS) });
        } catch {
          setErrorMsg(`Could not read "${file.name}".`);
        }
      }
      setSuppDocs(next);
    } finally {
      setSuppParsing(false);
    }
  };

  const removeSuppDoc = (index: number) => {
    setSuppDocs(prev => prev.filter((_, i) => i !== index));
  };

  // Shared card rendered in both flows' AI steps; the parsed text is sent as
  // `supplementalDocuments` to APIs #1, #2 and #3. In the AI flow it renders
  // in the Section Requirements step (after section selection), so extraction
  // runs with the attached TOR/Proposal as context.
  const suppDocsCard = () => (
    <div
      className="mt-4 rounded-2xl border-2 border-dashed p-4"
      style={{
        borderColor: suppDocs.length > 0
          ? (dark ? '#3B82F6' : '#93C5FD')
          : (dark ? '#1E293B' : '#E2E8F0'),
        background: dark ? '#0F172A' : '#F8FAFC',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black" style={{ color: dark ? '#E2E8F0' : '#0F172A' }}>
            TOR / Proposal (optional)
          </p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
            Attach the client's Terms of Reference or your proposal — the AI uses it as
            supplemental context for its analysis (requirements, quantities, brands, constraints).
            {' '}Attach before running the analysis · PDF, Word, Excel or text · up to {MAX_SUPP_DOCS} files.
            {suppParsing ? ' Reading file…' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => suppInputRef.current?.click()}
          disabled={suppParsing}
          className="px-3 py-2 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer disabled:cursor-wait"
          style={{ background: dark ? '#1D4ED8' : '#2563EB', color: '#FFFFFF' }}
        >
          <ArrowUpTray className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          {suppDocs.length > 0 ? 'Add file' : 'Attach file'}
        </button>
      </div>

      {suppDocs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suppDocs.map((doc, index) => (
            <span
              key={`${doc.name}-${index}`}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold max-w-full"
              style={{
                background: dark ? 'rgba(37,99,235,0.15)' : '#EFF6FF',
                color: dark ? '#93C5FD' : '#1D4ED8',
                border: `1px solid ${dark ? '#1E3A8A' : '#BFDBFE'}`,
              }}
            >
              <span className="truncate">{doc.name}</span>
              <button
                type="button"
                onClick={() => removeSuppDoc(index)}
                className="text-red-500 font-black cursor-pointer shrink-0"
                title={`Remove ${doc.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={suppInputRef}
        type="file"
        multiple
        accept={SUPP_ACCEPTED}
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) void addSuppFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );

  const runFloorPlanAnalysis = async () => {
    if (planLoading) return;
    if (planFiles.length === 0) {
      setErrorMsg('Attach at least one floor plan file.');
      return;
    }
    setPlanLoading(true);
    setPlanError('');
    try {
      const result = await analyzeFloorPlan({
        files: planFiles,
        projectContext: buildProjectContext(),
        supplementalDocuments: suppDocs.length > 0 ? suppDocs : undefined,
        analysisOptions: {
          extractDimensions: true,
          extractAnnotations: true,
          detectSystems: true,
          classifyRooms: true,
          outputFormat: 'structured',
          coordinateSystem: 'meters',
        },
      });
      setPlanResult(result);
      setSelectedSection(null);
      setReqResult(null);
      reqRanForRef.current = null;
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Floor plan analysis failed.');
    } finally {
      setPlanLoading(false);
    }
  };

  const selectSection = (section: FloorPlanSection) => {
    if (reqLoading) return;
    if (selectedSection?.sectionId === section.sectionId) return;
    setSelectedSection(section);
    setReqResult(null);
    setReqError('');
    reqRanForRef.current = null;
  };

  // -- AI flow: API #2 section requirements --------------------------------

  const runSectionRequirements = async (section: FloorPlanSection) => {
    if (reqLoading) return;
    if (reqRanForRef.current === section.sectionId && reqResult) return;
    reqRanForRef.current = section.sectionId;
    setReqLoading(true);
    setReqError('');
    try {
      const result = await extractSectionRequirements({
        section,
        projectContext: buildProjectContext(),
        supplementalDocuments: suppDocs.length > 0 ? suppDocs : undefined,
        analysisOptions: {
          includeCatalogMatches: true,
          includeLaborEstimates: true,
          includeMaterialAlternates: true,
          includeCodeReferences: true,
          market: 'philippines',
          currency: 'PHP',
        },
      });
      setReqResult(result);
    } catch (error) {
      reqRanForRef.current = null;
      setReqError(
        error instanceof Error ? error.message : 'Section requirements extraction failed.'
      );
    } finally {
      setReqLoading(false);
    }
  };

  // Extraction starts from the "Extract Section Requirements" button below —
  // it must not auto-run on step entry, so the user can attach TOR/Proposal
  // documents first (the upload card renders above the button).

  // Chain the full estimation analysis (API #3) once section requirements (#2)
  // land, so the AI flow ends with a complete project BOQ (materials, fees,
  // constraints, scope) instead of section-level rows only. The standalone
  // button in the step covers users who skip section extraction entirely.
  useEffect(() => {
    if (mode !== 'ai' || !reqResult) return;
    if (estResult || estLoading || estError) return;
    void runEstimationAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reqResult]);

  // -- Shared styling -------------------------------------------------------

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    background: dark ? '#162032' : '#FFFFFF',
    border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
    color: dark ? '#F8FAFC' : '#1E293B',
    fontSize: '13px',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#94A3B8',
    marginBottom: '6px',
  };

  const sectionStyle: React.CSSProperties = {
    background: dark ? '#131B2E' : '#FFFFFF',
    border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
    borderRadius: '24px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: dark ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
  };

  const cardHeading = (icon: React.ReactNode, text: string) => (
    <p
      className="text-[10px] font-bold uppercase tracking-wider mb-4"
      style={{ color: dark ? '#60A5FA' : '#1D4ED8' }}
    >
      {icon}
      {text}
    </p>
  );

  const backBtnStyle: React.CSSProperties = {
    background: dark ? '#131B2E' : '#FFFFFF',
    color: dark ? '#CBD5E1' : '#64748B',
    border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
  };

  const Spinner = () => (
    <span
      className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"
      aria-hidden
    />
  );

  const loadingNote = (text: string) => (
    <div
      className="flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-bold mb-4"
      style={{
        background: dark ? 'rgba(37,99,235,0.15)' : 'rgba(30,58,138,0.05)',
        color: dark ? '#93C5FD' : '#1E3A8A',
        border: `1px solid ${dark ? 'rgba(37,99,235,0.35)' : 'rgba(30,58,138,0.12)'}`,
      }}
    >
      <span
        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        aria-hidden
      />
      {text}
    </div>
  );

  const errorBanner = (message: string) => (
    <div
      className="p-3 mb-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border border-red-100 dark:border-red-900/50"
      role="alert"
    >
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span>{message}</span>
    </div>
  );

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    required = false,
    type = 'text'
  ) => (
    <div>
      <label style={labelStyle}>{label}{required ? ' *' : ''}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );

  const selectField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: string[],
    placeholder: string,
    required = false
  ) => (
    <div>
      <label style={labelStyle}>{label}{required ? ' *' : ''}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: 'pointer' }}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  const systemChips = () => (
    <div className="grid grid-cols-2 gap-3">
      {SYSTEM_OPTIONS.map(opt => {
        const selected = form.systemTypes.includes(opt.type);
        const IconComp = systemBadgeIcons[opt.type];
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => toggleSystemType(opt.type)}
            className="flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer"
            style={{
              borderColor: selected ? (dark ? '#3B82F6' : '#1D4ED8') : (dark ? '#1E293B' : '#E2E8F0'),
              background: selected
                ? (dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF')
                : (dark ? '#162032' : '#FAFAFA'),
            }}
          >
            <span
              className="text-2xl"
              style={{ color: selected ? (dark ? '#93C5FD' : '#1D4ED8') : (dark ? '#475569' : '#94A3B8') }}
            >
              {IconComp ? <IconComp className="w-5 h-5" /> : null}
            </span>
            <div className="flex-1">
              <p
                className="text-xs font-black"
                style={{ color: selected ? (dark ? '#93C5FD' : '#1D4ED8') : (dark ? '#E2E8F0' : '#475569') }}
              >
                {opt.label}
              </p>
              {selected && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-1"
                  style={{ background: dark ? '#2563EB' : '#1D4ED8', color: '#fff' }}
                >
                  SELECTED <Check className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  // -- Render helpers for step content -------------------------------------

  const projectInfoStep = () => (
    <div style={sectionStyle}>
      {cardHeading(<StatBuilding className="w-4 h-4 inline mr-1.5" />, 'PROJECT INFORMATION')}
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {field('Company Name', form.companyName, v => update('companyName', v), 'e.g. ABC Corporation Philippines', true)}
          {field('Project Name', form.projectName, v => update('projectName', v), 'e.g. Headquarters CCTV Install', true)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Client Contact Name (Optional)', form.clientName, v => update('clientName', v), 'e.g. Juan Dela Cruz')}
          {field('Client Contact Number (Optional)', form.clientContactNumber, v => update('clientContactNumber', v), 'e.g. 09171234567')}
          <div className="col-span-2">
            {field('Client Email Address (Optional)', form.clientEmail, v => update('clientEmail', v), 'e.g. client@email.com')}
          </div>
        </div>

        {mode === 'ai' && (
          <div>
            <label style={labelStyle}>
              Project Location * — click the map to pin the exact site; the address fills in automatically
            </label>
            <LeafletMap
              onLocationSelect={handleLocationSelect}
              initialLat={Number(form.latitude) || 14.5995}
              initialLng={Number(form.longitude) || 120.9842}
              height="240px"
            />
            <div className="grid grid-cols-3 gap-3 mt-3">
              {field('Location Name / Area (auto-filled from map)', form.locationName, v => update('locationName', v), 'Pin the map or search to fill', true)}
              {selectField('Building Type', form.buildingType, v => update('buildingType', v), BUILDING_TYPES, 'Select building type', true)}
              {field('Survey Schedule Date', form.startDate, v => update('startDate', v), '', true, 'date')}
            </div>
          </div>
        )}

        {mode === 'ai' && (
          <div>
            <label style={labelStyle}>System Types * (used as AI context)</label>
            {systemChips()}
          </div>
        )}
      </div>
    </div>
  );

  const siteInfoStep = () => (
    <div style={sectionStyle}>
      {cardHeading(<MagnifyingGlass className="w-4 h-4 inline mr-1.5" />, 'SITE INFORMATION')}
      <div className="space-y-6">
        <div>
          <label style={labelStyle}>
            Project Location * — click the map to pin the exact site; the address fills in automatically
          </label>
          <LeafletMap
            onLocationSelect={handleLocationSelect}
            initialLat={Number(form.latitude) || 14.5995}
            initialLng={Number(form.longitude) || 120.9842}
            height="240px"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field('Location Name / Area (auto-filled from map)', form.locationName, v => update('locationName', v), 'Pin the map or search to fill', true)}
          {selectField('Building Type', form.buildingType, v => update('buildingType', v), BUILDING_TYPES, 'Select building type', true)}
          {field('Survey Schedule Date', form.startDate, v => update('startDate', v), '', true, 'date')}
          <div>
            <label style={labelStyle}>Building Status</label>
            <select
              value={isNewBuilding ? 'new' : 'existing'}
              onChange={e => setIsNewBuilding(e.target.value === 'new')}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="existing">Existing building</option>
              <option value="new">New building</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {field('Floors', form.floors === '' ? '' : String(form.floors), v => update('floors', v), 'e.g. 10', false, 'number')}
          {field('Building Length (m)', form.buildingLength === '' ? '' : String(form.buildingLength), v => update('buildingLength', v), 'e.g. 50', false, 'number')}
          {field('Building Width (m)', form.buildingWidth === '' ? '' : String(form.buildingWidth), v => update('buildingWidth', v), 'e.g. 30', false, 'number')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field('Floor Height (m)', form.floorHeight === '' ? '' : String(form.floorHeight), v => update('floorHeight', v), 'e.g. 3', false, 'number')}
          <div>
            <label style={labelStyle}>Latitude (set by map)</label>
            <input
              type="text"
              value={Number(form.latitude).toFixed(6)}
              readOnly
              style={{ ...inputStyle, opacity: 0.7, cursor: 'default' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Longitude (set by map)</label>
            <input
              type="text"
              value={Number(form.longitude).toFixed(6)}
              readOnly
              style={{ ...inputStyle, opacity: 0.7, cursor: 'default' }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Survey / Installation Notes (optional)</label>
          <textarea
            value={form.surveyScope}
            onChange={e => update('surveyScope', e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'none' }}
            placeholder="Any specific requirements, wiring obstacles, special zones to cover, client preferences..."
          />
        </div>
      </div>
    </div>
  );

  const projectSpecificStep = () => (
    <div style={sectionStyle}>
      {cardHeading(<SysShield className="w-4 h-4 inline mr-1.5" />, 'PROJECT-SPECIFIC INFORMATION')}
      <p className="text-xs font-semibold mb-5" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
        Select all systems that apply — the AI will generate the correct equipment list for each.
      </p>
      {systemChips()}

      {form.systemTypes.includes('CCTV') && (
        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}` }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dark ? '#60A5FA' : '#1D4ED8' }}>
            System configuration estimates (used by the AI analysis)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {field('Camera Count', systemConfig.cameraCount, v => updateConfig('cameraCount', v), 'e.g. 10', false, 'number')}
            <div>
              <label style={labelStyle}>Resolution</label>
              <select
                value={systemConfig.resolution}
                onChange={e => updateConfig('resolution', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['2MP', '5MP', '8MP', '12MP'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Environment</label>
              <select
                value={systemConfig.environment}
                onChange={e => updateConfig('environment', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['Indoor', 'Outdoor', 'Both'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {form.systemTypes.includes('FDAS') && (
        <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}` }}>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label style={labelStyle}>FDAS Type</label>
              <select
                value={systemConfig.fdasType}
                onChange={e => updateConfig('fdasType', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['Conventional', 'Addressable', 'Wireless'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            {field('Smoke Detectors', systemConfig.smokeDetectors, v => updateConfig('smokeDetectors', v), 'e.g. 10', false, 'number')}
            {field('Heat Detectors', systemConfig.heatDetectors, v => updateConfig('heatDetectors', v), 'e.g. 2', false, 'number')}
            {field('Sounders', systemConfig.sounders, v => updateConfig('sounders', v), 'e.g. 4', false, 'number')}
          </div>
        </div>
      )}

      {form.systemTypes.includes('ACCESS_CONTROL') && (
        <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}` }}>
          <div className="grid grid-cols-4 gap-3">
            {field('Door Count', systemConfig.doorCount, v => updateConfig('doorCount', v), 'e.g. 5', false, 'number')}
            <div>
              <label style={labelStyle}>Reader Type</label>
              <select
                value={systemConfig.readerType}
                onChange={e => updateConfig('readerType', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['Proximity', 'Biometric', 'Keypad', 'Mobile'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lock Type</label>
              <select
                value={systemConfig.lockType}
                onChange={e => updateConfig('lockType', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['Maglock', 'Strike', 'Cable'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Door Type</label>
              <select
                value={systemConfig.doorType}
                onChange={e => updateConfig('doorType', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['Wood', 'Metal', 'Glass', 'Fire Rated'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {form.systemTypes.includes('BURGLAR_ALARM') && (
        <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}` }}>
          <div className="grid grid-cols-4 gap-3">
            {field('PIR Sensors', systemConfig.pirSensors, v => updateConfig('pirSensors', v), 'e.g. 8', false, 'number')}
            {field('Door Contacts', systemConfig.doorContacts, v => updateConfig('doorContacts', v), 'e.g. 6', false, 'number')}
            {field('Glass Break', systemConfig.glassBreak, v => updateConfig('glassBreak', v), 'e.g. 4', false, 'number')}
            {field('Outdoor Sensors', systemConfig.outdoorSensors, v => updateConfig('outdoorSensors', v), 'e.g. 4', false, 'number')}
          </div>
        </div>
      )}

      {form.systemTypes.includes('FIRE_PROTECTION') && (
        <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}` }}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>Suppression Type</label>
              <select
                value={systemConfig.suppressionType}
                onChange={e => updateConfig('suppressionType', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['Sprinkler', 'FM200', 'Novec 1230', 'CO2', 'Foam'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            {field('Zones', systemConfig.zones, v => updateConfig('zones', v), 'e.g. 2', false, 'number')}
            {field('Cylinders', systemConfig.cylinders, v => updateConfig('cylinders', v), 'e.g. 2', false, 'number')}
          </div>
        </div>
      )}
    </div>
  );

  const manualAiStep = () => (
    <div style={sectionStyle}>
      {cardHeading(<ChartBar className="w-4 h-4 inline mr-1.5" />, 'AI ANALYSIS')}
      <p className="text-xs font-semibold mb-5" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
        Let the AI analyse the site and system configuration to recommend manpower,
        labor, materials, and costs — or skip and review your inputs directly.
      </p>

      {suppDocsCard()}

      <div className="grid grid-cols-2 gap-3 mb-5 mt-5">
        <button
          type="button"
          onClick={() => {
            setUseAi(true);
            if (!estResult && !estError && !estLoading) void runEstimationAnalysis();
          }}
          className="p-4 rounded-2xl border-2 text-left transition-all cursor-pointer"
          style={{
            borderColor: useAi === true ? (dark ? '#3B82F6' : '#1D4ED8') : (dark ? '#1E293B' : '#E2E8F0'),
            background: useAi === true
              ? (dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF')
              : (dark ? '#162032' : '#FAFAFA'),
          }}
        >
          <p className="text-sm font-black" style={{ color: useAi === true ? (dark ? '#93C5FD' : '#1D4ED8') : (dark ? '#E2E8F0' : '#475569') }}>
            Yes — use AI analysis
          </p>
          <p className="text-[11px] mt-1" style={{ color: dark ? '#94A3B8' : '#64748B' }}>
            Calls the estimation AI and extracts requirements, manpower, and costs.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setUseAi(false)}
          className="p-4 rounded-2xl border-2 text-left transition-all cursor-pointer"
          style={{
            borderColor: useAi === false ? (dark ? '#3B82F6' : '#1D4ED8') : (dark ? '#1E293B' : '#E2E8F0'),
            background: useAi === false
              ? (dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF')
              : (dark ? '#162032' : '#FAFAFA'),
          }}
        >
          <p className="text-sm font-black" style={{ color: useAi === false ? (dark ? '#93C5FD' : '#1D4ED8') : (dark ? '#E2E8F0' : '#475569') }}>
            No — proceed without AI
          </p>
          <p className="text-[11px] mt-1" style={{ color: dark ? '#94A3B8' : '#64748B' }}>
            Continue to review using the information you entered.
          </p>
        </button>
      </div>

      {useAi === true && estLoading && loadingNote('Analyzing site and system configuration… this can take up to 2 minutes.')}
      {useAi === true && estError && errorBanner(estError)}
      {useAi === true && estError && !estLoading && (
        <button
          type="button"
          onClick={() => runEstimationAnalysis()}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white mb-4 cursor-pointer"
          style={{ background: '#1E3A8A' }}
        >
          Retry Analysis
        </button>
      )}
      {useAi === true && estResult && (
        <EstimationAnalysisResultPanel result={estResult} isDark={dark} />
      )}
      {useAi === false && (
        <div
          className="p-4 rounded-xl text-xs font-semibold"
          style={{
            background: dark ? '#162032' : '#F8FAFC',
            border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
            color: dark ? '#94A3B8' : '#64748B',
          }}
        >
          Proceeding without AI — you can still review and save the project details below.
        </div>
      )}
      {useAi === null && (
        <div
          className="p-4 rounded-xl text-xs font-semibold"
          style={{
            background: dark ? '#162032' : '#F8FAFC',
            border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
            color: dark ? '#94A3B8' : '#64748B',
          }}
        >
          Choose an option above to continue.
        </div>
      )}
    </div>
  );

  const floorPlanStep = () => (
    <div style={sectionStyle}>
      {cardHeading(<ArrowUpTray className="w-4 h-4 inline mr-1.5" />, 'UPLOAD FLOOR PLAN')}

      <label
        className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all"
        style={{
          borderColor: dark ? '#334155' : '#CBD5E1',
          background: dark ? '#0F172A' : '#F8FAFC',
        }}
      >
        <ArrowUpTray className="w-7 h-7" />
        <span className="text-xs font-bold" style={{ color: dark ? '#94A3B8' : '#64748B' }}>
          Click to attach floor plan files (PDF, PNG, JPG — max {MAX_PLAN_FILES}, 12 MB each)
        </span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_PLAN}
          className="hidden"
          onChange={e => {
            addPlanFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {planFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {planFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg text-xs"
              style={{
                background: dark ? '#162032' : '#F8FAFC',
                border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
              }}
            >
              <span className="font-bold truncate" style={{ color: dark ? '#E2E8F0' : '#1E293B' }}>
                {file.name}
                <span className="font-semibold ml-2" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </span>
              <button
                type="button"
                onClick={() => removePlanFile(index)}
                className="text-red-500 font-bold shrink-0 cursor-pointer"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => runFloorPlanAnalysis()}
        disabled={planLoading}
        className="mt-4 px-6 py-3 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 cursor-pointer disabled:cursor-wait"
        style={{ background: planLoading ? '#475569' : '#1E3A8A' }}
      >
        {planLoading ? <Spinner /> : <MagnifyingGlass className="w-4 h-4" />}
        {planLoading ? 'Analyzing…' : 'Analyze Floor Plan'}
      </button>

      {planLoading && loadingNote('Reading the floor plan and extracting sections… this can take up to 2 minutes.')}
      {planError && errorBanner(planError)}

      {planResult && (
        <div className="mt-6">
          <FloorPlanAnalysisPanel
            result={planResult}
            isDark={dark}
            selectedSectionId={selectedSection?.sectionId ?? null}
            onSelectSection={selectSection}
          />
          <p className="text-[11px] font-bold mt-3" style={{ color: dark ? '#93C5FD' : '#1D4ED8' }}>
            {selectedSection
              ? `Selected: ${selectedSection.label || selectedSection.sectionId} — continue to extract its requirements.`
              : 'Click a section card to select it.'}
          </p>
        </div>
      )}
    </div>
  );

  const sectionRequirementsStep = () => (
    <div style={sectionStyle}>
      {cardHeading(<SysShield className="w-4 h-4 inline mr-1.5" />, 'SECTION REQUIREMENTS')}

      {selectedSection ? (
        <div
          className="p-3.5 rounded-xl mb-4 text-xs"
          style={{
            background: dark ? '#162032' : '#F8FAFC',
            border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
          }}
        >
          <p className="font-black" style={{ color: dark ? '#F8FAFC' : '#1E293B' }}>
            {selectedSection.label || selectedSection.sectionId}
          </p>
          <p className="font-semibold mt-0.5" style={{ color: dark ? '#94A3B8' : '#64748B' }}>
            {selectedSection.type}
            {selectedSection.subType ? ` / ${selectedSection.subType}` : ''}
            {selectedSection.area !== undefined
              ? ` · ${selectedSection.area} ${selectedSection.unit || 'sqm'}`
              : ''}
          </p>
        </div>
      ) : (
        errorBanner('No section selected. Go back and select a section from the floor plan analysis.')
      )}

      {suppDocsCard()}

      {reqLoading && loadingNote('Extracting system requirements for this section…')}
      {reqError && errorBanner(reqError)}
      {reqError && !reqLoading && selectedSection && (
        <button
          type="button"
          onClick={() => runSectionRequirements(selectedSection)}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white mb-4 cursor-pointer"
          style={{ background: '#1E3A8A' }}
        >
          Retry Extraction
        </button>
      )}
      {reqResult && <SectionRequirementsPanel result={reqResult} isDark={dark} />}
      {!reqResult && !reqLoading && !reqError && selectedSection && (
        <button
          type="button"
          onClick={() => runSectionRequirements(selectedSection)}
          className="px-6 py-3 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 cursor-pointer"
          style={{ background: '#1E3A8A' }}
        >
          <MagnifyingGlass className="w-4 h-4" />
          Extract Section Requirements
        </button>
      )}

      {/* Full estimation analysis (API #3) — runs automatically after the
          section requirements succeed, or on demand when they were skipped. */}
      {!reqResult && !estResult && !estLoading && !estError && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => runEstimationAnalysis()}
            className="px-6 py-3 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 cursor-pointer"
            style={{ background: '#0F766E' }}
          >
            <ChartBar className="w-4 h-4" />
            Generate AI Estimation
          </button>
          <p className="text-[11px] font-semibold mt-2" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
            Runs the full estimation AI on the project details and floor plan — materials, manpower, fees and scope of work.
          </p>
        </div>
      )}
      {estLoading && loadingNote('Analyzing site & systems for the full estimation… this can take up to 2 minutes.')}
      {estError && errorBanner(estError)}
      {estError && !estLoading && (
        <button
          type="button"
          onClick={() => runEstimationAnalysis()}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white mb-4 cursor-pointer"
          style={{ background: '#1E3A8A' }}
        >
          Retry Estimation Analysis
        </button>
      )}
      {estResult && <EstimationAnalysisResultPanel result={estResult} isDark={dark} />}
    </div>
  );

  const reviewNotice =
    mode === 'manual' && estResult ? (
      <div
        className="p-3 rounded-xl text-[11px] font-bold"
        style={{
          background: dark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
          color: dark ? '#6EE7B7' : '#047857',
          border: `1px solid ${dark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`,
        }}
      >
        <Check className="w-3.5 h-3.5 inline mr-1" />
        AI analysis completed — {estResult.manpower?.length || 0} manpower roles,{' '}
        {estResult.materials?.length || 0} material categories.
      </div>
    ) : mode === 'ai' && reqResult ? (
      <div
        className="p-3 rounded-xl text-[11px] font-bold"
        style={{
          background: dark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
          color: dark ? '#6EE7B7' : '#047857',
          border: `1px solid ${dark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`,
        }}
      >
        <Check className="w-3.5 h-3.5 inline mr-1" />
        Section requirements extracted for “{reqResult.sectionLabel || reqResult.sectionId}”.
      </div>
    ) : null;

  const reviewStep = () =>
    reviewNotice ? (
      <div style={sectionStyle}>
        {cardHeading(<Check className="w-4 h-4 inline mr-1.5" />, 'REVIEW & SAVE')}
        {reviewNotice}
      </div>
    ) : null;

  // -- Mode chooser ---------------------------------------------------------

  if (!mode) {
    return (
      <div className="min-h-screen flex flex-col transition-colors duration-200" style={{ background: dark ? '#0B0F19' : '#F8FAFC' }}>
        <header
          className="sticky top-0 z-40 px-6 py-4 border-b shadow-sm"
          style={{
            background: dark ? '#0D1527' : 'linear-gradient(to right, #FFFFFF, #EFF6FF)',
            borderColor: dark ? '#1E293B' : '#E2E8F0',
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#1E3A8A' }}>
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black" style={{ color: dark ? '#F8FAFC' : '#1E293B' }}>
                Create Estimation Project
              </h2>
              <p className="text-[10px] font-bold" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
                Choose how you want to create this project
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center py-10 px-6">
          <div className="max-w-3xl w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setMode('manual');
                  setStep(0);
                }}
                className="p-6 rounded-3xl border-2 text-left transition-all cursor-pointer hover:-translate-y-0.5"
                style={{
                  borderColor: dark ? '#1E293B' : '#E2E8F0',
                  background: dark ? '#131B2E' : '#FFFFFF',
                }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF' }}>
                  <StatBuilding className="w-6 h-6" style={{ color: dark ? '#93C5FD' : '#1D4ED8' }} />
                </div>
                <p className="text-sm font-black mb-1.5" style={{ color: dark ? '#F8FAFC' : '#1E293B' }}>
                  Manual Estimation
                </p>
                <p className="text-xs leading-relaxed" style={{ color: dark ? '#94A3B8' : '#64748B' }}>
                  Enter project, site, and system information step by step — then optionally
                  let the AI analyse it and extract requirements, manpower, and costs.
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-black"
                  style={{ color: dark ? '#93C5FD' : '#1D4ED8' }}
                >
                  Start manual flow <ChartBar className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('ai');
                  setStep(0);
                }}
                className="p-6 rounded-3xl border-2 text-left transition-all cursor-pointer hover:-translate-y-0.5"
                style={{
                  borderColor: dark ? '#1E293B' : '#E2E8F0',
                  background: dark ? '#131B2E' : '#FFFFFF',
                }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF' }}>
                  <ArrowUpTray className="w-6 h-6" style={{ color: dark ? '#93C5FD' : '#1D4ED8' }} />
                </div>
                <p className="text-sm font-black mb-1.5" style={{ color: dark ? '#F8FAFC' : '#1E293B' }}>
                  AI-Assisted Estimation
                </p>
                <p className="text-xs leading-relaxed" style={{ color: dark ? '#94A3B8' : '#64748B' }}>
                  Upload a floor plan — the AI extracts sections, then pull detailed
                  system requirements for any section you select.
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-black"
                  style={{ color: dark ? '#93C5FD' : '#1D4ED8' }}
                >
                  Start AI flow <ArrowUpTray className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onExit}
                className="px-6 py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                style={backBtnStyle}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -- Wizard ---------------------------------------------------------------

  const isLastStep = step === steps.length - 1;

  const handleSave = async () => {
    if (mode === 'manual' && useAi === null) {
      setErrorMsg('Choose whether to use AI analysis before saving.');
      setStep(3);
      return;
    }
    if (form.systemTypes.length === 0) {
      setErrorMsg('Please select at least one system type.');
      if (mode === 'manual') setStep(2);
      return;
    }

    if (planLoading || reqLoading || estLoading) {
      setErrorMsg('The AI analysis is still running — wait for it to finish before saving.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      const ai: EstimationFlowAiContext = {
        mode: mode === 'ai' ? 'ai' : 'manual',
        // API #3 result drives the saved rows in both flows when it ran:
        // manual (Yes — use AI) and the AI-assisted flow (chained after #2).
        estimation: estResult && (mode === 'ai' || useAi) ? estResult : null,
        floorPlan: mode === 'ai' ? planResult : null,
        selectedSection: mode === 'ai' ? selectedSection : null,
        sectionRequirements: mode === 'ai' ? reqResult : null,
      };
      const result = await onSave(form, ai);
      if (!result.success) {
        setErrorMsg(
          result.message
            ? `Could not save the estimation: ${result.message}`
            : 'Could not save the estimation to the database. Please try again.'
        );
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? `Could not save the estimation: ${error.message}`
          : 'Could not save the estimation to the database. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200" style={{ background: dark ? '#0B0F19' : '#F8FAFC' }}>
      <header
        className="sticky top-0 z-40 px-6 py-3 border-b shadow-sm transition-colors duration-200"
        style={{
          background: dark ? '#0D1527' : 'linear-gradient(to right, #FFFFFF, #EFF6FF)',
          borderColor: dark ? '#1E293B' : '#E2E8F0',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#1E3A8A' }}>
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black" style={{ color: dark ? '#F8FAFC' : '#1E293B' }}>
                Create Estimation Project
                <span
                  className="ml-2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase align-middle"
                  style={{
                    background: dark ? 'rgba(37,99,235,0.2)' : 'rgba(30,58,138,0.08)',
                    color: dark ? '#93C5FD' : '#1E3A8A',
                  }}
                >
                  {mode === 'manual' ? 'Manual' : 'AI-Assisted'}
                </span>
              </h2>
              <p className="text-[10px] font-bold" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
                Initialize a new client survey site mapping
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode(null);
                setStep(0);
              }}
              className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default"
              style={backBtnStyle}
              disabled={saving}
            >
              Switch flow
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {steps.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
                style={
                  i === step
                    ? {
                        background: dark ? 'rgba(37,99,235,0.2)' : 'rgba(30,58,138,0.06)',
                        color: dark ? '#93C5FD' : '#1E3A8A',
                        border: `1px solid ${dark ? 'rgba(37,99,235,0.4)' : 'rgba(30,58,138,0.1)'}`,
                      }
                    : {
                        color: dark ? '#64748B' : '#94A3B8',
                        border: '1px solid transparent',
                        cursor: i < step ? 'pointer' : 'default',
                      }
                }
              >
                <span>{label}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full ml-1"
                  style={{
                    background: i === step
                      ? (dark ? '#3B82F6' : '#1E3A8A')
                      : i < step
                        ? '#10B981'
                        : (dark ? '#334155' : '#E2E8F0'),
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-6">
        <div className="max-w-4xl mx-auto px-6">
          {mode === 'manual' && step === 0 && projectInfoStep()}
          {mode === 'manual' && step === 1 && siteInfoStep()}
          {mode === 'manual' && step === 2 && projectSpecificStep()}
          {mode === 'manual' && step === 3 && (
            <>
              {manualAiStep()}
              {reviewStep()}
            </>
          )}

          {mode === 'ai' && step === 0 && projectInfoStep()}
          {mode === 'ai' && step === 1 && floorPlanStep()}
          {mode === 'ai' && step === 2 && sectionRequirementsStep()}

          {errorMsg && errorBanner(errorMsg)}

          <div className="flex items-center justify-between gap-3 pb-8">
            {step > 0 || mode ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 0) {
                    setMode(null);
                  } else {
                    setStep(step - 1);
                  }
                }}
                className="px-6 py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                style={backBtnStyle}
                disabled={planLoading || estLoading || reqLoading || saving}
              >
                {step === 0 ? '← Change flow' : '← Back'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onExit}
                className="px-6 py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                style={backBtnStyle}
                disabled={saving}
              >
                Exit
              </button>
            )}

            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-8 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer disabled:opacity-60"
                style={{ background: '#1E3A8A' }}
                disabled={saving}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="px-8 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:cursor-wait"
                disabled={saving}
              >
                {saving ? 'Saving to database…' : 'Save Estimation Project'}
                {!saving && <Check className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {isLastStep && (
            <p className="text-[11px] font-semibold pb-8 -mt-4" style={{ color: dark ? '#64748B' : '#94A3B8' }}>
              {saving
                ? 'Saving the estimation to the database…'
                : mode === 'manual' && useAi === null
                  ? 'Select Yes or No above before saving.'
                  : mode === 'ai' && !reqResult && !estResult
                    ? 'Tip: you can save now - requirements extraction and the AI estimation are both optional.'
                    : 'Saving stores the estimation in the database and opens Cost Estimation with your AI results applied.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
