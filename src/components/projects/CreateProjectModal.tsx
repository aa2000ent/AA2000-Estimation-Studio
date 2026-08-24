import { useState, useEffect } from 'react';
import type { Project } from '../../App';
import LeafletMap from '../utils/LeafletMap';
import { DEFAULT_TECHNICIANS } from '../../constants/roles';
import { Plus, Check, SysCamera, SysBell, SysFire, SysLock, SysShield, SysKey, SysTag, SysDroplet, SysElevator, SysPhone, SysSpeaker, SysCar, SysComputer, SysThermometer, SysMicroscope, StatBuilding } from '../../utils/Icons';

const SYSTEM_OPTIONS: { type: string; label: string; color: string; bg: string }[] = [
  { type: 'CCTV',                label: 'CCTV System',                        color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'FDAS',                label: 'FDAS / Fire Alarm System',           color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'ACCESS_CONTROL',      label: 'Access Control System',              color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'BURGLAR_ALARM',       label: 'Burglar Alarm System',               color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'DOOR_LOCK',           label: 'Door Lock System',                   color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'EAS_SYSTEM',          label: 'EAS System',                         color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'FIRE_PROTECTION',     label: 'Fire Protection / Suppression',      color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'FIXED_ARM_ELEVATOR',  label: 'Fixed Arm & Elevator Related',       color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'INTERCOM_NURSE_CALL', label: 'Intercom & Nurse Call System',       color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'PABX_PAGING',         label: 'PABX & Paging System',               color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'PARKING_BARRIER',     label: 'Parking Barrier System',             color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'POS_SYSTEM',          label: 'POS System',                         color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'ROOM_ALERT',          label: 'Room Alert System',                  color: '#1D4ED8', bg: '#EFF6FF' },
  { type: 'XRAY_SECURITY',       label: 'X-Ray, Turnstile & Walk-Through',   color: '#1D4ED8', bg: '#EFF6FF' },
];

const STEPS = [
  { label: 'Company Details', icon: 'StatBuilding' },
  { label: 'Building Information', icon: 'StatBuilding' },
  { label: 'System Types',    icon: 'SysShield' },
];

interface Props {
  userRole?: string;
  onClose: () => void;
  onCreate: (project: Project) => void;
  isCompanyMode?: boolean;
}

const SYS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CCTV: SysCamera, FDAS: SysFire, ACCESS_CONTROL: SysLock,
  BURGLAR_ALARM: SysBell, DOOR_LOCK: SysKey, EAS_SYSTEM: SysTag,
  FIRE_PROTECTION: SysShield, FIXED_ARM_ELEVATOR: SysElevator,
  INTERCOM_NURSE_CALL: SysPhone, PABX_PAGING: SysSpeaker,
  PARKING_BARRIER: SysCar, POS_SYSTEM: SysComputer,
  ROOM_ALERT: SysThermometer, XRAY_SECURITY: SysMicroscope,
};

