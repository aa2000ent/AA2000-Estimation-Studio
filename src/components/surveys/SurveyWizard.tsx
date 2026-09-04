import React, { useState, useEffect } from 'react';
import type { SurveyType } from '../../App';
import { getDataService } from '../../services/factory';
import { parseFile } from '../../services/fileParser';
import { VideoCamera, Bell as SysBell, SysFire, SysLock, SysShield, SysGear, StatClipboard, StatBuilding, SysCamera, SysKey, SysPhone, SysSpeaker, SysCar, SysComputer, SysThermometer, SysMicroscope, SysDroplet, SysElevator, SysTag, Door, Desktop, Sensor, Satellite, Sliders, FireExtinguisher, Suppression, Plug, Map, Package as PackageIcon, MagnifyingGlass, systemBadgeIcons, systemOptionIcons } from '../../utils/Icons';

interface Props {
  projectId: string;
  surveyType: SurveyType;
  onComplete: () => void;
  onBack: () => void;
  isDark?: boolean;
}

const SURVEY_CONFIG: Record<SurveyType, { label: string; icon: string; steps: { key: string; label: string }[] }> = {
  CCTV: {
    label: 'CCTV Survey',
    icon: '',
    steps: [
      { key: 'building', label: 'Building Info' },
      { key: 'cameras', label: 'Cameras' },
      { key: 'infrastructure', label: 'Infrastructure' },
      { key: 'review', label: 'Review' },
    ],
  },
  FIRE_ALARM: {
    label: 'Fire Alarm Survey',
    icon: '',
    steps: [
      { key: 'building', label: 'Building Info' },
      { key: 'detection', label: 'Detection Areas' },
      { key: 'panel', label: 'Control Panel' },
      { key: 'review', label: 'Review' },
    ],
  },
  FIRE_PROTECTION: {
    label: 'Fire Protection Survey',
    icon: '',
    steps: [
      { key: 'building', label: 'Building Info' },
      { key: 'systems', label: 'Suppression Systems' },
      { key: 'review', label: 'Review' },
    ],
  },
  ACCESS_CONTROL: {
    label: 'Access Control Survey',
    icon: '',
    steps: [
      { key: 'building', label: 'Building Info' },
      { key: 'doors', label: 'Doors & Readers' },
      { key: 'controller', label: 'Controller' },
      { key: 'review', label: 'Review' },
    ],
  },
  BURGLAR_ALARM: {
    label: 'Burglar Alarm Survey',
    icon: '',
    steps: [
      { key: 'building', label: 'Building Info' },
      { key: 'sensors', label: 'Sensors' },
      { key: 'panel', label: 'Control Panel' },
      { key: 'review', label: 'Review' },
    ],
  },
  OTHER: {
    label: 'Other Systems Survey',
    icon: '',
    steps: [
      { key: 'building', label: 'Building Info' },
      { key: 'specs', label: 'Technical Specs' },
      { key: 'review', label: 'Review' },
    ],
  },
};

