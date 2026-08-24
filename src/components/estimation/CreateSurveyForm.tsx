import { useState, useEffect } from 'react';
import { Plus, Check, SysCamera, SysBell, SysFire, SysLock, SysShield, SysKey, SysTag, SysDroplet, SysElevator, SysPhone, SysSpeaker, SysCar, SysComputer, SysThermometer, SysMicroscope, StatBuilding, Folder, systemBadgeIcons } from '../../utils/Icons';

interface Props {
  userRole?: string;
  onSave: (data: SurveyFormData) => void;
  onExit: () => void;
  initialCompanyName?: string;
  initialLocationName?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  initialClientName?: string;
  initialClientEmail?: string;
  initialClientContactNumber?: string;
  initialSystemTypes?: SystemType[];
}

export type SystemType =
  | 'CCTV'
  | 'FDAS'
  | 'ACCESS_CONTROL'
  | 'BURGLAR_ALARM'
  | 'DOOR_LOCK'
  | 'EAS_SYSTEM'
  | 'FIRE_PROTECTION'
  | 'FIXED_ARM_ELEVATOR'
  | 'INTERCOM_NURSE_CALL'
  | 'PABX_PAGING'
  | 'PARKING_BARRIER'
  | 'POS_SYSTEM'
  | 'ROOM_ALERT'
  | 'XRAY_SECURITY';

export interface SurveyFormData {
  companyName: string;
  projectName: string;
  clientEmail: string;
  clientName: string;
  clientContactNumber: string;
  locationName: string;
  latitude: number;
  longitude: number;
  surveyScope: string;
  systemTypes: SystemType[];
  buildingType: string;
  floors: number | '';
  buildingLength: number | '';
  buildingWidth: number | '';
  floorHeight: number | '';
  startDate: string;
}

const SYSTEM_OPTIONS: { type: SystemType; label: string; icon: string; color: string; bg: string }[] = [
  { type: 'CCTV',                label: 'CCTV System',                        icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'FDAS',                label: 'FDAS / Fire Alarm System',           icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'ACCESS_CONTROL',      label: 'Access Control System',              icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'BURGLAR_ALARM',       label: 'Burglar Alarm System',               icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'DOOR_LOCK',           label: 'Door Lock System',                   icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'EAS_SYSTEM',          label: 'EAS System',                         icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'FIRE_PROTECTION',     label: 'Fire Protection / Suppression',      icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'FIXED_ARM_ELEVATOR',  label: 'Fixed Arm & Elevator Related',       icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'INTERCOM_NURSE_CALL', label: 'Intercom & Nurse Call System',       icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'PABX_PAGING',         label: 'PABX & Paging System',               icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'PARKING_BARRIER',     label: 'Parking Barrier System',             icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'POS_SYSTEM',          label: 'POS System',                         icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'ROOM_ALERT',          label: 'Room Alert System',                  icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'XRAY_SECURITY',       label: 'X-Ray, Turnstile & Walk-Through',   icon: '', color: '#1D4ED8', bg: '#EFF6FF' },
];

const STEPS = [
  { label: 'Company & Project', icon: '' },
  { label: 'System Types',      icon: '' },
];

