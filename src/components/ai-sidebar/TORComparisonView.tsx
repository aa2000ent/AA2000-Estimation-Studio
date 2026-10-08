import React, { useState, useCallback } from 'react';
import { parseFile, type ParsedFile } from '../../services/fileParser';
import { useToast } from '../utils/Toast';
import FloorPlanSelectionSectionView from '../estimation/FloorPlanSelectionSectionView';
import DocumentRequirementsView from '../estimation/DocumentRequirementsView';
import { SYSTEM_OPTIONS, type SystemType } from '../estimation/CreateSurveyForm';
import { Check, systemBadgeIcons } from '../../utils/Icons';
import type { SaveEstimationFn } from '../../services/estimationWizardSnapshot';
import {
  analyzeFloorPlan,
  analyzeEstimation,
  type FloorPlanAnalyzeResult,
  type EstimationAnalyzeResult,
} from '../../services/api/estimationFlow';

interface FileWithContent {
  file: File;
  parsed: ParsedFile;
  loading: boolean;
  error: string | null;
}

interface Props {
  onScanningChange?: (scanning: boolean) => void;
  /** AI Estimation: saves the analysis to the database after collecting client details + systems. */
  onSaveEstimation?: SaveEstimationFn;
}

const ANALYSIS_STEPS = [
  'Reading & parsing the uploaded document...',
  'Extracting requirements & system specifications...',
  'Matching products against the AA2000 catalog...',
  'Computing manpower, materials, fees & schedule...',
  'Building scope of works, constraints & risk assessment...',
];

// Backend supplemental-doc cap (services/Applications/ESTIMATION/supplementalDocs.js).
const SUPPLEMENTAL_CONTENT_CHARS = 6000;

// API #3 payload per system bucket. Only the buckets matching the user's
// pre-analysis system selection end up enabled (see buildDocSystems), so the
// AI scopes its requirements to the project. The detail fields say
// "per document" instead of a fabricated quantity so the prompt does not
// present invented counts as facts.
const DOC_SYSTEMS = {
  CCTV: { enabled: true, cameraCount: 'per document', resolution: 'per document', environment: 'per document' },
  FDAS: { enabled: true, systemType: 'per document', smokeDetectors: 'per document', heatDetectors: 'per document', mcpCount: 'per document', sounders: 'per document' },
  ACCESS_CONTROL: { enabled: true, doorCount: 'per document', doorType: 'per document', readerType: 'per document', lockType: 'per document' },
  BURGLAR_ALARM: { enabled: true, pirSensors: 'per document', doorContacts: 'per document', glassBreak: 'per document', outdoorSensors: 'per document' },
  FIRE_PROTECTION: { enabled: true, suppressionType: 'per document', zones: 'per document', cylinders: 'per document' },
  OTHER: { enabled: true },
};

// Non-core SystemType values roll up into API #3's OTHER bucket
// (same mapping as CreateEstimationFlow's OTHER_SYSTEM_TYPES).
const OTHER_SYSTEM_TYPES: SystemType[] = [
  'DOOR_LOCK', 'EAS_SYSTEM', 'FIXED_ARM_ELEVATOR', 'INTERCOM_NURSE_CALL',
  'PABX_PAGING', 'PARKING_BARRIER', 'POS_SYSTEM', 'ROOM_ALERT', 'XRAY_SECURITY',
];

/** Selected systems -> API #3 `systems` payload (only the selection is enabled). */
function buildDocSystems(selected: SystemType[]): Record<string, Record<string, unknown>> {
  const set = new Set(selected);
  const hasOther = OTHER_SYSTEM_TYPES.some(t => set.has(t));
  const out: Record<string, Record<string, unknown>> = {};
  (Object.keys(DOC_SYSTEMS) as (keyof typeof DOC_SYSTEMS)[]).forEach(key => {
    out[key] = {
      ...DOC_SYSTEMS[key],
      enabled: key === 'OTHER' ? hasOther : set.has(key as SystemType),
    };
  });
  return out;
}

// siteInfo.buildingType is required by API #3; the document is the only source
// of project facts here, so infer the building type from its text.
const BUILDING_TYPE_KEYWORDS: [string, string][] = [
  ['data center', 'Data Center'],
  ['university', 'School / University'],
  ['school', 'School'],
  ['hospital', 'Hospital / Medical'],
  ['warehouse', 'Warehouse / Logistics'],
  ['hotel', 'Hotel / Hospitality'],
  ['condominium', 'Residential / Condo'],
  ['condo', 'Residential / Condo'],
  ['residential', 'Residential'],
  ['mall', 'Mall / Retail'],
  ['retail', 'Retail'],
  ['factory', 'Industrial / Factory'],
  ['industrial', 'Industrial'],
  ['parking', 'Parking Structure'],
  ['government', 'Government / BPO'],
  ['bpo', 'Government / BPO'],
  ['office', 'Office'],
];

