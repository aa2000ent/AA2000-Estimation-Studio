import React, { useEffect, useState } from 'react';
import type { User, AIScanGroup, Project, SurveyType } from '../../App';
import type { SurveyFormData, SystemType } from './CreateSurveyForm';
import TORComparisonView from '../ai-sidebar/TORComparisonView';
import SurveyWizard from '../surveys/SurveyWizard';

interface Props {
  user?: User;
  projects?: Project[];
  onCreateProject?: (project: Project, keepOnHome?: boolean) => void;
  onSelectProject?: (project: Project) => void;
  onSaveAIScan?: (scan: AIScanGroup) => Promise<void>;
  onNavigateToCreate?: (data?: SurveyFormData) => void;
  isDark?: boolean;
  initialMode?: 'manual' | 'ai';
}

export default function EstimationHub({ user, onCreateProject, onSelectProject, onNavigateToCreate, onSaveAIScan, initialMode, isDark }: Props) {
  const [selectedMode, setSelectedMode] = useState<'manual' | 'ai' | null>(initialMode ?? null);
  const [activeManualStep, setActiveManualStep] = useState<number | null>(null);
  const [isSurveyWizardActive, setIsSurveyWizardActive] = useState(false);
  const [isSurveyCompleted, setIsSurveyCompleted] = useState(false);

  const [projectDetails, setProjectDetails] = useState({
    companyName: '',
    projectName: '',
    clientName: '',
    clientContactNumber: '',
    clientEmail: '',
    locationName: '',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [systemTypes, setSystemTypes] = useState<SystemType[]>([]);
  const [surveyNotes, setSurveyNotes] = useState('');
  const [, setIsDocScanning] = useState(false);

  useEffect(() => {
    setSelectedMode(initialMode ?? null);
  }, [initialMode]);

  const updateProjectDetail = (field: keyof typeof projectDetails, value: string) => {
    setProjectDetails(previous => ({
      ...previous,
      [field]: field === 'clientContactNumber' ? value.replace(/\D/g, '').slice(0, 11) : value,
    }));
  };

  const systemOptions: { type: SystemType; label: string }[] = [
    { type: 'CCTV', label: 'CCTV System' },
    { type: 'FDAS', label: 'FDAS / Fire Alarm System' },
    { type: 'ACCESS_CONTROL', label: 'Access Control System' },
    { type: 'BURGLAR_ALARM', label: 'Burglar Alarm System' },
    { type: 'DOOR_LOCK', label: 'Door Lock System' },
    { type: 'EAS_SYSTEM', label: 'EAS System' },
    { type: 'FIRE_PROTECTION', label: 'Fire Protection / Suppression' },
    { type: 'FIXED_ARM_ELEVATOR', label: 'Fixed Arm & Elevator Related' },
    { type: 'INTERCOM_NURSE_CALL', label: 'Intercom & Nurse Call System' },
    { type: 'PABX_PAGING', label: 'PABX & Paging System' },
    { type: 'PARKING_BARRIER', label: 'Parking Barrier System' },
    { type: 'POS_SYSTEM', label: 'POS System' },
    { type: 'ROOM_ALERT', label: 'Room Alert System' },
    { type: 'XRAY_SECURITY', label: 'X-Ray, Turnstile & Walk-Through' },
  ];

  const detailFields: { key: keyof typeof projectDetails; label: string; placeholder: string; type?: string; optional?: boolean }[] = [
    { key: 'companyName', label: 'Company Name', placeholder: 'e.g. ABC Corporation Philippines' },
    { key: 'projectName', label: 'Project Name', placeholder: 'e.g. Headquarters CCTV Install' },
    { key: 'clientName', label: 'Client Contact Name', placeholder: 'e.g. Juan Dela Cruz (Optional)', optional: true },
    { key: 'clientContactNumber', label: 'Client Contact Number', placeholder: 'e.g. 09171234567 (Optional)', optional: true },
    { key: 'clientEmail', label: 'Client Email Address', placeholder: 'e.g. client@email.com (Optional)', optional: true },
    { key: 'locationName', label: 'Location Name / Area', placeholder: 'e.g. Makati City, Manila' },
    { key: 'startDate', label: 'Survey Schedule Date', placeholder: '', type: 'date' },
  ];

  const isStep1Complete = projectDetails.companyName.trim() !== '' && projectDetails.projectName.trim() !== '' && projectDetails.locationName.trim() !== '';
  const isStep2Complete = systemTypes.length > 0;
  const isStep3Complete = isSurveyCompleted;

  const currentSurveyType: SurveyType =
    systemTypes.includes('CCTV') ? 'CCTV' :
    systemTypes.includes('FDAS') ? 'FIRE_ALARM' :
    systemTypes.includes('ACCESS_CONTROL') ? 'ACCESS_CONTROL' :
    systemTypes.includes('BURGLAR_ALARM') ? 'BURGLAR_ALARM' :
    systemTypes.includes('FIRE_PROTECTION') ? 'FIRE_PROTECTION' : 'OTHER';

  const handleStartWizardFlow = () => {
    setIsSurveyWizardActive(true);
    setActiveManualStep(3);
  };

  const handleSurveyComplete = () => {
    setIsSurveyWizardActive(false);
    setIsSurveyCompleted(true);
    setActiveManualStep(3);
  };

  const continueToSurvey = () => {
    const now = new Date().toISOString();
    const newProj: Project = {
      id: `project-${Date.now()}`,
      name: projectDetails.projectName || 'Manual Estimate Project',
      clientName: projectDetails.companyName || 'General Client',
      clientContactName: projectDetails.clientName,
      clientEmail: projectDetails.clientEmail,
      clientPhone: projectDetails.clientContactNumber,
      location: projectDetails.locationName || 'Project Site',
      locationName: projectDetails.locationName,
      status: 'Pending',
      startDate: projectDetails.startDate,
      assignedTechnicians: [],
      createdAt: now,
      systemTypes: systemTypes.length > 0 ? systemTypes : ['CCTV'],
    };

    if (onCreateProject) {
      onCreateProject(newProj);
    } else if (onSelectProject) {
      onSelectProject(newProj);
    } else if (onNavigateToCreate) {
      onNavigateToCreate({
        ...projectDetails,
        systemTypes,
        surveyScope: surveyNotes,
        latitude: 14.5995,
        longitude: 120.9842,
        buildingType: '',
        floors: '',
        buildingLength: '',
        buildingWidth: '',
        floorHeight: '',
      });
    }
  };

  return (
    <div className="min-h-full w-full p-4 sm:p-6">
      {selectedMode === 'manual' ? (
        <div className="w-full space-y-6">
          {/* Header without top right button */}
          <header className="flex flex-col gap-2 border-b border-slate-200 pb-5 dark:border-slate-800">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white sm:text-lg">
                  Manual Estimation
                </h1>
                <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Build a detailed Bill of Quantities (BOQ) step-by-step by entering project details, selecting security systems, and specifying room counts.
                </p>
              </div>
            </div>
          </header>

          {/* Unclickable Progress Guide Cards */}
          <section aria-label="Manual estimation progress guide" className="grid w-full min-w-0 grid-cols-3 gap-3 sm:gap-4 select-none">
            {[
              { number: 1, title: 'Project Details', description: 'Enter building type, location, floors, and assign technicians.', isComplete: isStep1Complete, isActive: activeManualStep === 1 },
              { number: 2, title: 'System Selection', description: 'Choose which security systems to include in the estimation.', isComplete: isStep2Complete, isActive: activeManualStep === 2 },
              { number: 3, title: 'Generate BOQ', description: 'Review and export the complete Bill of Quantities.', isComplete: isStep3Complete, isActive: activeManualStep === 3 || isSurveyWizardActive },
            ].map(step => (
              <div
                key={step.number}
                className={`flex min-h-24 min-w-0 items-start gap-2 rounded-2xl border p-3 text-left transition-all dark:bg-blue-950/20 sm:min-h-28 sm:gap-4 sm:p-5 ${
                  step.isComplete
                    ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/80 dark:bg-emerald-950/30'
                    : step.isActive
                    ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-blue-200/80 bg-blue-50/20 dark:border-blue-900/50'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-xs transition-colors sm:h-10 sm:w-10 sm:text-base ${
                    step.isComplete
                      ? 'bg-emerald-500'
                      : 'bg-blue-600'
                  }`}
                >
                  {step.isComplete ? '✓' : step.number}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white sm:text-sm">{step.title}</span>
                  <span className={`mt-1 block text-[11px] font-medium leading-relaxed sm:text-xs ${
                    step.isComplete ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-600 dark:text-blue-400'
                  }`}>{step.description}</span>
                </span>
              </div>
            ))}
          </section>

          {/* When to use manual estimation card */}
          <section className="rounded-2xl border border-blue-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <svg className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v.192c0 .484-.332.893-.81 1.012a12.036 12.036 0 0 1-2.88 0c-.478-.119-.81-.528-.81-1.012V18m5.25-10.875a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" />
              </svg>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                When to use manual estimation
              </h2>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                'You have a site survey report with room-by-room breakdowns',
                'Client has provided verbal requirements without floor plans',
                'You need full control over quantities and specifications',
                'Verifying or adjusting AI-generated estimates',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Start Manual Estimation Button (Transferred below When to Use card) */}
          {activeManualStep === null && (
            <div className="pt-1 flex justify-start">
              <button
                type="button"
                onClick={() => setActiveManualStep(1)}
                className="inline-flex items-center gap-2 rounded-full border border-blue-500 px-6 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors shadow-2xs cursor-pointer"
              >
                <span className="text-sm font-black">+</span>
                <span>Start Manual Estimation</span>
              </button>
            </div>
          )}

          {/* Inline Form Sections rendered below the progress cards when active */}
          {activeManualStep === 1 && (
            <section className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-[#131B2E] sm:p-6 shadow-xs animate-fade-in-up">
              <h2 className="mb-5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Step 1: Company &amp; Project Details
              </h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                {detailFields.map(field => (
                  <label key={field.key} className={`block min-w-0 ${field.key === 'clientEmail' ? 'sm:col-span-2' : ''}`}>
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {field.label}{field.optional ? ' (Optional)' : ''}
                    </span>
                    <input
                      type={field.type ?? 'text'}
                      value={projectDetails[field.key]}
                      onChange={event => updateProjectDetail(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-[#162032] dark:text-white"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveManualStep(2)}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white transition-all hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Continue to System Selection →
                </button>
              </div>
            </section>
          )}

          {activeManualStep === 2 && (
            <section className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-[#131B2E] sm:p-6 shadow-xs animate-fade-in-up">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Step 2: System Types &amp; Notes
              </h2>
              <p className="mb-5 text-xs font-semibold text-slate-400">
                Select all systems that apply — the AI will generate the correct equipment list for each.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                {systemOptions.map(option => {
                  const selected = systemTypes.includes(option.type);
                  return (
                    <button
                      key={option.type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSystemTypes(previous => selected
                        ? previous.filter(type => type !== option.type)
                        : [...previous, option.type])}
                      className={`flex min-w-0 items-center gap-3 rounded-full border-2 px-3 py-2.5 text-left text-xs font-bold transition-colors sm:px-4 cursor-pointer ${
                        selected
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <span className="min-w-0 break-words">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-5 block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Survey / Installation Notes (Optional)
                </span>
                <textarea
                  value={surveyNotes}
                  onChange={event => setSurveyNotes(event.target.value)}
                  rows={4}
                  placeholder="Any specific requirements, wiring obstacles, special zones to cover, client preferences..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-[#162032] dark:text-white"
                />
              </label>
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveManualStep(1)}
                  className="rounded-xl border border-slate-200 px-6 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Back to Project Details
                </button>
                <button
                  type="button"
                  onClick={handleStartWizardFlow}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white transition-all hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Continue to Site Survey Wizard →
                </button>
              </div>
            </section>
          )}

          {activeManualStep === 3 && isSurveyWizardActive && (
            <section className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-[#131B2E] sm:p-6 shadow-xs animate-fade-in-up">
              <SurveyWizard
                projectId="hub-manual-temp"
                surveyType={currentSurveyType}
                onComplete={handleSurveyComplete}
                onBack={() => {
                  setIsSurveyWizardActive(false);
                  setActiveManualStep(2);
                }}
                isDark={isDark}
              />
            </section>
          )}

          {activeManualStep === 3 && isSurveyCompleted && (
            <section className="rounded-2xl border border-emerald-100 bg-white p-6 dark:border-emerald-900/50 dark:bg-[#131B2E] shadow-xs space-y-4 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-black text-xl flex items-center justify-center">
                  ✓
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Manual Estimation Complete!
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    All 3 steps have been completed and verified.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsSurveyCompleted(false);
                    setActiveManualStep(1);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Create Another Manual Estimate
                </button>
                <button
                  type="button"
                  onClick={continueToSurvey}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
                >
                  Save &amp; View BOQ Summary
                </button>
              </div>
            </section>
          )}
        </div>
      ) : (
        <TORComparisonView
          userRole={user?.role}
          onSaveAIScan={onSaveAIScan}
          onScanningChange={setIsDocScanning}
        />
      )}
    </div>
  );
}
