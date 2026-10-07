import React, { useEffect, useState } from 'react';
import type { User, AIScanGroup, Project } from '../../App';
import type { SurveyFormData, SystemType } from './CreateSurveyForm';
import TORComparisonView from '../ai-sidebar/TORComparisonView';

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

export default function EstimationHub({ user, onNavigateToCreate, onSaveAIScan, initialMode }: Props) {
  const [selectedMode, setSelectedMode] = useState<'manual' | 'ai' | null>(initialMode ?? null);
  const [activeManualStep, setActiveManualStep] = useState<number | null>(null);
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
  const continueToSurvey = () => onNavigateToCreate?.({
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

  return (
    <div className="min-h-full w-full p-4 sm:p-6">
      {selectedMode === 'manual' ? (
        <div className="w-full space-y-6">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
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

            {onNavigateToCreate && (
              <button
                type="button"
                onClick={() => onNavigateToCreate()}
                className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-blue-500 px-5 py-2.5 text-xs font-bold text-blue-600 shadow-2xs transition-colors hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/50 sm:self-center"
              >
                <span className="text-sm font-black">+</span>
                <span>Start Manual Estimation</span>
              </button>
            )}
          </header>

          <section aria-label="Manual estimation steps" className="grid w-full min-w-0 grid-cols-3 gap-3 sm:gap-4">
            {[
              { number: 1, title: 'Project Details', description: 'Enter building type, location, floors, and assign technicians.' },
              { number: 2, title: 'System Selection', description: 'Choose which security systems to include in the estimation.' },
              { number: 3, title: 'Generate BOQ', description: 'Review and export the complete Bill of Quantities.' },
            ].map(step => (
              <button
                key={step.number}
                type="button"
                aria-pressed={activeManualStep === step.number}
                onClick={() => setActiveManualStep(step.number)}
                className={`flex min-h-24 min-w-0 items-start gap-2 rounded-lg border p-3 text-left transition-colors dark:bg-blue-950/20 sm:min-h-28 sm:gap-4 sm:p-5 ${
                  activeManualStep === step.number
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-500'
                    : 'border-blue-200/80 bg-blue-50/20 hover:border-blue-400 dark:border-blue-900/50'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow-xs sm:h-10 sm:w-10 sm:text-base">{step.number}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white sm:text-sm">{step.title}</span>
                  <span className="mt-1 block text-[11px] font-medium leading-relaxed text-blue-600 dark:text-blue-400 sm:text-xs">{step.description}</span>
                </span>
              </button>
            ))}
          </section>

          {activeManualStep === 1 && (
            <section className="rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-[#131B2E] sm:p-6">
              <h2 className="mb-5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Company &amp; Project Details
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
                  className="rounded-xl bg-blue-700 px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-800"
                >
                  Continue to System Selection
                </button>
              </div>
            </section>
          )}

          {activeManualStep === 2 && (
            <section className="rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-[#131B2E] sm:p-6">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                System Types &amp; Notes
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
                      className={`flex min-w-0 items-center gap-3 rounded-full border-2 px-3 py-2.5 text-left text-xs font-bold transition-colors sm:px-4 ${
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
                  className="rounded-xl border border-slate-200 px-6 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Back to Project Details
                </button>
                {onNavigateToCreate && (
                  <button
                    type="button"
                    onClick={continueToSurvey}
                    className="rounded-xl bg-blue-700 px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-800"
                  >
                    Start Manual Estimation
                  </button>
                )}
              </div>
            </section>
          )}

          {activeManualStep === 3 && (
            <section className="rounded-xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-[#131B2E] sm:p-6">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Generate your Bill of Quantities</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Complete project details and system selection to start building your estimate.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveManualStep(1)}
                  className="rounded-xl border border-slate-200 px-6 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Project Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveManualStep(2)}
                  className="rounded-xl border border-slate-200 px-6 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  System Selection
                </button>
                {onNavigateToCreate && (
                  <button
                    type="button"
                    onClick={continueToSurvey}
                    className="rounded-xl bg-blue-700 px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-800"
                  >
                    Start Manual Estimation
                  </button>
                )}
              </div>
            </section>
          )}

          {activeManualStep === null && (
          <section className="rounded-xl border border-blue-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5">
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