export default function CreateSurveyForm({
  userRole,
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
}: Props) {
  const parsedCompanyName = typeof initialCompanyName === 'object' && initialCompanyName !== null
    ? (initialCompanyName as any).name || ''
    : String(initialCompanyName || '');

  const [form, setForm] = useState<SurveyFormData>({
    companyName: parsedCompanyName,
    projectName: '',
    clientEmail: initialClientEmail,
    clientName: initialClientName,
    clientContactNumber: initialClientContactNumber,
    locationName: initialLocationName,
    latitude: initialLatitude !== undefined ? initialLatitude : 14.5995,
    longitude: initialLongitude !== undefined ? initialLongitude : 120.9842,
    surveyScope: '',
    systemTypes: initialSystemTypes && initialSystemTypes.length > 0 ? initialSystemTypes : [],
    buildingType: '',
    floors: '',
    buildingLength: '',
    buildingWidth: '',
    floorHeight: '',
    startDate: new Date().toISOString().split('T')[0],
  });

  const toggleSystemType = (type: SystemType) => {
    setForm(prev => ({
      ...prev,
      systemTypes: prev.systemTypes.includes(type)
        ? prev.systemTypes.filter(t => t !== type)
        : [...prev.systemTypes, type],
    }));
  };
  const [step, setStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setErrorMsg('');
  }, [form, step]);

  const update = (field: keyof SurveyFormData, value: string) => {
    let finalValue = value;
    if (field === 'clientContactNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      finalValue = digitsOnly.slice(0, 11);
    }
    setForm(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) {
      if (!form.companyName.trim()) {
        setErrorMsg('Please enter the Company Name.');
        return;
      }
      if (!form.projectName.trim()) {
        setErrorMsg('Please enter the Project Name.');
        return;
      }
      if (!form.locationName.trim()) {
        setErrorMsg('Please enter the Location Name.');
        return;
      }
      if (!form.startDate) {
        setErrorMsg('Please select the Survey Schedule Date.');
        return;
      }
      setStep(1);
      return;
    }
    if (form.systemTypes.length === 0) {
      setErrorMsg('Please select at least one system type.');
      setStep(1);
      return;
    }
    onSave(form);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#1E293B',
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
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 px-6 py-3 bg-gradient-to-r from-white to-blue-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                style={{ background: '#1E3A8A' }}
              >
                <Folder className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-800">Create Survey Estimation</h2>
                <p className="text-[10px] font-bold text-slate-400">Initialize a new client survey site mapping</p>
              </div>
            </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STEPS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStep(i)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
                style={
                  i === step
                    ? { background: 'rgba(30,58,138,0.06)', color: '#1E3A8A', border: '1px solid rgba(30,58,138,0.1)' }
                    : { color: '#94A3B8', border: '1px solid transparent' }
                }
              >
                <span>{s.label === 'Company & Project' ? <StatBuilding className="w-4 h-4" /> : s.label === 'System Types' ? <SysShield className="w-4 h-4" /> : null}</span>
                <span>{s.label}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full ml-1"
                  style={{
                    background: i === step ? '#1E3A8A' : i < step ? '#10B981' : '#E2E8F0',
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto py-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6">

          {/* Step 0: Company & Project */}
          {step === 0 && (
            <div style={sectionStyle}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-4 text-[#1D4ED8]">
                <StatBuilding className="w-4 h-4 inline mr-1.5" /> COMPANY & PROJECT DETAILS
              </p>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Company Name</label>
                    <input
                      value={form.companyName}
                      onChange={e => update('companyName', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. ABC Corporation Philippines"
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Project Name</label>
                    <input
                      value={form.projectName}
                      onChange={e => update('projectName', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. Headquarters CCTV Install"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Client Contact Name (Optional)</label>
                    <input
                      value={form.clientName}
                      onChange={e => update('clientName', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. Juan Dela Cruz (Optional)"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Contact Number (Optional)</label>
                    <input
                      value={form.clientContactNumber}
                      onChange={e => update('clientContactNumber', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. 09171234567 (Optional)"
                    />
                  </div>
                  <div className="col-span-2">
                    <label style={labelStyle}>Client Email Address (Optional)</label>
                    <input
                      value={form.clientEmail}
                      onChange={e => update('clientEmail', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. client@email.com (Optional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Location Name / Area</label>
                    <input value={form.locationName} onChange={e => update('locationName', e.target.value)} style={inputStyle} placeholder="e.g. Makati City, Manila" required />
                  </div>
                  <div>
                    <label style={labelStyle}>Survey Schedule Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={e => update('startDate', e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: System Types */}
          {step === 1 && (
            <div style={sectionStyle}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-4 text-[#1D4ED8]">
                <SysShield className="w-4 h-4 inline mr-1.5" /> SYSTEM TYPES & NOTES
              </p>
              
              <p className="text-xs text-slate-400 font-semibold mb-5">Select all systems that apply — the AI will generate the correct equipment list for each.</p>
              <div className="grid grid-cols-2 gap-3">
                {SYSTEM_OPTIONS.map(opt => {
                  const selected = form.systemTypes.includes(opt.type);
                  const IconComp = systemBadgeIcons[opt.type];
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => toggleSystemType(opt.type)}
                      className="flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all"
                      style={{
                        borderColor: selected ? opt.color : '#E2E8F0',
                        background: selected ? opt.bg : '#FAFAFA',
                        boxShadow: selected ? `0 0 0 3px ${opt.color}18` : 'none',
                      }}
                    >
                      <span className="text-2xl" style={{ color: selected ? opt.color : '#94A3B8' }}>{IconComp ? <IconComp className="w-5 h-5" /> : null}</span>
                      <div className="flex-1">
                        <p className="text-xs font-black" style={{ color: selected ? opt.color : '#475569' }}>{opt.label}</p>
                        {selected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-1" style={{ background: opt.color, color: '#fff' }}>SELECTED <Check className="w-2.5 h-2.5" /></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6">
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
          )}







          {errorMsg && (
            <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border border-red-100 animate-shake">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 pb-8">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:text-slate-800 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onExit}
                className="px-6 py-3 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:text-slate-800 transition-colors"
              >
                Exit
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 0) {
                    if (!form.companyName.trim()) {
                      setErrorMsg('Please enter the Company Name.');
                      return;
                    }
                    if (!form.projectName.trim()) {
                      setErrorMsg('Please enter the Project Name.');
                      return;
                    }
                    if (!form.locationName.trim()) {
                      setErrorMsg('Please enter the Location Name.');
                      return;
                    }
                    if (!form.startDate) {
                      setErrorMsg('Please select the Survey Schedule Date.');
                      return;
                    }
                  }
                  if (step === 1) {
                    if (form.systemTypes.length === 0) {
                      setErrorMsg('Please select at least one system type.');
                      return;
                    }
                  }
                  setStep(step + 1);
                }}
                className="px-8 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm"
                style={{ background: '#1E3A8A' }}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                className="px-8 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                Save Survey Details <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