export default function SurveyWizard({ projectId, surveyType, onComplete, onBack, isDark }: Props) {
  const dark = isDark ?? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const normalizedKey = (surveyType || '').toUpperCase().replace('-', '_');
  const config = SURVEY_CONFIG[normalizedKey as keyof typeof SURVEY_CONFIG] || SURVEY_CONFIG['OTHER'];
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiBaseline, setAiBaseline] = useState<any>(null);

  useEffect(() => {
    try {
      const rawBaseline = localStorage.getItem(`aa2000_ai_baseline_${projectId}`);
      if (rawBaseline) {
        setAiBaseline(JSON.parse(rawBaseline));
      } else {
        const rawEst = localStorage.getItem(`aa2000_estimation_${projectId}`);
        if (rawEst) {
          const parsed = JSON.parse(rawEst);
          if (parsed.aiBaseline) setAiBaseline(parsed.aiBaseline);
        }
      }
    } catch (e) {}
  }, [projectId]);

  const handleApplyAiBaseline = () => {
    if (!aiBaseline) return;
    const patch: Record<string, any> = {};

    if (aiBaseline.consumables && Array.isArray(aiBaseline.consumables)) {
      const items = aiBaseline.consumables;
      const cameraItems = items.filter((c: any) => c.category === 'Camera' || c.name?.toLowerCase().includes('camera'));
      if (cameraItems.length > 0) {
        patch.indoorCameras = cameraItems.filter((c: any) => c.name?.toLowerCase().includes('dome') || c.name?.toLowerCase().includes('indoor')).reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
        patch.outdoorCameras = cameraItems.filter((c: any) => c.name?.toLowerCase().includes('bullet') || c.name?.toLowerCase().includes('outdoor')).reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
        if (!patch.indoorCameras && !patch.outdoorCameras) {
          patch.indoorCameras = cameraItems.reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
        }
      }
      const detectorItems = items.filter((c: any) => c.category === 'Detector' || c.name?.toLowerCase().includes('smoke') || c.name?.toLowerCase().includes('heat'));
      if (detectorItems.length > 0) {
        patch.smokeDetectors = detectorItems.reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
      }
      const doorItems = items.filter((c: any) => c.category === 'Access Control' || c.name?.toLowerCase().includes('reader') || c.name?.toLowerCase().includes('door'));
      if (doorItems.length > 0) {
        patch.singleDoors = doorItems.reduce((s: number, c: any) => s + (Number(c.quantity) || 0), 0);
      }
    }

    if (aiBaseline.constraints) {
      patch.physicalConstraints = aiBaseline.constraints.physical;
      patch.electricalConstraints = aiBaseline.constraints.electrical;
      patch.installationConstraints = aiBaseline.constraints.installation;
    }

    setFormData(prev => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    const loadProjectDetails = async () => {
      try {
        const svc = getDataService();
        const response = await svc.getProject(projectId);
        if (response.success && response.data) {
          const project = response.data;
          setFormData(prev => ({
            ...prev,
            floors: project.floors ?? '',
            buildingType: project.buildingType || '',
          }));
        }
      } catch (err) {
        console.error('Failed to load project details for survey:', err);
      }
    };
    loadProjectDetails();
  }, [projectId]);

  const stepsList = config?.steps || [
    { key: 'building', label: 'Building Info' },
    { key: 'specs', label: 'Technical Specs' },
    { key: 'review', label: 'Review' },
  ];

  const adjustedSteps = stepsList;

  const step = adjustedSteps[currentStep] || adjustedSteps[adjustedSteps.length - 1];
  const SurveyIconCmp = systemOptionIcons[surveyType] || systemOptionIcons['CCTV'];
  const isFirst = currentStep === 0;
  const isLast = currentStep === adjustedSteps.length - 1;

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for field when user fills it in
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const validateBuildingStep = (): boolean => {
    const required: { key: string; label: string }[] = [
      { key: 'isNew',          label: 'Is New Building' },
      { key: 'buildingType',   label: 'Building Type' },
      { key: 'buildingLength', label: 'Building Length' },
      { key: 'buildingWidth',  label: 'Building Width' },
      { key: 'floorHeight',    label: 'Floor Height' },
      { key: 'floors',         label: 'Number of Floors' },
      { key: 'roomsCount',     label: 'Number of Rooms' },
    ];
    const newErrors: Record<string, string> = {};
    for (const field of required) {
      const val = formData[field.key];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (typeof val === 'number' && isNaN(val));
      if (isEmpty) {
        newErrors[field.key] = `${field.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    // Validate Building Info step before advancing
    if (step.key === 'building' && !validateBuildingStep()) {
      return;
    }
    if (isLast) {
      const svc = getDataService();
      await svc.createSurvey({
        projectId,
        type: surveyType,
        data: { ...formData, surveyMode: 'manual' },
        status: 'Draft',
      });
      onComplete();
    } else {
      setErrors({});
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (isFirst) {
      onBack();
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: dark ? '#0B0F19' : '#f5f6fa' }}>

      {/* ── Top Header Bar ── */}
      <header style={{
        background: dark ? '#0D1527' : '#fff',
        borderBottom: dark ? '1px solid #1E293B' : '1px solid #e5e7eb',
        padding: '0 32px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: dark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={handlePrev}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 500, color: dark ? '#94A3B8' : '#6b7280',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px', borderRadius: 8,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = dark ? '#1E293B' : '#f3f4f6'; (e.currentTarget as HTMLButtonElement).style.color = dark ? '#F8FAFC' : '#1e3a5f'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = dark ? '#94A3B8' : '#6b7280'; }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {isFirst ? 'Back to Project' : 'Previous'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            {SurveyIconCmp ? <SurveyIconCmp className="w-4 h-4 text-white" /> : null}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: dark ? '#F8FAFC' : '#111827', lineHeight: 1.2 }}>{config.label}</div>
            <div style={{ fontSize: 11, color: dark ? '#94A3B8' : '#9ca3af', fontWeight: 500 }}>Site Survey Form</div>
          </div>
        </div>

        <div style={{
          fontSize: 12, fontWeight: 600, color: dark ? '#94A3B8' : '#6b7280',
          background: dark ? '#162032' : '#f9fafb', border: dark ? '1px solid #1E293B' : '1px solid #e5e7eb',
          padding: '4px 12px', borderRadius: 20,
        }}>
          Step {currentStep + 1} / {adjustedSteps.length}
        </div>
      </header>

      {/* ── Body: Sidebar + Content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left Sidebar — Step Progress ── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: dark ? '#0D1527' : '#fff',
          borderRight: dark ? '1px solid #1E293B' : '1px solid #e5e7eb',
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: dark ? '#64748B' : '#9ca3af', letterSpacing: '0.08em', marginBottom: 16, paddingLeft: 12 }}>PROGRESS</div>
          {adjustedSteps.map((s, i) => {
            const isActive = i === currentStep;
            const isPast = i < currentStep;
            return (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  background: isActive ? (dark ? 'rgba(37,99,235,0.2)' : '#eff6ff') : 'transparent',
                  borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    flexShrink: 0,
                    background: isPast ? '#16a34a' : isActive ? '#2563eb' : (dark ? '#1E293B' : '#f3f4f6'),
                    color: isPast || isActive ? '#fff' : (dark ? '#64748B' : '#9ca3af'),
                    transition: 'all 0.2s',
                  }}>
                    {isPast ? (
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isPast ? '#22c55e' : isActive ? (dark ? '#60A5FA' : '#1d4ed8') : (dark ? '#64748B' : '#9ca3af'),
                    transition: 'color 0.2s',
                  }}>{s.label}</span>
                </div>
                {i < adjustedSteps.length - 1 && (
                  <div style={{ width: 2, height: 16, background: isPast ? (dark ? '#065f46' : '#bbf7d0') : (dark ? '#1E293B' : '#f3f4f6'), marginLeft: 23, borderRadius: 2 }} />
                )}
              </div>
            );
          })}
        </aside>

        {/* ── Main Content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 100px 40px' }}>
          {/* AI Pre-Estimation Helper Banner */}
          {aiBaseline && (
            <div className={`mb-6 p-4 rounded-xl border ${dark ? 'border-indigo-900/50 bg-indigo-950/30' : 'border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-blue-50/80'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black shrink-0">
                  🤖
                </div>
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wide ${dark ? 'text-indigo-200' : 'text-slate-800'}`}>
                    AI Pre-Estimation Available for this Project
                  </h4>
                  <p className={`text-[11px] font-medium ${dark ? 'text-indigo-300/80' : 'text-slate-500'}`}>
                    Pre-populate this survey form with AI recommended hardware and device specifications as a starting baseline.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyAiBaseline}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>⚡ Apply AI Baseline</span>
              </button>
            </div>
          )}

          {/* Form card */}
          <div style={{
            background: dark ? '#131B2E' : '#fff',
            border: dark ? '1px solid #1E293B' : '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '36px 40px',
            boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {step.key === 'building' && (
              <BuildingForm data={formData} onChange={updateField} errors={errors} isDark={dark} />
            )}
            {step.key === 'cameras' && (
              <CameraForm data={formData} onChange={updateField} />
            )}
            {step.key === 'detection' && (
              <DetectionForm data={formData} onChange={updateField} />
            )}
            {step.key === 'doors' && (
              <DoorForm data={formData} onChange={updateField} />
            )}
            {step.key === 'sensors' && (
              <SensorForm data={formData} onChange={updateField} />
            )}
            {step.key === 'infrastructure' && surveyType === 'CCTV' && (
              <CCTVInfraForm data={formData} onChange={updateField} />
            )}
            {step.key === 'controller' && (
              <ControllerForm data={formData} onChange={updateField} />
            )}
            {step.key === 'panel' && (
              <PanelForm data={formData} onChange={updateField} />
            )}
            {step.key === 'systems' && (
              <SuppressionForm data={formData} onChange={updateField} />
            )}
            {step.key === 'specs' && (
              <SpecsForm data={formData} onChange={updateField} />
            )}
            {step.key === 'review' && (
              <ReviewForm data={formData} surveyType={surveyType} />
            )}
          </div>

          {/* ── Footer Actions ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 24,
            padding: '16px 0',
            paddingRight: '150px',
            borderTop: dark ? '1px solid #1E293B' : '1px solid #e5e7eb',
          }}>
            <button
              onClick={handlePrev}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: dark ? '#CBD5E1' : '#374151',
                background: dark ? '#131B2E' : '#fff', border: dark ? '1px solid #1E293B' : '1px solid #d1d5db',
                padding: '10px 20px', borderRadius: 8,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = dark ? '#1E293B' : '#f9fafb'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = dark ? '#131B2E' : '#fff'; }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {isFirst ? 'Cancel' : 'Back'}
            </button>

            <button
              onClick={handleNext}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 700, color: '#fff',
                background: '#1e3a5f',
                border: '1px solid #1e3a5f',
                padding: '10px 28px', borderRadius: 8,
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: '0 2px 8px rgba(30,58,95,0.18)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2563eb'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2563eb'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e3a5f'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e3a5f'; }}
            >
              {isLast ? 'Complete Survey' : 'Continue'}
              {!isLast && (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Sub-forms ─────────────────────────────────────────────

function BuildingForm({ data, onChange, errors = {}, isDark }: { data: any; onChange: any; errors?: Record<string, string>; isDark?: boolean }) {
  React.useEffect(() => {
    const length = Number(data.buildingLength) || 0;
    const width = Number(data.buildingWidth) || 0;
    const floors = Number(data.floors) || 0;
    if (length > 0 && width > 0) {
      const calculated = length * width * (floors > 0 ? floors : 1);
      if (data.totalFloorArea !== calculated) {
        onChange('totalFloorArea', calculated);
      }
    }
  }, [data.buildingLength, data.buildingWidth, data.floors]);

  const handleDimensionChange = (key: string, val: any) => {
    onChange(key, val);
    const numVal = typeof val === 'number' ? val : Number(val) || 0;
    const length = key === 'buildingLength' ? numVal : (Number(data.buildingLength) || 0);
    const width = key === 'buildingWidth' ? numVal : (Number(data.buildingWidth) || 0);
    const floors = key === 'floors' ? numVal : (Number(data.floors) || 0);
    if (length > 0 && width > 0) {
      onChange('totalFloorArea', length * width * (floors > 0 ? floors : 1));
    }
  };

  const fieldCls = (key: string) =>
    errors[key]
      ? 'field-err'
      : 'field-normal';

  // Inline style helpers
  const inputStyle = (key: string): React.CSSProperties => ({
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: errors[key] ? '1px solid #f87171' : (isDark ? '1px solid #1E293B' : '1px solid #d1d5db'),
    background: errors[key] ? (isDark ? '#3b1212' : '#fff5f5') : (isDark ? '#162032' : '#fff'),
    fontSize: 13,
    color: isDark ? '#F8FAFC' : '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: isDark ? '#CBD5E1' : '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  const ErrorMsg = ({ fieldKey }: { fieldKey: string }) =>
    errors[fieldKey] ? (
      <p style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="11" height="11" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {errors[fieldKey]}
      </p>
    ) : null;

  const errCount = Object.keys(errors).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: isDark ? '1px solid #1E293B' : '1px solid #f3f4f6' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#F8FAFC' : '#111827' }}>Building Information</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: isDark ? '#94A3B8' : '#6b7280' }}>Provide key structural details about the site building.</p>
        </div>
        {errCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, color: '#dc2626',
            background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
            border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid #fecaca',
            padding: '5px 12px', borderRadius: 20,
          }}>
            <svg width="11" height="11" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errCount} field{errCount > 1 ? 's' : ''} required
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
        <div>
          <label style={labelStyle}>
            Is New Building? <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            value={data.isNew ?? ''}
            onChange={e => onChange('isNew', e.target.value === 'true')}
            style={inputStyle('isNew')}
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No (Existing)</option>
          </select>
          <ErrorMsg fieldKey="isNew" />
        </div>
        <div>
          <label style={labelStyle}>
            Building Type <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            value={data.buildingType || ''}
            onChange={e => onChange('buildingType', e.target.value)}
            style={inputStyle('buildingType')}
          >
            <option value="">Select...</option>
            <option value="Office">Office</option>
            <option value="Office Building">Office Building</option>
            <option value="Retail">Retail</option>
            <option value="Mall / Retail">Mall / Retail</option>
            <option value="Warehouse">Warehouse</option>
            <option value="Warehouse / Logistics">Warehouse / Logistics</option>
            <option value="School">School</option>
            <option value="School / University">School / University</option>
            <option value="Hospital">Hospital</option>
            <option value="Hospital / Medical">Hospital / Medical</option>
            <option value="Residential">Residential</option>
            <option value="Residential / Condo">Residential / Condo</option>
            <option value="Hotel / Hospitality">Hotel / Hospitality</option>
            <option value="Government / BPO">Government / BPO</option>
            <option value="Industrial">Industrial</option>
            <option value="Industrial / Factory">Industrial / Factory</option>
            <option value="Parking Structure">Parking Structure</option>
            <option value="Data Center">Data Center</option>
            <option value="Other">Other</option>
          </select>
          <ErrorMsg fieldKey="buildingType" />
        </div>

        <div>
          <label style={labelStyle}>
            Building Length (m) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="number" min={0} step="any"
            value={data.buildingLength || ''}
            onChange={e => handleDimensionChange('buildingLength', Number(e.target.value))}
            placeholder="e.g. 50"
            style={inputStyle('buildingLength')}
          />
          <ErrorMsg fieldKey="buildingLength" />
        </div>
        <div>
          <label style={labelStyle}>
            Building Width (m) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="number" min={0} step="any"
            value={data.buildingWidth || ''}
            onChange={e => handleDimensionChange('buildingWidth', Number(e.target.value))}
            placeholder="e.g. 30"
            style={inputStyle('buildingWidth')}
          />
          <ErrorMsg fieldKey="buildingWidth" />
        </div>

        <div>
          <label style={labelStyle}>
            Total Floor Area (m²)
          </label>
          <input
            type="text"
            readOnly
            disabled
            value={data.totalFloorArea ? `${data.totalFloorArea} m²` : ''}
            placeholder="Auto-calculated"
            style={{
              ...inputStyle('totalFloorArea'),
              background: isDark ? '#0F172A' : '#f8fafc',
              color: data.totalFloorArea ? (isDark ? '#93C5FD' : '#1e293b') : (isDark ? '#64748B' : '#94A3B8'),
              fontWeight: 700,
              cursor: 'not-allowed',
              userSelect: 'none',
              border: isDark ? '1px solid #1E293B' : '1px solid #e2e8f0',
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Floor Height (m) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="number" min={0} step="any"
            value={data.floorHeight || ''}
            onChange={e => onChange('floorHeight', Number(e.target.value))}
            placeholder="e.g. 3.5"
            style={inputStyle('floorHeight')}
          />
          <ErrorMsg fieldKey="floorHeight" />
        </div>

        <div>
          <label style={labelStyle}>
            Number of Floors <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="number" min={1}
            value={data.floors && data.floors !== 0 ? data.floors : ''}
            onChange={e => handleDimensionChange('floors', e.target.value === '' ? '' as any : Number(e.target.value))}
            placeholder="e.g. 3"
            style={inputStyle('floors')}
          />
          <ErrorMsg fieldKey="floors" />
        </div>
        <div>
          <label style={labelStyle}>
            Number of Rooms <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="number" min={0}
            value={data.roomsCount || ''}
            onChange={e => onChange('roomsCount', Number(e.target.value))}
            placeholder="e.g. 12"
            style={inputStyle('roomsCount')}
          />
          <ErrorMsg fieldKey="roomsCount" />
        </div>
      </div>
    </div>
  );
}

function CameraForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Camera Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Number of Cameras</label>
          <input type="number" min={1} value={data.cameraCount ?? ''} onChange={e => onChange('cameraCount', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Resolution</label>
          <select value={data.resolution || ''} onChange={e => onChange('resolution', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="2MP">2MP (1080p)</option>
            <option value="5MP">5MP (3K)</option>
            <option value="8MP">8MP (4K)</option>
            <option value="12MP">12MP</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Camera Types</label>
          <div className="grid grid-cols-3 gap-2">
            {['Dome', 'Bullet', 'PTZ', 'Fisheye', 'Thermal', 'Box'].map(type => (
              <label key={type} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200/60 bg-white/50 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                <input type="checkbox" checked={(data.cameraTypes || []).includes(type)} onChange={e => {
                  const current = data.cameraTypes || [];
                  onChange('cameraTypes', e.target.checked ? [...current, type] : current.filter((t: string) => t !== type));
                }} className="rounded" />
                <span className="text-sm font-medium">{type}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Indoor/Outdoor</label>
          <select value={data.environment || ''} onChange={e => onChange('environment', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Indoor">Indoor</option>
            <option value="Outdoor">Outdoor</option>
            <option value="Both">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Preferred Brand</label>
          <select value={data.preferredBrand || ''} onChange={e => onChange('preferredBrand', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Hikvision">Hikvision</option>
            <option value="Dahua">Dahua</option>
            <option value="Avtech">Avtech</option>
            <option value="Bosch">Bosch</option>
            <option value="Ezviz">Ezviz</option>
            <option value="Honeywell">Honeywell</option>
            <option value="Panasonic">Panasonic</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function CCTVInfraForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Infrastructure & Cabling</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Cable Type</label>
          <select value={data.cableType || ''} onChange={e => onChange('cableType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Cat5e">Cat5e</option>
            <option value="Cat6">Cat6</option>
            <option value="Cat6a">Cat6a</option>
            <option value="Fiber">Fiber Optic</option>
            <option value="Coax">Coaxial</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Preferred Cabling Brand</label>
          <select value={data.preferredCableBrand || ''} onChange={e => onChange('preferredCableBrand', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Commscope">Commscope</option>
            <option value="Panduit">Panduit</option>
            <option value="Alantek">Alantek</option>
            <option value="Systimax">Systimax</option>
            <option value="Linkbasic">Linkbasic</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Cable Path</label>
          <select value={data.cablePath || ''} onChange={e => onChange('cablePath', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Cable Tray">Cable Tray</option>
            <option value="Conduit">Conduit</option>
            <option value="Ceiling">Ceiling Space</option>
            <option value="Underground">Underground</option>
            <option value="Wall">Wall Mounted</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Wall Type</label>
          <select value={data.wallType || ''} onChange={e => onChange('wallType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Drywall">Drywall</option>
            <option value="Concrete">Concrete</option>
            <option value="Brick">Brick</option>
            <option value="Metal">Metal</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Core Drilling Required?</label>
          <select value={data.coreDrilling ?? ''} onChange={e => onChange('coreDrilling', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Estimated Cable Length (meters)</label>
          <input type="number" min={1} value={data.cableLength || ''} onChange={e => onChange('cableLength', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
      </div>
    </div>
  );
}

function DetectionForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Detection Areas</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">System Type</label>
          <select value={data.systemType || ''} onChange={e => onChange('systemType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Conventional">Conventional</option>
            <option value="Addressable">Addressable</option>
            <option value="Wireless">Wireless</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Preferred Brand</label>
          <select value={data.preferredBrand || ''} onChange={e => onChange('preferredBrand', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select brand...</option>
            <option value="ASENWARE">ASENWARE</option>
            <option value="EDWARDS">EDWARDS</option>
            <option value="GAMEWELL BY HONEYWELL">GAMEWELL BY HONEYWELL</option>
            <option value="GST">GST</option>
            <option value="HOCHIKI">HOCHIKI</option>
            <option value="HONEYWELL">HONEYWELL</option>
            <option value="HORING-LIH">HORING-LIH</option>
            <option value="NOTIFIER">NOTIFIER</option>
            <option value="SIMPLEX">SIMPLEX</option>
            <option value="TYY">TYY</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Smoke Detectors</label>
          <input type="number" min={0} value={data.smokeDetectors ?? ''} onChange={e => onChange('smokeDetectors', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Heat Detectors</label>
          <input type="number" min={0} value={data.heatDetectors ?? ''} onChange={e => onChange('heatDetectors', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Manual Call Points</label>
          <input type="number" min={0} value={data.mcpCount ?? ''} onChange={e => onChange('mcpCount', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Sounders</label>
          <input type="number" min={0} value={data.sounders ?? ''} onChange={e => onChange('sounders', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
      </div>
    </div>
  );
}

function DoorForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Doors & Readers</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Number of Doors</label>
          <input type="number" min={1} value={data.doorCount ?? ''} onChange={e => onChange('doorCount', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Door Type</label>
          <select value={data.doorType || ''} onChange={e => onChange('doorType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Wood">Wood</option>
            <option value="Metal">Metal</option>
            <option value="Glass">Glass</option>
            <option value="Fire Rated">Fire Rated</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Reader Type</label>
          <select value={data.readerType || ''} onChange={e => onChange('readerType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Proximity">Proximity</option>
            <option value="Biometric">Biometric</option>
            <option value="Keypad">Keypad</option>
            <option value="Mobile">Mobile/Bluetooth</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Lock Type</label>
          <select value={data.lockType || ''} onChange={e => onChange('lockType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Maglock">Maglock</option>
            <option value="Strike">Electric Strike</option>
            <option value="Cable">Cable Lock</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ControllerForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Controller Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Controller Location</label>
          <input value={data.controllerLocation || ''} onChange={e => onChange('controllerLocation', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" placeholder="e.g. Server Room" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">POE Available?</label>
          <select value={data.poeAvailable ?? ''} onChange={e => onChange('poeAvailable', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">UPS Required?</label>
          <select value={data.upsRequired ?? ''} onChange={e => onChange('upsRequired', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Network Required?</label>
          <select value={data.networkRequired ?? ''} onChange={e => onChange('networkRequired', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function SensorForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Burglar Alarm Sensors</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">PIR Sensors</label>
          <input type="number" min={0} value={data.pirSensors ?? ''} onChange={e => onChange('pirSensors', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Door Contacts</label>
          <input type="number" min={0} value={data.doorContacts ?? ''} onChange={e => onChange('doorContacts', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Glass Break Sensors</label>
          <input type="number" min={0} value={data.glassBreak ?? ''} onChange={e => onChange('glassBreak', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Outdoor Sensors</label>
          <input type="number" min={0} value={data.outdoorSensors ?? ''} onChange={e => onChange('outdoorSensors', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
      </div>
    </div>
  );
}

function PanelForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Control Panel</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Panel Location</label>
          <input value={data.panelLocation || ''} onChange={e => onChange('panelLocation', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Rack Available?</label>
          <select value={data.rackAvailable ?? ''} onChange={e => onChange('rackAvailable', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Power Available?</label>
          <select value={data.powerAvailable ?? ''} onChange={e => onChange('powerAvailable', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Network Required?</label>
          <select value={data.networkRequired ?? ''} onChange={e => onChange('networkRequired', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function SuppressionForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Suppression Systems</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">System Type</label>
          <select value={data.suppressionType || ''} onChange={e => onChange('suppressionType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Sprinkler">Sprinkler System</option>
            <option value="FM200">FM200</option>
            <option value="Novec">Novec 1230</option>
            <option value="CO2">CO2 System</option>
            <option value="Foam">Foam System</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Number of Zones</label>
          <input type="number" min={1} value={data.zones ?? ''} onChange={e => onChange('zones', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Cylinders/Units</label>
          <input type="number" min={1} value={data.cylinders ?? ''} onChange={e => onChange('cylinders', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
      </div>
    </div>
  );
}

function SpecsForm({ data, onChange }: { data: any; onChange: any }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">System Specifications</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">System Type</label>
          <select value={data.otherSystemType || ''} onChange={e => onChange('otherSystemType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="Turnstile">Turnstile</option>
            <option value="Boom Barrier">Boom Barrier</option>
            <option value="Intercom">Intercom</option>
            <option value="Gate">Gate Automation</option>
            <option value="Parking">Parking System</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Description</label>
          <textarea value={data.description || ''} onChange={e => onChange('description', e.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" placeholder="Describe the system requirements..." />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Quantity</label>
          <input type="number" min={1} value={data.quantity ?? ''} onChange={e => onChange('quantity', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">Power Required?</label>
          <select value={data.powerRequired ?? ''} onChange={e => onChange('powerRequired', e.target.value === 'true')} className="w-full px-4 py-3 rounded-xl border border-slate-200/60 bg-white/50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all">
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ data, surveyType }: { data: any; surveyType: string }) {
  const LABELS: Record<string, string> = {
    isNew: 'New Building', buildingType: 'Building Type', buildingLength: 'Building Length',
    buildingWidth: 'Building Width', totalFloorArea: 'Total Floor Area', floorHeight: 'Floor Height',
    floors: 'Number of Floors', roomsCount: 'Number of Rooms', cameraCount: 'Number of Cameras',
    resolution: 'Resolution', cameraTypes: 'Camera Types', environment: 'Environment',
    preferredBrand: 'Preferred Brand', cableType: 'Cable Type', preferredCableBrand: 'Cable Brand',
    cablePath: 'Cable Path', wallType: 'Wall Type', coreDrilling: 'Core Drilling',
    cableLength: 'Cable Length', systemType: 'Fire Alarm System', smokeDetectors: 'Smoke Detectors',
    heatDetectors: 'Heat Detectors', mcpCount: 'Manual Call Points', sounders: 'Sounders',
    doorCount: 'Number of Doors', doorType: 'Door Type', readerType: 'Reader Type',
    lockType: 'Lock Type', controllerLocation: 'Controller Location', poeAvailable: 'PoE Available',
    upsRequired: 'UPS Required', networkRequired: 'Network Required', pirSensors: 'PIR Sensors',
    doorContacts: 'Door Contacts', glassBreak: 'Glass Break Sensors', outdoorSensors: 'Outdoor Sensors',
    panelLocation: 'Panel Location', rackAvailable: 'Rack Available', powerAvailable: 'Power Available',
    suppressionType: 'Suppression System', zones: 'Number of Zones', cylinders: 'Cylinders / Units',
    otherSystemType: 'System Type', description: 'Description', quantity: 'Quantity',
    powerRequired: 'Power Required',
  };

  const BOOLS: Record<string, [string, string]> = {
    isNew: ['Yes', 'No'], coreDrilling: ['Required', 'Not Required'],
    poeAvailable: ['Available', 'Not Available'], upsRequired: ['Required', 'Not Required'],
    networkRequired: ['Required', 'Not Required'], rackAvailable: ['Available', 'Not Available'],
    powerAvailable: ['Available', 'Not Available'], powerRequired: ['Required', 'Not Required'],
  };

  const UNITS: Record<string, string> = {
    buildingLength: 'm', buildingWidth: 'm', floorHeight: 'm', totalFloorArea: 'm²', cableLength: 'm',
  };

  const has = (k: string) => data[k] !== undefined && data[k] !== null && data[k] !== '';

  const renderVal = (key: string) => {
    const v = data[key];
    if (v === undefined || v === null || v === '') return null;
    if (key in BOOLS) {
      const [t, f] = BOOLS[key];
      const val = v === true || v === 'true';
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${val ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {val ? t : f}
        </span>
      );
    }
    if (key === 'cameraTypes' && Array.isArray(v)) {
      return v.length ? v.join(', ') : null;
    }
    let display = String(v);
    if (key in UNITS) {
      const n = Number(v);
      display = isNaN(n) ? `${v} ${UNITS[key]}` : `${n.toLocaleString()} ${UNITS[key]}`;
    } else if (typeof v === 'number') {
      display = v.toLocaleString();
    } else if (key === 'totalFloorArea' && !isNaN(Number(v))) {
      display = `${Number(v).toLocaleString()} m²`;
    }
    return <span className="text-sm font-semibold text-slate-800">{display}</span>;
  };

  const renderField = (key: string) => {
    const val = renderVal(key);
    if (!val) return null;
    return (
      <div key={key}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{LABELS[key] || key}</p>
        <div>{val}</div>
      </div>
    );
  };

  const sectionIconMap: Record<string, React.FC<{ className?: string }>> = {
    'Building Information': (p) => <StatBuilding className={p?.className || 'w-4 h-4'} />,
    'Camera Configuration': (p) => <SysCamera className={p?.className || 'w-4 h-4'} />,
    'Infrastructure & Cabling': (p) => <Plug className={p?.className || 'w-4 h-4'} />,
    'Detection System': (p) => <SysBell className={p?.className || 'w-4 h-4'} />,
    'Control Panel': (p) => <Sliders className={p?.className || 'w-4 h-4'} />,
    'Doors & Readers': (p) => <Door className={p?.className || 'w-4 h-4'} />,
    'Controller Configuration': (p) => <Desktop className={p?.className || 'w-4 h-4'} />,
    'Sensors': (p) => <Sensor className={p?.className || 'w-4 h-4'} />,
    'Suppression System': (p) => <Suppression className={p?.className || 'w-4 h-4'} />,
    'System Specifications': (p) => <SysGear className={p?.className || 'w-4 h-4'} />,
  };

  const Section = ({ title, fields, fullWidth }: { icon: string; title: string; fields: string[]; fullWidth?: boolean }) => {
    const visible = fields.filter(f => has(f));
    if (!visible.length) return null;
    const IconCmp = sectionIconMap[title];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-200/80">
          {IconCmp ? <IconCmp className="w-4 h-4" /> : null}
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-wide">{title}</h4>
        </div>
        {fullWidth ? (
          <div className="space-y-3">
            {visible.map(f => (
              <div key={f}>
                {renderField(f)}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {visible.map(f => renderField(f))}
          </div>
        )}
      </div>
    );
  };

  const buildingFields = ['isNew', 'buildingType', 'buildingLength', 'buildingWidth', 'totalFloorArea', 'floorHeight', 'floors', 'roomsCount'];
  const hasBuilding = buildingFields.some(f => has(f));
  if (!hasBuilding) {
    return (
      <div className="text-center py-12">
        <span className="text-3xl block mb-3"><StatClipboard className="w-5 h-5" /></span>
        <p className="text-slate-400 text-sm font-semibold">No survey data entered yet. Fill in the previous steps.</p>
      </div>
    );
  }

  const sections: { icon: string; title: string; fields: string[]; fullWidth?: boolean }[] = [
    { icon: '', title: 'Building Information', fields: buildingFields },
  ];

  if (surveyType === 'CCTV') {
    sections.push(
      { icon: '', title: 'Camera Configuration', fields: ['cameraCount', 'resolution', 'cameraTypes', 'environment', 'preferredBrand'] },
      { icon: '', title: 'Infrastructure & Cabling', fields: ['cableType', 'preferredCableBrand', 'cablePath', 'wallType', 'coreDrilling', 'cableLength'] },
    );
  } else if (surveyType === 'FIRE_ALARM') {
    sections.push(
      { icon: '', title: 'Detection System', fields: ['systemType', 'preferredBrand', 'smokeDetectors', 'heatDetectors', 'mcpCount', 'sounders'] },
      { icon: '', title: 'Control Panel', fields: ['panelLocation', 'rackAvailable', 'powerAvailable', 'networkRequired'] },
    );
  } else if (surveyType === 'ACCESS_CONTROL') {
    sections.push(
      { icon: '', title: 'Doors & Readers', fields: ['doorCount', 'doorType', 'readerType', 'lockType'] },
      { icon: '', title: 'Controller Configuration', fields: ['controllerLocation', 'poeAvailable', 'upsRequired', 'networkRequired'] },
    );
  } else if (surveyType === 'BURGLAR_ALARM') {
    sections.push(
      { icon: '', title: 'Sensors', fields: ['pirSensors', 'doorContacts', 'glassBreak', 'outdoorSensors'] },
      { icon: '', title: 'Control Panel', fields: ['panelLocation', 'rackAvailable', 'powerAvailable', 'networkRequired'] },
    );
  } else if (surveyType === 'FIRE_PROTECTION') {
    sections.push(
      { icon: '', title: 'Suppression System', fields: ['suppressionType', 'zones', 'cylinders'] },
    );
  } else if (surveyType === 'OTHER') {
    sections.push(
      { icon: '', title: 'System Specifications', fields: ['otherSystemType', 'description', 'quantity', 'powerRequired'], fullWidth: true },
    );
  }

  return (
    <div className="space-y-7">
      {sections.map((s, i) => (
        <Section key={i} {...s} />
      ))}
    </div>
  );
}

// ─── Mode Selector ─────────────────────────────────────────
function ModeSelector({ mode, onSelect }: { mode: string | null; onSelect: (m: 'ai' | 'manual') => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Choose Survey Method</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.5 }}>
        How would you like to complete this survey? You can use AI to analyze floor plans and auto-generate the bill of quantities, or fill in the details manually.
      </p>
      <div style={{ display: 'flex', gap: 20 }}>
        <button
          onClick={() => onSelect('ai')}
          style={{
            flex: 1, padding: '28px 24px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            transition: 'all 0.2s',
            border: mode === 'ai' ? '2px solid #2563eb' : '2px solid #e5e7eb',
            background: mode === 'ai' ? '#eff6ff' : '#fff',
          }}
          onMouseEnter={e => { if (mode !== 'ai') { (e.currentTarget as HTMLButtonElement).style.borderColor = '#93c5fd'; (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}}
          onMouseLeave={e => { if (mode !== 'ai') { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 17.788 16.5 19.5l-.394-1.712a3 3 0 0 0-2.394-2.394L12 15l1.712-.394a3 3 0 0 0 2.394-2.394L16.5 10.5l.394 1.712a3 3 0 0 0 2.394 2.394l1.712.394-1.712.394a3 3 0 0 0-2.394 2.394Z" />
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>AI Analysis</h3>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            Upload floor plans and let AI automatically detect rooms, cameras, detectors, and generate a complete bill of quantities.
          </p>
        </button>
        <button
          onClick={() => onSelect('manual')}
          style={{
            flex: 1, padding: '28px 24px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            transition: 'all 0.2s',
            border: mode === 'manual' ? '2px solid #2563eb' : '2px solid #e5e7eb',
            background: mode === 'manual' ? '#eff6ff' : '#fff',
          }}
          onMouseEnter={e => { if (mode !== 'manual') { (e.currentTarget as HTMLButtonElement).style.borderColor = '#93c5fd'; (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}}
          onMouseLeave={e => { if (mode !== 'manual') { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13 6 6 0 0 1-.772.215 7.5 7.5 0 0 1-.949.059h-2.2l-.82.82a.75.75 0 0 1-1.06-1.06l.82-.82v-2.2c0-.258.02-.512.059-.948.046-.252.124-.503.216-.772a4.5 4.5 0 0 1 1.129-1.898l9.136-9.136Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.75 17.25 9.75" />
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Manual Input</h3>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            Fill in all survey details manually — camera counts, detector quantities, door types, and other specifications step by step.
          </p>
        </button>
      </div>
    </div>
  );
}

// ─── AI Upload Form ──────────────────────────────────────
// ─── AI Upload Form ──────────────────────────────────────
function AiUploadForm({ data, onChange }: { data: any; onChange: any }) {
  const [files, setFiles] = useState<File[]>(data.floorPlanFiles || []);
  const [parsingId, setParsingId] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const processFiles = async (newFiles: File[]) => {
    const valid: File[] = [];
    let accumulatedText = data.torContent || '';
    const docNames: string[] = data.torFileName ? data.torFileName.split(', ') : [];

    for (const file of newFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'xls', 'xlsx', 'docx', 'doc', 'txt', 'csv'];
      if (!validExtensions.includes(ext || '')) continue;

      valid.push(file);

      // Parse document files immediately
      if (!file.type.startsWith('image/')) {
        setParsingId(file.name);
        try {
          const parsed = await parseFile(file);
          if (parsed && parsed.content) {
            accumulatedText += `\n\n=== DOCUMENT CONTENT: ${file.name} ===\n${parsed.content}\n`;
            docNames.push(file.name);
          }
        } catch (err) {
          console.error(`Error parsing document text in wizard:`, err);
        }
      }
    }

    setParsingId(null);
    const updatedFiles = [...files, ...valid];
    setFiles(updatedFiles);
    onChange('floorPlanFiles', updatedFiles);
    
    if (accumulatedText) {
      onChange('torContent', accumulatedText);
      onChange('torFileName', docNames.join(', '));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    processFiles(dropped);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      processFiles(selected);
    }
  };

  const removeFile = (i: number) => {
    const fileToRemove = files[i];
    const updated = files.filter((_, idx) => idx !== i);
    setFiles(updated);
    onChange('floorPlanFiles', updated);

    // Clean up corresponding TOR content if it was a document
    if (fileToRemove && !fileToRemove.type.startsWith('image/')) {
      let newAccumulatedText = '';
      const docNames: string[] = [];
      
      const reCompile = async () => {
        for (const file of updated) {
          if (!file.type.startsWith('image/')) {
            try {
              const parsed = await parseFile(file);
              if (parsed && parsed.content) {
                newAccumulatedText += `\n\n=== DOCUMENT CONTENT: ${file.name} ===\n${parsed.content}\n`;
                docNames.push(file.name);
              }
            } catch {}
          }
        }
        onChange('torContent', newAccumulatedText);
        onChange('torFileName', docNames.join(', '));
      };
      reCompile();
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Upload Site Survey / TOR Files</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.5 }}>
        Upload floor plan images or PDFs, and Terms of Reference (TOR) specification documents (PDF, Excel, Word, Text).
        The AI will automatically read your TOR spec files to extract hardware models, brands, and quantities for the BOQ.
      </p>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed #d1d5db', borderRadius: 12, padding: '48px 24px',
          textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
          background: '#fafafa',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd'; (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; }}
      >
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf,.pdf,.xls,.xlsx,.doc,.docx,.txt,.csv" style={{ display: 'none' }} onChange={handleSelect} />
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5} style={{ marginBottom: 12 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Drop floor plans or TOR documents here or click to browse</p>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>Supports Images, PDFs, Excel sheets, Word files, and Text specifications</p>
      </div>

      {parsingId && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Parsing text content from "{parsingId}"...
        </div>
      )}

      {files.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f, i) => {
            const isDoc = !f.type.startsWith('image/');
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: isDoc ? '#faf5ff' : '#f9fafb', border: isDoc ? '1px solid #e9d5ff' : '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isDoc ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#7e22ce" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.008-.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                    </svg>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                  {isDoc && (
                    <span style={{ fontSize: 9, fontWeight: 800, background: '#f3e8ff', color: '#6b21a8', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>TOR Document</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {files.length === 0 && (
        <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', lineHeight: 1.5 }}>
            Tip: Floor plans and specification documents help AI generate accurate BOQ hardware lists. If you don't have them, you can continue without them — AI will estimate based on building dimensions.
          </p>
        </div>
      )}
    </div>
  );
}