export default function CreateProjectModal({ userRole, onClose, onCreate, isCompanyMode = false }: Props) {
  // Step 0: Company Details
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

  // Step 1: Building Information Questionnaire
  const [isNewBuilding, setIsNewBuilding] = useState<string>('No');
  const [buildingType, setBuildingType] = useState('Office');
  const [buildingLength, setBuildingLength] = useState<string>('');
  const [buildingWidth, setBuildingWidth] = useState<string>('');
  const [floorHeight, setFloorHeight] = useState<string>('');
  const [floors, setFloors] = useState<number | string>('1');
  const [rooms, setRooms] = useState<number | string>('');

  // Step 2: System Types
  const [step, setStep] = useState(0);
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setErrorMsg('');
  }, [name, client, email, phone, location, buildingType, buildingLength, buildingWidth, floorHeight, floors, rooms, systemTypes, step]);

  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '');
    setPhone(digitsOnly.slice(0, 11));
  };

  // Map coordinate selection states
  const [mapClicked, setMapClicked] = useState(false);
  const [latitude, setLatitude] = useState(14.5995);
  const [longitude, setLongitude] = useState(120.9842);
  const [locating, setLocating] = useState(false);

  // Auto-calculated area
  const lenNum = parseFloat(String(buildingLength)) || 0;
  const widNum = parseFloat(String(buildingWidth)) || 0;
  const flrNum = parseInt(String(floors), 10) || 1;
  const calculatedTotalArea = lenNum > 0 && widNum > 0 ? (lenNum * widNum * flrNum).toLocaleString('en-US') + ' m²' : '';

  // Geocode address
  const handleLocationBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (!value) return;
    setLocating(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=1`,
        { headers: { 'User-Agent': 'AA2000-Site-Survey-Estimation-App/1.0' } }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        setLatitude(parseFloat(results[0].lat));
        setLongitude(parseFloat(results[0].lon));
        setLocation(results[0].display_name);
        setMapClicked(true);
      }
    } catch (e) {
      console.error('Geocoding failed:', e);
    } finally {
      setLocating(false);
    }
  };

  const toggleSystemType = (type: string) => {
    setSystemTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 0) {
      if (!name.trim()) {
        setErrorMsg('Please enter the Company Name.');
        return false;
      }
      if (!client.trim()) {
        setErrorMsg('Please enter the Client Name.');
        return false;
      }
      if (email.trim() && !email.includes('@')) {
        setErrorMsg('Please enter a valid email address.');
        return false;
      }
      if (phone.trim() && phone.length < 11) {
        setErrorMsg('Please enter a valid 11-digit contact number.');
        return false;
      }
      if (!location.trim()) {
        setErrorMsg('Please enter the location address.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isCompanyMode && step < STEPS.length - 1) {
      if (!validateStep(step)) return;
      setStep(step + 1);
      return;
    }

    if (isCompanyMode && systemTypes.length === 0) {
      setErrorMsg('Please select at least one system type.');
      setStep(2);
      return;
    }

    const l = parseFloat(String(buildingLength)) || 0;
    const w = parseFloat(String(buildingWidth)) || 0;
    const f = parseInt(String(floors), 10) || 1;
    const calculatedAreaNum = l > 0 && w > 0 ? l * w * f : undefined;

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      clientName: client,
      clientEmail: email,
      clientPhone: phone,
      location,
      latitude: mapClicked ? latitude : undefined,
      longitude: mapClicked ? longitude : undefined,
      isNewBuilding: isNewBuilding === 'Yes',
      buildingType: isCompanyMode ? 'Other' : buildingType,
      buildingLength: l > 0 ? l : undefined,
      buildingWidth: w > 0 ? w : undefined,
      floorHeight: parseFloat(String(floorHeight)) || undefined,
      floors: f,
      rooms: parseInt(String(rooms), 10) || undefined,
      totalFloorArea: calculatedAreaNum,
      systemTypes: isCompanyMode ? systemTypes : undefined,
      status: 'Pending',
      startDate: new Date().toISOString().split('T')[0],
      assignedTechnicians: DEFAULT_TECHNICIANS,
      createdAt: new Date().toISOString(),
    };

    onCreate(newProject);
    onClose();
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
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94A3B8',
    marginBottom: '6px',
  };

  const activeSteps = isCompanyMode ? STEPS : [STEPS[0], STEPS[1]];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-xl overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-[#1E3A8A]">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">
                {isCompanyMode ? 'Create New Company' : 'Create New Project'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400">
                {isCompanyMode ? 'Initialize a new company profile & site questionnaire' : 'Initialize a new site survey project'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Step Indicators */}
        {isCompanyMode && (
          <div className="flex items-center gap-2 px-5 pt-4 pb-2 overflow-x-auto border-b border-slate-50">
            {activeSteps.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  if (i > step && !validateStep(step)) return;
                  setStep(i);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
                style={
                  i === step
                    ? { background: 'rgba(30,58,138,0.06)', color: '#1E3A8A', border: '1px solid rgba(30,58,138,0.1)' }
                    : { color: '#94A3B8', border: '1px solid transparent' }
                }
              >
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
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Step 0: Company Details & Location */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>{isCompanyMode ? 'Company Name' : 'Project Name'}</label>
                  <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={isCompanyMode ? "e.g. MegaCorp Philippines" : "e.g. BGC CCTV Site Survey"} required />
                </div>
                <div>
                  <label style={labelStyle}>Client Name</label>
                  <input value={client} onChange={e => setClient(e.target.value)} style={inputStyle} placeholder="e.g. Juan Dela Cruz" required />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>Client Email (Optional)</label>
                    <input
                      type="email"
                      pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                      title="Please enter a valid email address containing '@' and a dot (e.g., name@domain.com)"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={inputStyle}
                      placeholder="client@company.com (Optional)"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Contact Number (Optional)</label>
                    <input
                      type="tel"
                      pattern="[0-9]{11}"
                      maxLength={11}
                      title="Please enter exactly 11 digits (e.g., 09171234567)"
                      value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. 09171234567 (Optional)"
                    />
                  </div>
                </div>

              <div>
                <label style={labelStyle}>{isCompanyMode ? 'Project/Survey Location Address' : 'Project Location Address'}</label>
                <div className="relative">
                  <input value={location} onChange={e => setLocation(e.target.value)} onBlur={handleLocationBlur} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} style={inputStyle} placeholder="e.g. 5th Ave, Taguig, Metro Manila" required />
                  {locating && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-blue-500 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Locating...
                    </span>
                  )}
                </div>
              </div>

              {/* Map Pin selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label style={labelStyle}>Map Location Pin</label>
                  {mapClicked && (
                    <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {latitude.toFixed(4)}, {longitude.toFixed(4)}
                    </span>
                  )}
                </div>
                <LeafletMap
                  onLocationSelect={(lat, lng, address) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    setLocation(address);
                    setMapClicked(true);
                  }}
                  initialLat={latitude}
                  initialLng={longitude}
                  height="160px"
                />
              </div>
            </>
          )}

          {/* Step 1: Building Information Questionnaire */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Building Information</h3>
                <p className="text-[11px] text-slate-400 font-medium">Provide key structural details about the site building.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Is New Building? *</label>
                  <select value={isNewBuilding} onChange={e => setIsNewBuilding(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="Select...">Select...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Building Type *</label>
                  <select value={buildingType} onChange={e => setBuildingType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="Office">Office</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Residential">Residential</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Government">Government</option>
                    <option value="Hospital / Healthcare">Hospital / Healthcare</option>
                    <option value="Educational / School">Educational / School</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Building Length (M) *</label>
                  <input type="number" step="any" min={0} value={buildingLength} onChange={e => setBuildingLength(e.target.value)} style={inputStyle} placeholder="e.g. 50" />
                </div>
                <div>
                  <label style={labelStyle}>Building Width (M) *</label>
                  <input type="number" step="any" min={0} value={buildingWidth} onChange={e => setBuildingWidth(e.target.value)} style={inputStyle} placeholder="e.g. 30" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Total Floor Area (M²)</label>
                  <input value={calculatedTotalArea} readOnly style={{ ...inputStyle, background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }} placeholder="Auto-calculated" />
                </div>
                <div>
                  <label style={labelStyle}>Floor Height (M) *</label>
                  <input type="number" step="any" min={0} value={floorHeight} onChange={e => setFloorHeight(e.target.value)} style={inputStyle} placeholder="e.g. 3.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Number of Floors *</label>
                  <input type="number" min={1} value={floors === '0' || floors === 0 ? '' : floors} onChange={e => setFloors(e.target.value)} style={inputStyle} placeholder="1" />
                </div>
                <div>
                  <label style={labelStyle}>Number of Rooms *</label>
                  <input type="number" min={0} value={rooms} onChange={e => setRooms(e.target.value)} style={inputStyle} placeholder="e.g. 12" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: System Types Selection */}
          {isCompanyMode && step === 2 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-[#1D4ED8]">
                SYSTEM TYPES SELECTION
              </p>
              <p className="text-xs text-slate-400 font-semibold mb-4">Select the security and technical systems required for this site.</p>
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {SYSTEM_OPTIONS.map(opt => {
                  const selected = systemTypes.includes(opt.type);
                  const IconComp = SYS_ICONS[opt.type];
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
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: selected ? opt.color : '#475569' }}>{opt.label}</p>
                        {selected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-1 shrink-0" style={{ background: opt.color, color: '#fff' }}>SELECTED <Check className="w-2.5 h-2.5" /></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border border-red-100 animate-shake">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
                ← Back
              </button>
            ) : (
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            )}
            {step < activeSteps.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!validateStep(step)) return;
                  setStep(step + 1);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95"
                style={{ background: '#1E3A8A' }}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95"
                style={{ background: isCompanyMode ? '#059669' : '#1E3A8A' }}
              >
                {isCompanyMode ? 'Create Company' : 'Create Project'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}