function inferBuildingType(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, buildingType] of BUILDING_TYPE_KEYWORDS) {
    if (lower.includes(keyword)) return buildingType;
  }
  return 'Office';
}

export default function TORComparisonView({ onScanningChange, onSaveEstimation }: Props) {
  const { toast } = useToast();
  const [selectedDocType, setSelectedDocType] = useState<'floor_plan' | 'tor' | 'proposal'>('floor_plan');
  const [showFloorPlanSelection, setShowFloorPlanSelection] = useState(false);
  const [torFile, setTorFile] = useState<FileWithContent | null>(null);
  const [proposalFile, setProposalFile] = useState<FileWithContent | null>(null);
  const [floorPlanFile, setFloorPlanFile] = useState<FileWithContent | null>(null);
  const [floorPlanResult, setFloorPlanResult] = useState<FloorPlanAnalyzeResult | null>(null);
  const [floorPlanLoading, setFloorPlanLoading] = useState(false);
  const [estResult, setEstResult] = useState<EstimationAnalyzeResult | null>(null);
  const [estError, setEstError] = useState('');
  const [showDocResults, setShowDocResults] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  // Collected BEFORE the analysis and passed to every endpoint so the AI scopes
  // its recommendations to the project's systems.
  const [systemTypes, setSystemTypes] = useState<SystemType[]>([]);

  const toggleSystemType = (type: SystemType) =>
    setSystemTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );

  const handleTorFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const file = fileArray[0];
    setTorFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: true, error: null });
    setEstResult(null);
    setEstError('');
    setShowDocResults(false);
    try {
      const parsed = await parseFile(file);
      setTorFile({ file, parsed, loading: false, error: null });
      toast.success(`Document "${file.name}" loaded successfully`);
    } catch (err) {
      setTorFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: false, error: 'Failed to parse file' });
      toast.error(`Failed to parse document: ${err}`);
    }
  }, [toast]);

  const handleProposalFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const file = fileArray[0];
    setProposalFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: true, error: null });
    setEstResult(null);
    setEstError('');
    setShowDocResults(false);
    try {
      const parsed = await parseFile(file);
      setProposalFile({ file, parsed, loading: false, error: null });
      toast.success(`Proposal "${file.name}" loaded successfully`);
    } catch (err) {
      setProposalFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: false, error: 'Failed to parse file' });
      toast.error(`Failed to parse proposal: ${err}`);
    }
  }, [toast]);

  const handleFloorPlanFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const file = fileArray[0];
    setFloorPlanFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: true, error: null });
    setFloorPlanResult(null);
    try {
      const parsed = await parseFile(file);
      setFloorPlanFile({ file, parsed, loading: false, error: null });
      toast.success(`Floor plan "${file.name}" loaded successfully`);
    } catch (err) {
      setFloorPlanFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: false, error: 'Failed to parse file' });
      toast.error(`Failed to parse floor plan: ${err}`);
    }
  }, [toast]);

  const removeTorFile = useCallback(() => {
    setTorFile(null);
    setEstResult(null);
    setEstError('');
    setShowDocResults(false);
  }, []);
  const removeProposalFile = useCallback(() => {
    setProposalFile(null);
    setEstResult(null);
    setEstError('');
    setShowDocResults(false);
  }, []);
  const removeFloorPlanFile = useCallback(() => {
    setFloorPlanFile(null);
    setFloorPlanResult(null);
  }, []);

  const handleRunComparison = useCallback(async () => {
    if (selectedDocType === 'floor_plan') {
      if (!floorPlanFile) {
        toast.error('Please upload a floor plan to analyze.');
        return;
      }
      if (systemTypes.length === 0) {
        toast.error('Select at least one system type before the analysis.');
        return;
      }

      setFloorPlanLoading(true);
      setFloorPlanResult(null);
      onScanningChange?.(true);
      try {
        const result = await analyzeFloorPlan({
          files: [floorPlanFile.file],
          // Selected systems reach the prompt as "System types of interest".
          projectContext: { systemTypes },
          analysisOptions: {
            extractDimensions: true,
            extractAnnotations: true,
            detectSystems: true,
            classifyRooms: true,
            outputFormat: 'structured',
            coordinateSystem: 'meters',
          },
        });
        setFloorPlanResult(result);
        setShowFloorPlanSelection(true);
        toast.success('Floor plan analyzed — sections extracted!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Floor plan analysis failed');
      } finally {
        setFloorPlanLoading(false);
        onScanningChange?.(false);
      }
      return;
    }

    const activeFile = selectedDocType === 'proposal' ? proposalFile : torFile;
    if (!activeFile) {
      toast.error('Please select or upload a document to analyze.');
      return;
    }
    if (systemTypes.length === 0) {
      toast.error('Select at least one system type before the analysis.');
      return;
    }

    // API #3 has no OCR: the requirements must come from readable document text.
    const content = (activeFile.parsed.content || '').trim();
    const unreadable =
      !content ||
      activeFile.parsed.error !== undefined ||
      /^\[(Unsupported file type|Error parsing file)/.test(content);
    if (unreadable) {
      toast.error(
        `No readable text in "${activeFile.parsed.fileName}" — upload a text-based PDF, DOCX or XLSX so the requirements can be extracted.`
      );
      return;
    }

    setAnalysisStep(0);
    setAnalyzing(true);
    setEstResult(null);
    setEstError('');
    onScanningChange?.(true);

    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);

    try {
      const result = await analyzeEstimation({
        siteInfo: {
          buildingType: inferBuildingType(content),
          locationName: 'the Philippines',
          surveyScope: `Requirements for ${systemTypes.join(', ')} extracted from ${activeFile.parsed.fileName}`,
        },
        // Only the pre-analysis selection is enabled — scopes the prompt,
        // the catalog lookup and the recommendations to the project.
        systems: buildDocSystems(systemTypes),
        clientContext: {
          projectName: activeFile.parsed.fileName,
          budgetTier: 'standard',
          prioritySystems: systemTypes,
          existingInfrastructure: false,
        },
        supplementalDocuments: [
          {
            name: activeFile.parsed.fileName,
            content: content.slice(0, SUPPLEMENTAL_CONTENT_CHARS),
          },
        ],
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
      setShowDocResults(true);
      toast.success('Requirements extracted from the document!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Requirements extraction failed.';
      setEstError(message);
      toast.error(message);
    } finally {
      clearInterval(stepInterval);
      setAnalyzing(false);
      onScanningChange?.(false);
    }
  }, [selectedDocType, torFile, proposalFile, floorPlanFile, systemTypes, toast, onScanningChange]);

  const currentFile =
    selectedDocType === 'proposal'
      ? proposalFile
      : selectedDocType === 'floor_plan'
        ? floorPlanFile
        : torFile;

  if (showFloorPlanSelection) {
    return (
      <FloorPlanSelectionSectionView
        result={floorPlanResult}
        onSaveEstimation={onSaveEstimation}
        initialSystemTypes={systemTypes}
        onBackToDocument={() => setShowFloorPlanSelection(false)}
      />
    );
  }

  // Same interface as the floorplan module's results view — section selection skipped.
  if (showDocResults && estResult) {
    return (
      <DocumentRequirementsView
        result={estResult}
        fileName={currentFile?.parsed.fileName}
        docType={selectedDocType === 'proposal' ? 'proposal' : 'tor'}
        onSaveEstimation={onSaveEstimation}
        initialSystemTypes={systemTypes}
        onBackToDocument={() => setShowDocResults(false)}
        onReanalyze={() => {
          setShowDocResults(false);
          handleRunComparison();
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col space-y-6 transition-colors">
      {/* Section Title */}
      <div className="flex min-w-0 items-start gap-3">
        <span className="pt-0.5 text-lg text-blue-600 dark:text-blue-400">✨</span>
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">AI Document Reader</h2>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Upload TORs, proposals, or floor plans to extract requirements and generate BOQs.
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-900/50 dark:bg-blue-950/30 sm:px-5">
        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
          Upload a <span className="font-bold">Floor Plan, Terms of Reference (TOR), or Proposal.</span> AI reads your document first. For floor plans, choose the sections where AA2000 items will be installed.
        </p>
      </div>

      {/* "What document do you have?" Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          What document do you have?
        </h3>
        <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:gap-4">
          {/* Card 1: Floor Plan */}
          <div
            onClick={() => setSelectedDocType('floor_plan')}
            className={`flex min-h-36 min-w-0 cursor-pointer flex-col justify-between rounded-xl p-3 transition-all duration-200 sm:p-5 ${
              selectedDocType === 'floor_plan'
                ? 'border-2 border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-blue-300'
            }`}
          >
            <div>
              <svg className="mb-2 h-5 w-5 text-blue-600 dark:text-blue-400 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5 4 6v13.5l5-1.5 6 1.5 5-1.5V4.5l-5 1.5-6-1.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v13.5M15 6v13.5" />
              </svg>
              <h4 className="break-words text-xs font-bold text-slate-900 dark:text-white sm:text-sm">Floor Plan</h4>
              <p className="mt-1 break-words text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xs">
                Identify rooms and select installation areas.
              </p>
            </div>
            <div className="mt-2">
              {selectedDocType === 'floor_plan' ? (
                <span className="flex items-center gap-1 break-words text-[10px] font-bold text-blue-600 dark:text-blue-400 sm:text-xs">✓ Selected</span>
              ) : (
                <span className="break-words text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400 sm:text-xs">Select document type</span>
              )}
            </div>
          </div>

          {/* Card 2: Terms of Reference */}
          <div
            onClick={() => setSelectedDocType('tor')}
            className={`flex min-h-36 min-w-0 cursor-pointer flex-col justify-between rounded-xl p-3 transition-all duration-200 sm:p-5 ${
              selectedDocType === 'tor'
                ? 'border-2 border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-blue-300'
            }`}
          >
            <div>
              <svg className="mb-2 h-5 w-5 text-blue-600 dark:text-blue-400 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4.5M9 12h6M9 15h6" />
              </svg>
              <h4 className="break-words text-xs font-bold text-slate-900 dark:text-white sm:text-sm">Terms of Reference</h4>
              <p className="mt-1 break-words text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xs">
                Extract the required systems and specifications.
              </p>
            </div>
            <div className="mt-2">
              {selectedDocType === 'tor' ? (
                <span className="flex items-center gap-1 break-words text-[10px] font-bold text-blue-600 dark:text-blue-400 sm:text-xs">✓ Selected</span>
              ) : (
                <span className="break-words text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400 sm:text-xs">Select document type</span>
              )}
            </div>
          </div>

          {/* Card 3: Proposal */}
          <div
            onClick={() => setSelectedDocType('proposal')}
            className={`flex min-h-36 min-w-0 cursor-pointer flex-col justify-between rounded-xl p-3 transition-all duration-200 sm:p-5 ${
              selectedDocType === 'proposal'
                ? 'border-2 border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-blue-300'
            }`}
          >
            <div>
              <svg className="mb-2 h-5 w-5 text-blue-600 dark:text-blue-400 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4.5M9.5 13.5h5M12 11v5" />
              </svg>
              <h4 className="break-words text-xs font-bold text-slate-900 dark:text-white sm:text-sm">Proposal</h4>
              <p className="mt-1 break-words text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xs">
                Review proposed equipment and quantities.
              </p>
            </div>
            <div className="mt-2">
              {selectedDocType === 'proposal' ? (
                <span className="flex items-center gap-1 break-words text-[10px] font-bold text-blue-600 dark:text-blue-400 sm:text-xs">✓ Selected</span>
              ) : (
                <span className="break-words text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400 sm:text-xs">Select document type</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashed Upload Dropzone Box */}
      <div className="relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/10 px-4 py-8 text-center dark:border-blue-900/60 dark:bg-blue-950/10 sm:px-8 sm:py-10">
        
        <h3 className="text-lg font-black text-blue-600 dark:text-blue-400">
          {selectedDocType === 'floor_plan'
            ? 'Upload Floor Plan'
            : selectedDocType === 'tor'
            ? 'Upload Terms of Reference'
            : 'Upload Proposal'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-md">
          {selectedDocType === 'floor_plan'
            ? 'Upload a floor plan to identify rooms and installation sections.'
            : selectedDocType === 'tor'
            ? 'Upload a TOR document to extract specifications and hardware counts.'
            : 'Upload a proposal to review proposed equipment and quantities.'}
        </p>

        {/* Active file or upload button */}
        {currentFile ? (
          <div className="mt-2 flex w-full max-w-2xl flex-wrap items-center justify-center gap-3 rounded-xl border border-blue-200 bg-white p-3 px-5 shadow-xs dark:border-blue-900 dark:bg-[#131B2E]">
            <span className="min-w-0 break-all text-center text-xs font-bold text-slate-800 dark:text-white">{currentFile.parsed.fileName}</span>
            <button
              type="button"
              onClick={() => {
                if (selectedDocType === 'proposal') removeProposalFile();
                else if (selectedDocType === 'floor_plan') removeFloorPlanFile();
                else removeTorFile();
              }}
              className="text-slate-400 hover:text-red-500 text-xs font-bold cursor-pointer"
            >
              ✕ Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 mt-2">
            <label className="px-6 py-3 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Open File / Select from Device</span>
              <input
                type="file"
                accept={
                  selectedDocType === 'floor_plan'
                    ? '.pdf,.png,.jpg,.jpeg,.gif,.webp'
                    : '.pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg'
                }
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    if (selectedDocType === 'proposal') {
                      handleProposalFiles(e.target.files);
                    } else if (selectedDocType === 'floor_plan') {
                      handleFloorPlanFiles(e.target.files);
                    } else {
                      handleTorFiles(e.target.files);
                    }
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (selectedDocType === 'floor_plan') {
                  setShowFloorPlanSelection(true);
                } else {
                  toast.info('Sample document loaded!');
                }
              }}
              className="px-5 py-2 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
            >
              Try Sample Floor Plan
            </button>
          </div>
        )}

        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-2">
          {selectedDocType === 'floor_plan'
            ? 'PDF, PNG, JPG, GIF, WEBP • Sections extracted by /api/floorplan/analyze'
            : 'PDF, DOCX, XLSX • Requirements extracted by /service/estimation/ai/analyze'}
        </p>
      </div>

      {/* System Types — collected BEFORE the analysis and sent to the endpoint */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#131B2E] sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            System Types *
          </p>
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            Selected before analysis so the AI recommends requirements for this project's systems.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEM_OPTIONS.map(opt => {
            const selected = systemTypes.includes(opt.type);
            const IconComp = systemBadgeIcons[opt.type];
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => toggleSystemType(opt.type)}
                className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all cursor-pointer ${
                  selected
                    ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/60'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-800'
                }`}
              >
                <span className={`shrink-0 ${selected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {IconComp ? <IconComp className="h-4 w-4" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[11px] font-black ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {opt.label}
                  </span>
                  {selected && (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-blue-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      SELECTED <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {systemTypes.length === 0
            ? 'Select at least one system type to enable AI analysis.'
            : `${systemTypes.length} system type${systemTypes.length === 1 ? '' : 's'} selected.`}
        </p>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {systemTypes.length === 0
            ? 'Select at least one system type to enable AI analysis'
            : selectedDocType === 'floor_plan'
              ? floorPlanFile
                ? 'Floor plan ready for AI analysis'
                : 'Upload a floor plan to enable AI analysis'
              : currentFile
                ? 'Document ready for AI analysis'
                : 'Choose a document to enable AI analysis'}
        </span>
        <button
          onClick={handleRunComparison}
          disabled={
            systemTypes.length === 0 ||
            (selectedDocType === 'floor_plan'
              ? !floorPlanFile || floorPlanLoading
              : !currentFile || analyzing)
          }
          className={`flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-bold transition-all cursor-pointer sm:w-auto ${
            systemTypes.length > 0 &&
            (selectedDocType === 'floor_plan' ? floorPlanFile : currentFile) &&
            !floorPlanLoading &&
            !analyzing
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-300 dark:text-blue-700 cursor-not-allowed'
          }`}
        >
          <span>✨</span>
          <span>
            {floorPlanLoading
              ? 'Analyzing Floor Plan...'
              : analyzing
                ? 'Extracting Requirements...'
                : 'Analyze Document'}
          </span>
        </button>
      </div>

      {/* Floor plan analysis progress */}
      {floorPlanLoading && (
        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/90 via-blue-50/40 to-indigo-50/30 p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5 4 6v13.5l5-1.5 6 1.5 5-1.5V4.5l-5 1.5-6-1.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v13.5M15 6v13.5" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  Floor Plan Analysis in Progress
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 uppercase tracking-wider">
                    Neural Engine
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Extracting rooms, corridors, vertical circulation &amp; utility areas...
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-blue-700 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
              POST /api/floorplan/analyze
            </span>
          </div>
        </div>
      )}

      {/* Requirements extraction progress (API #3) */}
      {analyzing && (
        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/90 via-blue-50/40 to-indigo-50/30 p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  Extracting Requirements in Progress
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 uppercase tracking-wider">
                    Neural Engine
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Reading the document and generating requirements, BOQ, manpower &amp; schedule...
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-blue-700 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
              Step {analysisStep + 1} of {ANALYSIS_STEPS.length}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-blue-700/80 mt-3">
            {ANALYSIS_STEPS[analysisStep]}
          </p>
        </div>
      )}

      {/* Requirements extraction error */}
      {estError && !analyzing && (
        <div className="p-3.5 px-4 bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 font-semibold leading-relaxed flex items-start justify-between gap-3">
          <span>{estError}</span>
          <button
            type="button"
            onClick={handleRunComparison}
            className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}