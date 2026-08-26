import { useState, useRef, useMemo } from 'react';
import { analyzeFloorPlan, type FloorPlanEstimation } from '../../services/geminiFloorPlanService';
import { useToast } from '../utils/Toast';
import { exportBOQPdf } from '../../utils/pdfExporter';
import type { Project } from '../../App';
import { generateSystemScopeOfWorks } from '../estimation/QuotationModal';

interface FilePreview {
  name: string;
  url: string | null;
  type: 'image' | 'pdf';
  isTor: boolean;
}

import { canViewPrices } from '../../constants/roles';

interface Props {
  projects?: Project[];
  userRole?: string;
  onAddToProjectEstimation?: (projectId: string, result: FloorPlanEstimation) => void;
  onScanningChange?: (scanning: boolean, step?: string) => void;
}

const SYSTEM_OPTIONS = [
  { key: 'CCTV', label: 'CCTV', color: '#2563EB' },
  { key: 'FDAS', label: 'Fire Alarm', color: '#DC2626' },
  { key: 'FIRE_PROTECTION', label: 'Fire Protection', color: '#D97706' },
  { key: 'ACCESS_CONTROL', label: 'Access Control', color: '#059669' },
  { key: 'BURGLAR_ALARM', label: 'Burglar Alarm', color: '#7C3AED' },
  { key: 'DOOR_LOCK', label: 'Door Lock', color: '#0891B2' },
  { key: 'EAS_SYSTEM', label: 'EAS System', color: '#64748B' },
  { key: 'INTERCOM_NURSE_CALL', label: 'Nurse Call / Intercom', color: '#DB2777' },
  { key: 'PABX_PAGING', label: 'PABX / Paging', color: '#9333EA' },
  { key: 'PARKING_BARRIER', label: 'Parking Barrier', color: '#B45309' },
];

const CARRIED_BRANDS_BY_SYSTEM: Record<string, string[]> = {
  CCTV: [
    'Generalized / Any Brand',
    'Hikvision',
    'Dahua Technology',
    'AVTECH',
    'Honeywell',
    'AJAX',
    'Panasonic',
    'AXIS Communications',
    'Imou',
    'EZVIZ',
    'Matrix Telecom & Security',
  ],
  FDAS: [
    'Generalized / Any Brand',
    'Honeywell',
    'EDWARDS',
    'NOTIFIER (by Honeywell)',
    'Simplex',
    'Asenware',
    'Hochiki',
    'Numens',
    'Siemens',
    'Eaton',
    'Esser',
    'Apollo',
    'Cooper',
    'Horing Lih',
    'Gamewell-FCI (by Honeywell)',
    'TYY',
  ],
  FIRE_PROTECTION: [
    'Generalized / Any Brand',
    'Honeywell',
    'EDWARDS',
    'NOTIFIER (by Honeywell)',
    'Simplex',
    'Asenware',
    'Hochiki',
    'Siemens',
  ],
  ACCESS_CONTROL: [
    'Generalized / Any Brand',
    'ZKTeco',
    'Anson',
    'Honeywell',
    'Hikvision',
    'Matrix Telecom & Security',
    'HID',
    'Suprema',
    'IDTECK',
    'CEM Systems',
    'Software House',
    'EntryPass',
    'OK Omnikey',
    'EDGE',
  ],
  BURGLAR_ALARM: [
    'Generalized / Any Brand',
    'AJAX',
    'Hikvision',
    'Honeywell',
  ],
  DOOR_LOCK: [
    'Generalized / Any Brand',
    'ZKTeco',
    'HID',
    'Suprema',
    'Anson',
  ],
  EAS_SYSTEM: [
    'Generalized / Any Brand',
    'Nedap',
    'ZKTeco',
  ],
  INTERCOM_NURSE_CALL: [
    'Generalized / Any Brand',
    'Matrix Telecom & Security',
    'Hikvision',
    'Dahua Technology',
  ],
  PABX_PAGING: [
    'Generalized / Any Brand',
    'Matrix Telecom & Security',
    'TOA',
    'Bosch',
    'ITC Audio',
  ],
  PARKING_BARRIER: [
    'Generalized / Any Brand',
    'Boon Edam',
    'VertX',
    'ZKTeco',
  ],
};

const ANALYSIS_STEPS = [
  'Reading uploaded document(s)...',
  'Extracting floor layout and room counts...',
  'Identifying TOR specifications...',
  'Computing device quantities from floor rules...',
  'Calculating cable lengths and manpower...',
  'Finalizing Bill of Quantities...',
];

export default function FloorPlanView({ projects, userRole, onAddToProjectEstimation, onScanningChange }: Props) {
  const { toast } = useToast();
  const showPrices = canViewPrices(userRole);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [dragOverFloorPlan, setDragOverFloorPlan] = useState(false);
  const [dragOverTor, setDragOverTor] = useState(false);
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['CCTV']);
  const [selectedBrand, setSelectedBrand] = useState<string>('Generalized / Any Brand');
  const [autoDetectMode, setAutoDetectMode] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<FloorPlanEstimation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [floors, setFloors] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const floorPlanInputRef = useRef<HTMLInputElement>(null);
  const torInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateConsumablePrice = (index: number, newPrice: number) => {
    if (!result || !result.consumables) return;
    const updated = [...result.consumables];
    const item = { ...updated[index] };
    item.unitPrice = newPrice;
    item.srp = newPrice;
    item.totalPrice = newPrice * item.quantity;
    updated[index] = item;
    setResult({ ...result, consumables: updated });
  };

  const handleUpdateManpowerRate = (index: number, newRate: number) => {
    if (!result || !result.manpower) return;
    const updated = [...result.manpower];
    const item = { ...updated[index] };
    item.ratePerDay = newRate;
    item.totalCost = newRate * item.manDays;
    updated[index] = item;
    setResult({ ...result, manpower: updated });
  };

  const handleUpdateFeeAmount = (index: number, newAmount: number) => {
    if (!result || !result.fees) return;
    const updated = [...result.fees];
    const item = { ...updated[index] };
    item.amount = newAmount;
    updated[index] = item;
    setResult({ ...result, fees: updated });
  };

  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    brandSet.add('Generalized / Any Brand');
    selectedSystems.forEach(sys => {
      const list = CARRIED_BRANDS_BY_SYSTEM[sys];
      if (list) {
        list.forEach(b => {
          if (b !== 'Generalized / Any Brand') brandSet.add(b);
        });
      }
    });
    return Array.from(brandSet);
  }, [selectedSystems]);

  const handleFilesSelect = (incoming: FileList | File[], forceIsTor?: boolean) => {
    const valid: File[] = [];
    const validPreviews: FilePreview[] = [];
    Array.from(incoming).forEach(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isImage && !isPdf) return;
      const nameLower = file.name.toLowerCase();
      const autoTor = nameLower.includes('tor') || nameLower.includes('terms') || nameLower.includes('reference') || nameLower.includes('spec');
      const isTor = forceIsTor !== undefined ? forceIsTor : autoTor;
      valid.push(file);
      validPreviews.push({ name: file.name, url: isImage ? URL.createObjectURL(file) : null, type: isPdf ? 'pdf' : 'image', isTor });
    });
    if (!valid.length) return;
    setFiles(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...validPreviews]);
    setError(null);
    setResult(null);
  };

  const toggleTor = (idx: number) => {
    setPreviews(prev => prev.map((p, i) => i === idx ? { ...p, isTor: !p.isTor } : p));
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => {
      const removed = prev[idx];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
    setResult(null);
  };

  const clearAll = () => {
    previews.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
    setFiles([]); setPreviews([]); setResult(null); setError(null);
  };

  const toggleSystem = (key: string) => {
    setSelectedSystems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleAnalyze = async () => {
    if (!files.length || (!selectedSystems.length && !autoDetectMode)) return;
    setAnalyzing(true); setError(null); setResult(null); setAnalysisStep(0);
    onScanningChange?.(true, ANALYSIS_STEPS[0]);
    const stepTimer = setInterval(() => {
      setAnalysisStep(prev => {
        const next = prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev;
        onScanningChange?.(true, ANALYSIS_STEPS[next]);
        return next;
      });
    }, 2200);
    try {
      const surveySystemsParam = autoDetectMode
        ? 'CCTV,FDAS,ACCESS_CONTROL,BURGLAR_ALARM,FIRE_PROTECTION,DOOR_LOCK,EAS_SYSTEM,INTERCOM_NURSE_CALL,PABX_PAGING,PARKING_BARRIER'
        : selectedSystems.join(',');

      const res = await analyzeFloorPlan(files, surveySystemsParam, {
        projectName: projectName || 'Floor Plan Analysis',
        buildingType: buildingType || undefined,
        floors: floors ? parseInt(floors) : undefined,
        selectedBrand: selectedBrand !== 'Generalized / Any Brand' ? selectedBrand : undefined,
      });
      setResult(res);
    } catch (err: unknown) {
      setError((err as Error).message || 'Analysis failed');
    } finally {
      clearInterval(stepTimer); setAnalyzing(false); setAnalysisStep(0);
      onScanningChange?.(false);
    }
  };

  const hasTorFile = previews.some(p => p.isTor);
  const confidenceColor = result
    ? result.confidenceScore >= 76 ? '#16A34A' : result.confidenceScore >= 51 ? '#CA8A04' : result.confidenceScore >= 26 ? '#EA580C' : '#DC2626'
    : '#94A3B8';

  const handleSave = () => {
    if (!result) return;
    const key = `aa2000_floorplan_${Date.now()}`;
    const label = projectName || `Floor Plan BOQ — ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    localStorage.setItem(key, JSON.stringify({ label, systems: selectedSystems, result, savedAt: new Date().toISOString() }));
    toast.success(`BOQ saved: "${label}"`);
  };

  const handleCopy = () => {
    if (!result) return;
    const totalManpowerCost = result.manpower.reduce((sum, m) => sum + (m.totalCost || (m.ratePerDay || 0) * m.manDays), 0);
    const totalMaterialsPrice = result.consumables.reduce((sum, c) => sum + (c.totalPrice || (c.unitPrice || c.srp || 0) * c.quantity), 0);
    const totalFees = result.fees.reduce((sum, f) => sum + (f.amount || 0), 0);
    const grandTotal = totalManpowerCost + totalMaterialsPrice + totalFees;

    const text = [
      `BOQ Estimation - ${projectName || 'Floor Plan Analysis'}`,
      `Systems: ${selectedSystems.join(', ')}`,
      `Confidence: ${result.confidenceScore}%`,
      '',
      'MANPOWER',
      ...result.manpower.map(m => {
        const rate = m.ratePerDay || 1000;
        const cost = m.totalCost || rate * m.manDays;
        return `  ${m.role}: ${m.headcount} person(s) x ${m.hours}h (${m.manDays} man-days @ ₱${rate.toLocaleString('en-PH')}/day) = ₱${cost.toLocaleString('en-PH')}`;
      }),
      `  Total Manpower Cost: ₱${totalManpowerCost.toLocaleString('en-PH')}`,
      '',
      'BILL OF MATERIALS',
      ...result.consumables.map(c => {
        const unitP = c.unitPrice || c.srp || 0;
        const totalP = c.totalPrice || unitP * c.quantity;
        return `  ${c.name} - ${c.quantity} ${c.unit || 'pcs'} @ ₱${unitP.toLocaleString('en-PH')} = ₱${totalP.toLocaleString('en-PH')}`;
      }),
      `  Total Materials Price: ₱${totalMaterialsPrice.toLocaleString('en-PH')}`,
      '',
      'ADDITIONAL FEES',
      ...result.fees.map(f => `  ${f.type}: ₱${f.amount.toLocaleString('en-PH')}`),
      `  Total Fees: ₱${totalFees.toLocaleString('en-PH')}`,
      '',
      `GRAND TOTAL ESTIMATION: ₱${grandTotal.toLocaleString('en-PH')}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(
      () => toast.success('BOQ copied to clipboard!'),
      () => toast.error('Could not copy — try manually selecting the text.')
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 min-h-16 shrink-0 border-b border-slate-200 gap-2">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
          <div>
            <span className="text-sm sm:text-base font-black text-slate-900">Floor Plan &amp; TOR Estimator</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI-Powered Bill of Quantities</p>
          </div>
        </div>
        {files.length > 0 && <button onClick={clearAll} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">Clear All</button>}
      </div>

      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-5">

          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">System(s) to Estimate</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Select specific security systems or enable AI Auto-Detection</p>
              </div>
              
              {/* Interactive Auto-Detect Toggle Switch */}
              <div
                onClick={() => setAutoDetectMode(!autoDetectMode)}
                className="flex items-center gap-2.5 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/80 cursor-pointer select-none hover:bg-blue-100/60 transition-colors"
              >
                <span className="text-[11px] font-extrabold text-blue-900 flex items-center gap-1">
                  <span>⚡</span> Auto-Detect Systems &amp; Legends
                </span>
                <button
                  type="button"
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 relative cursor-pointer ${
                    autoDetectMode ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform transform ${
                    autoDetectMode ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {autoDetectMode ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center gap-2.5 text-xs text-blue-950 font-medium">
                  <span className="text-base shrink-0">✨</span>
                  <span>
                    <strong>AI Auto-Detect Active:</strong> The AI will automatically scan all uploaded drawings, legends, plotted icons &amp; TOR specs. Click pills below if you want to switch to specific systems.
                  </span>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center gap-2 text-xs text-amber-900 font-medium">
                  <span className="text-base shrink-0">🎯</span>
                  <span>
                    <strong>Manual System Filter Mode:</strong> The AI will generate BOQ strictly for the system(s) selected below.
                  </span>
                </div>
              )}

              {/* System Option Pills */}
              <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 sm:flex-wrap">
                {SYSTEM_OPTIONS.map(sys => {
                  const active = selectedSystems.includes(sys.key);
                  return (
                    <button
                      key={sys.key}
                      onClick={() => {
                        toggleSystem(sys.key);
                        if (autoDetectMode) setAutoDetectMode(false);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer"
                      style={active ? { background: sys.color, color: '#fff', borderColor: sys.color } : { background: '#F8FAFC', color: '#64748B', borderColor: '#E2E8F0' }}
                    >
                      {sys.label}
                    </button>
                  );
                })}
              </div>

              {/* Brand Selection Dropdown */}
              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-800">Target Brand / Manufacturer</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Select a carried brand or keep Generalized (no hardcoded brand)
                  </p>
                </div>
                <select
                  value={availableBrands.includes(selectedBrand) ? selectedBrand : 'Generalized / Any Brand'}
                  onChange={e => setSelectedBrand(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[240px]"
                >
                  {availableBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project Details</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Optional — improves estimation accuracy</p>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project Name</label>
                <input type="text" placeholder="e.g. UST Medical Tower" value={projectName} onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Building Type</label>
                <select value={buildingType} onChange={e => setBuildingType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-blue-400 transition-colors">
                  <option value="">Select type...</option>
                  <option value="Office">Office Building</option>
                  <option value="Hospital / Medical">Hospital / Medical</option>
                  <option value="School / University">School / University</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Retail / Mall">Retail / Mall</option>
                  <option value="Warehouse / Industrial">Warehouse / Industrial</option>
                  <option value="Residential">Residential</option>
                  <option value="Government">Government</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Number of Floors</label>
                <input type="number" placeholder="e.g. 7" min="1" value={floors === '0' ? '' : floors} onChange={e => setFloors(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-blue-400 transition-colors" />
              </div>
            </div>
          </div>

          {/* Separate Drop Zones for Floor Plans and TOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Drop Zone 1: Floor Plan Blueprints & Images */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOverFloorPlan(true); }}
              onDragLeave={() => setDragOverFloorPlan(false)}
              onDrop={e => { e.preventDefault(); setDragOverFloorPlan(false); handleFilesSelect(e.dataTransfer.files, false); }}
              onClick={() => floorPlanInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragOverFloorPlan ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                ref={floorPlanInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf"
                className="hidden"
                onClick={e => e.stopPropagation()}
                onChange={e => { if (e.target.files?.length) { handleFilesSelect(e.target.files, false); e.target.value = ''; } }}
              />
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Floor Plan Blueprints</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Drop floor plan images (JPG, PNG) or PDFs</p>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-blue-700 bg-blue-100/80 border border-blue-200">
                  🗺️ Blueprints / Layout Drawings
                </span>
              </div>
            </div>

            {/* Drop Zone 2: Terms of Reference (TOR) & Specs */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOverTor(true); }}
              onDragLeave={() => setDragOverTor(false)}
              onDrop={e => { e.preventDefault(); setDragOverTor(false); handleFilesSelect(e.dataTransfer.files, true); }}
              onClick={() => torInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragOverTor ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                ref={torInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onClick={e => e.stopPropagation()}
                onChange={e => { if (e.target.files?.length) { handleFilesSelect(e.target.files, true); e.target.value = ''; } }}
              />
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">TOR & Spec Documents</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Drop TOR PDFs, scope of work, spec sheets</p>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-blue-700 bg-blue-100/80 border border-blue-200">
                  📄 Terms of Reference (TOR)
                </span>
              </div>
            </div>
          </div>

          {previews.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded Files ({previews.length})</span>
                <span className="text-[10px] text-slate-400">Click TOR button to mark a document as Terms of Reference</span>
              </div>
              {previews.map((fp, idx) => (
                <div key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${fp.isTor ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                  {fp.type === 'image' && fp.url ? (
                    <img src={fp.url} alt={fp.name} className="w-12 h-10 object-contain rounded-lg border border-slate-200 bg-slate-50 shrink-0" />
                  ) : (
                    <div className={`w-12 h-10 rounded-lg border flex items-center justify-center shrink-0 ${fp.isTor ? 'bg-blue-100 border-blue-200' : 'bg-red-50 border-red-100'}`}>
                      <svg className={`w-5 h-5 ${fp.isTor ? 'text-blue-500' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{fp.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide" style={fp.type === 'pdf' ? { background: '#FEF2F2', color: '#DC2626' } : { background: '#EFF6FF', color: '#2563EB' }}>{fp.type === 'pdf' ? 'PDF' : 'Image'}</span>
                      {fp.isTor && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide bg-blue-100 text-blue-700">TOR / Spec</span>}
                    </div>
                  </div>
                  <button onClick={() => toggleTor(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border ${fp.isTor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                    TOR
                  </button>
                  <button onClick={() => removeFile(idx)} className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center text-xs font-black transition-colors shrink-0">&times;</button>
                </div>
              ))}

              {hasTorFile && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-amber-800">TOR Document Detected</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">The AI will read the TOR specifications and extract exact hardware items, brands, and quantities. These will override general estimation rules — the BOQ will strictly follow the TOR requirements.</p>
                  </div>
                </div>
              )}

              {!analyzing && selectedSystems.length > 0 && (
                <button onClick={handleAnalyze} className="w-full mt-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563EB)', boxShadow: '0 4px 16px rgba(37,99,235,0.25)' }}>
                  <svg className="w-4 h-4 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                  Generate {selectedSystems.length > 1 ? selectedSystems.length + '-System' : ''} BOQ Estimation
                </button>
              )}

              {selectedSystems.length === 0 && !analyzing && (
                <p className="text-xs font-bold text-center text-amber-600 py-2">Select at least one system type above to generate estimation</p>
              )}

              {analyzing && (
                <div className="rounded-2xl bg-gradient-to-b from-blue-50/90 via-blue-50/50 to-indigo-50/40 border border-blue-200/80 p-5 space-y-4 shadow-sm animate-fade-in">
                  {/* Header with status text and step progress badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">AI is generating your BOQ estimation...</h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Extracting floor components and estimating bill of quantities</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-extrabold text-blue-700 bg-blue-100/90 border border-blue-200/80 px-2.5 py-1 rounded-full">
                        Step {analysisStep + 1} of {ANALYSIS_STEPS.length}
                      </span>
                    </div>
                  </div>

                  {/* Smooth Progress Bar */}
                  <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-600 to-indigo-600"
                      style={{ width: `${Math.round(((analysisStep + 1) / ANALYSIS_STEPS.length) * 100)}%` }}
                    />
                  </div>

                  {/* Step Checklist (Single active spinner, completed checks, pending dots) */}
                  <div className="space-y-1 pt-1">
                    {ANALYSIS_STEPS.map((step, i) => {
                      const isDone = i < analysisStep;
                      const isCurrent = i === analysisStep;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2.5 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-300 ${
                            isCurrent
                              ? 'bg-white/90 border border-blue-200/80 shadow-xs text-blue-950 font-bold'
                              : isDone
                              ? 'text-slate-600 font-medium'
                              : 'text-slate-400 opacity-60'
                          }`}
                        >
                          {isDone ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                          ) : isCurrent ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-300/80 bg-slate-100/60 flex items-center justify-center shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            </div>
                          )}
                          <span className={isCurrent ? 'text-blue-900 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-xs font-bold text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in-up">
              {/* Summary */}
              <div className="rounded-xl border border-blue-100 overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">AI Analysis Summary</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                      style={{ color: confidenceColor, borderColor: confidenceColor + '40', background: confidenceColor + '12' }}>
                      {result.confidenceScore >= 76 ? 'High Confidence' : result.confidenceScore >= 51 ? 'Medium Confidence' : result.confidenceScore >= 26 ? 'Low Confidence' : 'Poor Quality'}
                    </span>
                    <div className="w-24 h-2.5 rounded-full bg-blue-200 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.confidenceScore}%`, background: confidenceColor }} />
                    </div>
                    <span className="text-xs font-black" style={{ color: confidenceColor }}>{result.confidenceScore}%</span>
                  </div>
                </div>
                <div className="p-4"><p className="text-sm font-semibold text-blue-900">{result.observations}</p></div>
              </div>

              {/* ── Labor & Services (Manpower Breakdown + Scope of Works) ── */}
              {((result.manpower || []).length > 0 || (result.scopeOfWorks || []).length > 0) && (() => {
                const mpList = result.manpower || [];
                const totalManpowerCost = mpList.reduce((sum, m) => sum + (m.totalCost || (m.ratePerDay || 0) * m.manDays), 0);
                const totalManDays = mpList.reduce((a, m) => a + m.manDays, 0);
                const sowList = (result.scopeOfWorks && result.scopeOfWorks.length > 0)
                  ? result.scopeOfWorks
                  : generateSystemScopeOfWorks(
                      selectedSystems,
                      (result.consumables || []).map((c, idx) => ({
                        id: String(idx + 1),
                        name: c.name,
                        category: c.category,
                        quantity: c.quantity,
                        unit: c.unit,
                        unitPrice: c.unitPrice || 0,
                        totalPrice: c.totalPrice || 0,
                        srp: c.srp,
                        contractorPrice: c.contractorPrice,
                        dealerPrice: c.dealerPrice,
                      })),
                      projectName || 'Project',
                      totalManpowerCost
                    );

                return (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-white overflow-hidden shadow-sm space-y-0">
                    {/* Labor & Services Card Main Header */}
                    <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-black tracking-wide uppercase">Labor &amp; Services</h3>
                          <p className="text-[10px] text-indigo-200 font-medium">Engineering Manpower Allocation &amp; Detailed Scope of Works</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-700/80 text-indigo-100 border border-indigo-500/30">
                          {totalManDays} Total Man-Days
                        </span>
                        <span className="text-xs font-black px-3 py-1 rounded-lg bg-white text-indigo-950 shadow-xs">
                          &#8369;{totalManpowerCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Sub-section 1: Technical Manpower Table */}
                    <div className="p-4 border-b border-indigo-100 bg-slate-50/40">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          Technical Manpower Allocation
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">{mpList.length} Engineering Roles Assigned</span>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-4 py-2.5 text-left font-bold text-slate-600">Role / Designation</th>
                              <th className="px-4 py-2.5 text-right font-bold text-slate-600">Headcount</th>
                              <th className="px-4 py-2.5 text-right font-bold text-slate-600">Hours</th>
                              <th className="px-4 py-2.5 text-right font-bold text-slate-600">Man-Days</th>
                              <th className="px-4 py-2.5 text-right font-bold text-slate-600">Day Rate (₱)</th>
                              <th className="px-4 py-2.5 text-right font-bold text-slate-600">Total Cost (₱)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mpList.map((m, i) => {
                              const rate = m.ratePerDay || 1000;
                              const cost = m.totalCost || rate * m.manDays;
                              return (
                                <tr key={i} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                                  <td className="px-4 py-2.5 font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    {m.role}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{m.headcount}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{m.hours}h</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-blue-700">{m.manDays}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-slate-400 font-bold">₱</span>
                                      <input
                                        type="number"
                                        min={0}
                                        step="any"
                                        value={rate || ''}
                                        onChange={e => handleUpdateManpowerRate(i, parseFloat(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 text-right text-xs font-bold rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-slate-800"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-black text-slate-900">&#8369;{cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-indigo-50/50 border-t border-slate-200">
                              <td colSpan={5} className="px-4 py-2.5 font-bold text-slate-700 text-right uppercase text-[10.5px]">Total Manpower Labor Cost:</td>
                              <td className="px-4 py-2.5 text-right font-black text-indigo-900 text-sm">&#8369;{totalManpowerCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Sub-section 2: Scope of Works */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          Scope of Works &amp; Detailed Procedural Activities
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">{sowList.length} Activity Items</span>
                      </div>

                      <div className="space-y-2.5">
                        {sowList.map((s, i) => {
                          const lines = (s.description || '').split('\n').map(l => l.trim()).filter(Boolean);
                          const title = lines[0] || `Scope Item #${s.itemNumber || i + 1}`;
                          const details = lines.slice(1);
                          return (
                            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 hover:border-indigo-300 transition-all">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                    {s.itemNumber || i + 1}
                                  </span>
                                  <div className="space-y-1">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{title}</h4>
                                    {details.length > 0 && (
                                      <div className="space-y-1 mt-1.5 pl-1 border-l-2 border-indigo-200">
                                        {details.map((d, di) => (
                                          <p key={di} className="text-[11px] text-slate-600 leading-relaxed">{d}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">{s.unit || '1 LOT'}</span>
                                  {(s.totalPrice || 0) > 0 && (
                                    <p className="text-xs font-black text-slate-900 mt-1">&#8369;{(s.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Bill of Materials */}
              {(result.consumables || []).length > 0 && (() => {
                const conList = result.consumables || [];
                const totalMaterialsPrice = conList.reduce((sum, c) => sum + (c.totalPrice || (c.unitPrice || c.srp || 0) * c.quantity), 0);
                return (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bill of Materials</span>
                      <span className="text-[10px] font-bold text-slate-400">{conList.length} line items</span>
                    </div>
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-2 text-left font-bold text-slate-500">Item / Specification</th>
                            <th className="px-4 py-2 text-left font-bold text-slate-500">Category</th>
                            <th className="px-4 py-2 text-right font-bold text-slate-500">Qty</th>
                            <th className="px-4 py-2 text-left font-bold text-slate-500">Unit</th>
                            {showPrices && (
                              <>
                                <th className="px-4 py-2 text-right font-bold text-slate-500">Unit Price (₱)</th>
                                <th className="px-4 py-2 text-right font-bold text-slate-500">Total Price (₱)</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {conList.map((c, i) => {
                            const unitPrice = c.unitPrice || c.srp || 0;
                            const totalPrice = c.totalPrice || unitPrice * c.quantity;
                            return (
                              <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                                <td className="px-4 py-2.5 font-semibold text-slate-800">{c.name}</td>
                                <td className="px-4 py-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.category}</span></td>
                                <td className="px-4 py-2.5 text-right font-black text-slate-800">{c.quantity}</td>
                                <td className="px-4 py-2.5 text-slate-500 font-medium">{c.unit || '-'}</td>
                                {showPrices && (
                                  <>
                                    <td className="px-4 py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-slate-400 font-bold">₱</span>
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={unitPrice || ''}
                                          onChange={e => handleUpdateConsumablePrice(i, parseFloat(e.target.value) || 0)}
                                          className="w-24 px-2 py-1 text-right text-xs font-bold rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-slate-800"
                                        />
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-black text-slate-800">&#8369;{totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        {showPrices && (
                          <tfoot>
                            <tr className="bg-slate-100/70 border-t border-slate-200">
                              <td colSpan={5} className="px-4 py-2.5 font-bold text-slate-700 text-right">Total Materials Price:</td>
                              <td className="px-4 py-2.5 text-right font-black text-emerald-700 text-sm">&#8369;{totalMaterialsPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Additional Fees */}
              {(result.fees || []).length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200"><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Additional Fees</span></div>
                  <div className="p-4 space-y-2">
                    {(result.fees || []).map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{f.type}</p>
                          {f.description && <p className="text-[10px] text-slate-500">{f.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-bold text-xs">₱</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={f.amount || ''}
                            onChange={e => handleUpdateFeeAmount(i, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-right text-xs font-bold rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall Grand Total Card */}
              {(() => {
                const totalManpower = (result.manpower || []).reduce((sum, m) => sum + (m.totalCost || (m.ratePerDay || 0) * m.manDays), 0);
                const totalMaterials = (result.consumables || []).reduce((sum, c) => sum + (c.totalPrice || (c.unitPrice || c.srp || 0) * c.quantity), 0);
                const totalFees = (result.fees || []).reduce((sum, f) => sum + (f.amount || 0), 0);
                const grandTotal = totalManpower + totalMaterials + totalFees;

                return (
                  <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/60 via-white to-slate-50 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                      <span className="text-xs font-black text-blue-950 uppercase tracking-wider">Overall BOQ Estimation Summary</span>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-600 text-white uppercase tracking-wider">Grand Total</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Manpower Total</span>
                        <p className="text-sm font-black text-blue-700 mt-0.5">&#8369;{totalManpower.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Materials Total</span>
                        <p className="text-sm font-black text-emerald-700 mt-0.5">&#8369;{totalMaterials.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Additional Fees</span>
                        <p className="text-sm font-black text-slate-700 mt-0.5">&#8369;{totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                      <span className="text-sm font-extrabold text-slate-800">Grand Total BOQ Estimation:</span>
                      <span className="text-xl font-black text-blue-700">&#8369;{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Installation Constraints */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200"><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Installation Notes &amp; Constraints</span></div>
                <div className="p-4 space-y-3">
                  {[
                    { label: 'Physical', value: result.constraints?.physical || 'Standard site physical conditions.' },
                    { label: 'Electrical', value: result.constraints?.electrical || '220V power supply available at main DB.' },
                    { label: 'Installation', value: result.constraints?.installation || 'Standard working hours installation access.' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Save / Copy / Export actions ── */}
              <div className="flex items-center gap-3 pt-1 pb-4">
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563EB)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
                >
                  <svg className="w-4 h-4 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save BOQ Result
                </button>
                <button
                  onClick={async () => {
                    if (!result) return;
                    toast.info('Generating PDF document...');
                    try {
                      await exportBOQPdf({
                        title: 'Floor Plan AI BOQ Estimation',
                        projectName: projectName || 'Floor Plan Analysis',
                        systems: selectedSystems,
                        confidenceScore: result.confidenceScore,
                        observations: result.observations,
                        manpower: result.manpower,
                        scopeOfWorks: result.scopeOfWorks,
                        consumables: result.consumables,
                        fees: result.fees,
                        constraints: result.constraints,
                      });
                      toast.success('PDF document downloaded!');
                    } catch {
                      toast.error('Failed to generate PDF document.');
                    }
                  }}
                  className="px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </button>
                <button
                  onClick={handleCopy}
                  className="px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>

              {/* ── Add to Project Estimation ── */}
              {onAddToProjectEstimation && projects && projects.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Add to Project Estimation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-emerald-200 bg-white text-slate-700 outline-none focus:border-emerald-400 transition-colors"
                    >
                      <option value="">Select a project...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {p.clientName}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (!selectedProjectId || !result) return;
                        onAddToProjectEstimation(selectedProjectId, result);
                        setSelectedProjectId('');
                      }}
                      disabled={!selectedProjectId}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40"
                      style={{ background: !selectedProjectId ? '#94A3B8' : 'linear-gradient(135deg, #059669, #047857)', boxShadow: !selectedProjectId ? 'none' : '0 4px 12px rgba(5,150,105,0.3)' }}
                    >
                      Add to Project Estimation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
