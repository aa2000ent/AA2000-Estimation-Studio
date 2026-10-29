import React, { useState, useCallback, useRef } from 'react';
import { parseFile, type ParsedFile } from '../../services/fileParser';
import { useToast } from '../utils/Toast';
import FloorPlanSelectionSectionView from '../estimation/FloorPlanSelectionSectionView';
import DocumentRequirementsView from '../estimation/DocumentRequirementsView';
import { SYSTEM_OPTIONS, type SystemType } from '../estimation/CreateSurveyForm';
import SystemSelectionModal from '../estimation/SystemSelectionModal';
import type { SaveEstimationFn } from '../../services/estimationWizardSnapshot';
import { FileTypeIcon } from '../utils/FileTypeBadges';
import {
  FLOOR_PLAN_ACCEPT,
  REFERENCE_DOCUMENT_ACCEPT,
  isFloorPlanFile,
  isReferenceDocument,
} from '../../utils/uploadFileTypes';
import {
  analyzeFloorPlanFile,
  combineFloorPlanResults,
  analyzeEstimation,
  MAX_FLOORPLAN_FILES,
  MAX_FLOORPLAN_FILE_BYTES,
  MAX_FLOOR_PLAN_TITLE_LENGTH,
  type FloorPlanAnalyzeResult,
  type EstimationAnalyzeResult,
} from '../../services/api/estimationFlow';
import { downloadFloorPlanReport, sectionsOfResult } from '../../utils/floorPlanReportPdf';

interface FileWithContent {
  file: File;
  parsed: ParsedFile;
  loading: boolean;
  error: string | null;
}

/** One uploaded floor plan plus the title the user gives it (e.g. "Ground Floor"). */
interface FloorPlanUpload {
  file: File;
  title: string;
}

type QueueStatus = 'waiting' | 'analyzing' | 'done' | 'failed' | 'cancelled';

/** One floor plan in the analysis queue: it is analyzed on its own, in order. */
interface QueueItem {
  id: string;
  fileName: string;
  title: string;
  status: QueueStatus;
  result?: FloorPlanAnalyzeResult;
  error?: string;
  /** Shown instead of the status text, e.g. while waiting for the rate limit. */
  note?: string;
}

const queueId = (file: File) => `${file.name}:${file.size}`;

/** Waits, but stops right away when the queue is cancelled. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

interface Props {
  onScanningChange?: (scanning: boolean) => void;
  /** AI Estimation: saves the analysis to the database after collecting client details + systems. */
  onSaveEstimation?: SaveEstimationFn;
}

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
  const [floorPlanUploads, setFloorPlanUploads] = useState<FloorPlanUpload[]>([]);
  const hasFloorPlans = floorPlanUploads.length > 0;
  const [floorPlanResult, setFloorPlanResult] = useState<FloorPlanAnalyzeResult | null>(null);
  const [floorPlanLoading, setFloorPlanLoading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  // Which result cards are flipped to show their sections.
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  // The results are a deck of cards: swipe, scroll, drag or use the arrows to move between floor plans.
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const [deckDragging, setDeckDragging] = useState(false);
  const dragRef = useRef({ startY: 0, startTop: 0, moved: false, active: false });
  const [estResult, setEstResult] = useState<EstimationAnalyzeResult | null>(null);
  const [estError, setEstError] = useState('');
  const [showDocResults, setShowDocResults] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisControllerRef = useRef<AbortController | null>(null);
  // Collected BEFORE the analysis (in a modal) and passed to every endpoint
  // so the AI scopes its recommendations to the project's systems.
  const [systemTypes, setSystemTypes] = useState<SystemType[]>([]);
  const [showSystemModal, setShowSystemModal] = useState(false);

  const handleTorFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const file = fileArray[0];
    if (!isReferenceDocument(file)) {
      toast.error('Unsupported TOR file. Upload a PDF or Word document (.docx).');
      return;
    }
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
    if (!isReferenceDocument(file)) {
      toast.error('Unsupported reference file. Upload a PDF or Word document (.docx).');
      return;
    }
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

  const handleFloorPlanFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const next = [...floorPlanUploads];
    for (const file of incoming) {
      if (next.length >= MAX_FLOORPLAN_FILES) {
        toast.error(`You can upload up to ${MAX_FLOORPLAN_FILES} floor plans. Remove one to add another.`);
        break;
      }
      if (!isFloorPlanFile(file)) {
        toast.error(`"${file.name}" is not a supported floor plan. Upload a PDF, PNG, or JPG.`);
        continue;
      }
      if (file.size > MAX_FLOORPLAN_FILE_BYTES) {
        toast.error(`"${file.name}" exceeds the 12 MB file limit.`);
        continue;
      }
      if (next.some(item => item.file.name === file.name && item.file.size === file.size)) {
        toast.error(`"${file.name}" is already uploaded.`);
        continue;
      }
      next.push({ file, title: '' });
    }
    setFloorPlanUploads(next);
    setFloorPlanResult(null);
    setQueue([]);
  }, [floorPlanUploads, toast]);

  const updateFloorPlanTitle = useCallback((index: number, title: string) => {
    setFloorPlanUploads(prev => prev.map((item, i) => (i === index ? { ...item, title } : item)));
  }, []);

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
  const removeFloorPlanFile = useCallback((index: number) => {
    const removed = floorPlanUploads[index];
    setFloorPlanUploads(prev => prev.filter((_, i) => i !== index));
    if (removed) setQueue(prev => prev.filter(item => item.id !== queueId(removed.file)));
    setFloorPlanResult(null);
  }, [floorPlanUploads]);

  // Floor plans are analyzed one at a time, in order, so each plan is read on its
  // own. Every item shows its progress live, and a finished item can be opened
  // while the next ones are still running.
  const runFloorPlanQueue = useCallback(async (ids: string[]) => {
    setFloorPlanLoading(true);
    onScanningChange?.(true);
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    const patch = (id: string, change: Partial<QueueItem>) =>
      setQueue(prev => prev.map(item => (item.id === id ? { ...item, ...change } : item)));
    let analyzed = 0;
    try {
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index];
        const upload = floorPlanUploads.find(item => queueId(item.file) === id);
        if (!upload) continue;
        // The API allows one request a second.
        if (index > 0) await pause(1100, controller.signal);
        patch(id, { status: 'analyzing', error: undefined, note: undefined });
        for (let attempt = 0; ; attempt += 1) {
          try {
            const result = await analyzeFloorPlanFile(upload.file, {
              title: upload.title,
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
            }, controller.signal);
            patch(id, { status: 'done', result, note: undefined });
            analyzed += 1;
            break;
          } catch (err) {
            if (controller.signal.aborted) throw err;
            const message = err instanceof Error ? err.message : 'Floor plan analysis failed';
            if (attempt < 3 && /too many requests|rate limit/i.test(message)) {
              patch(id, { note: 'Rate limit reached. Waiting a moment, then trying again…' });
              await pause(20000, controller.signal);
              continue;
            }
            patch(id, { status: 'failed', error: message, note: undefined });
            break;
          }
        }
      }
      if (analyzed > 0) {
        toast.success(analyzed === 1 ? 'Floor plan analyzed.' : `${analyzed} floor plans analyzed.`);
      } else {
        toast.error('No floor plan could be analyzed.');
      }
    } catch {
      // Cancelled: cancelAnalysis already marked the items that were still waiting.
    } finally {
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = null;
        setFloorPlanLoading(false);
        onScanningChange?.(false);
      }
    }
  }, [floorPlanUploads, systemTypes, toast, onScanningChange]);

  const handleRunComparison = useCallback(async () => {
    if (selectedDocType === 'floor_plan') {
      if (!hasFloorPlans) {
        toast.error('Please upload a floor plan to analyze.');
        return;
      }
      const seenTitles = new Set<string>();
      for (const item of floorPlanUploads) {
        const key = item.title.trim().toLowerCase();
        if (!key) continue;
        if (seenTitles.has(key)) {
          toast.error(`Two floor plans are titled "${item.title.trim()}". Give each plan its own title.`);
          return;
        }
        seenTitles.add(key);
      }
      if (systemTypes.length === 0) {
        setShowSystemModal(true);
        return;
      }

      const items: QueueItem[] = floorPlanUploads.map(upload => ({
        id: queueId(upload.file),
        fileName: upload.file.name,
        title: upload.title.trim(),
        status: 'waiting',
      }));
      setQueue(items);
      setFloorPlanResult(null);
      void runFloorPlanQueue(items.map(item => item.id));
      return;
    }

    const activeFile = selectedDocType === 'proposal' ? proposalFile : torFile;
    if (!activeFile) {
      toast.error('Please select or upload a document to analyze.');
      return;
    }
    if (systemTypes.length === 0) {
      setShowSystemModal(true);
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

    setAnalyzing(true);
    setEstResult(null);
    setEstError('');
    onScanningChange?.(true);
    const controller = new AbortController();
    analysisControllerRef.current = controller;

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
      }, controller.signal);
      setEstResult(result);
      setShowDocResults(true);
      toast.success('Requirements extracted from the document!');
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Requirements extraction failed.';
        setEstError(message);
        toast.error(message);
      }
    } finally {
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = null;
        setAnalyzing(false);
        onScanningChange?.(false);
      }
    }
  }, [selectedDocType, torFile, proposalFile, floorPlanUploads, hasFloorPlans, runFloorPlanQueue, systemTypes, toast, onScanningChange]);

  const cancelAnalysis = () => {
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    setFloorPlanLoading(false);
    setAnalyzing(false);
    setQueue(prev => prev.map(item =>
      item.status === 'waiting' || item.status === 'analyzing'
        ? { ...item, status: 'cancelled', note: undefined }
        : item
    ));
    onScanningChange?.(false);
  };

  const doneItems = queue.filter(item => item.status === 'done' && item.result);
  const doneUploads = floorPlanUploads.filter(upload => doneItems.some(item => item.id === queueId(upload.file)));
  const analyzingItem = queue.find(item => item.status === 'analyzing');
  const finishedCount = queue.filter(item => item.status === 'done' || item.status === 'failed').length;

  const goToCard = (index: number) => {
    const count = doneItems.length;
    const el = deckRef.current;
    if (count === 0 || !el) return;
    const next = Math.max(0, Math.min(count - 1, index));
    el.scrollTo({ top: next * el.clientHeight, behavior: 'smooth' });
    setDeckIndex(next);
  };

  const onDeckScroll = () => {
    const el = deckRef.current;
    if (!el || deckDragging) return;
    setDeckIndex(Math.round(el.scrollTop / Math.max(el.clientHeight, 1)));
  };

  const onDeckKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      goToCard(deckIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      goToCard(deckIndex - 1);
    }
  };

  // Touch and trackpads scroll the deck natively; a mouse can drag it.
  const onDeckPointerDown = (e: React.PointerEvent) => {
    const el = deckRef.current;
    if (e.pointerType !== 'mouse' || !el || (e.target as HTMLElement).closest('button')) return;
    dragRef.current = { startY: e.clientY, startTop: el.scrollTop, moved: false, active: true };
  };

  const onDeckPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const el = deckRef.current;
    if (!drag.active || !el) return;
    const delta = drag.startY - e.clientY;
    if (!drag.moved && Math.abs(delta) > 6) {
      drag.moved = true;
      setDeckDragging(true);
    }
    if (drag.moved) el.scrollTop = drag.startTop + delta;
  };

  const endDeckDrag = () => {
    const drag = dragRef.current;
    const el = deckRef.current;
    if (!drag.active) return;
    drag.active = false;
    setDeckDragging(false);
    if (drag.moved && el) goToCard(Math.round(el.scrollTop / Math.max(el.clientHeight, 1)));
    // Let the click that ends a drag pass before cards can flip again.
    setTimeout(() => { dragRef.current.moved = false; }, 0);
  };

  // Continue with every plan that finished: their results are joined for the
  // section-selection step.
  const continueToSections = () => {
    const results = doneItems.map(item => item.result!).filter(Boolean);
    if (results.length === 0) return;
    setFloorPlanResult(combineFloorPlanResults(results));
    setShowFloorPlanSelection(true);
  };

  const downloadReport = async (item: QueueItem) => {
    if (!item.result) return;
    try {
      await downloadFloorPlanReport({
        title: item.title,
        fileName: item.fileName,
        result: item.result,
        systems: systemTypes.map(type => SYSTEM_OPTIONS.find(option => option.type === type)?.label ?? type),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the PDF.');
    }
  };

  const currentFile = selectedDocType === 'proposal' ? proposalFile : torFile;

  if (showFloorPlanSelection) {
    return (
      <FloorPlanSelectionSectionView
        result={floorPlanResult}
        uploadedFiles={doneUploads.map(item => item.file)}
        floorPlans={doneUploads
          .map(item => ({ fileName: item.file.name, title: item.title.trim() }))
          .filter(label => label.title)}
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
      <div className={`relative flex w-full flex-col items-center justify-center gap-3 rounded-xl px-4 text-center sm:px-8 ${
        floorPlanLoading || analyzing
          ? 'min-h-[420px] border border-blue-900/60 bg-[#131B2E] py-12'
          : 'border-2 border-dashed border-blue-200 bg-blue-50/10 py-8 dark:border-blue-900/60 dark:bg-blue-950/10 sm:py-10'
      }`}>
        {floorPlanLoading || analyzing ? (
          <>
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-950/50 text-blue-300">
              <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4zm2 5.29A7.96 7.96 0 0 1 4 12H0c0 3.04 1.13 5.82 3 7.94l3-2.65z" />
              </svg>
            </span>
            <h3 className="text-xl font-black text-white">
              Analyzing document
            </h3>
            <p className="max-w-md text-sm font-medium text-blue-200" aria-live="polite">
              {floorPlanLoading
                ? `Analyzing ${analyzingItem ? `"${analyzingItem.title || analyzingItem.fileName}"` : 'the floor plans'} — ${finishedCount} of ${queue.length} finished. Each floor plan is analyzed on its own.`
                : 'Extracting system requirements and reviewing the document…'}
            </p>
            <button
              type="button"
              onClick={cancelAnalysis}
              className="mt-5 rounded-full border border-slate-700 px-7 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:border-red-900 hover:bg-red-950/30 hover:text-red-300"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
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
            {selectedDocType === 'floor_plan' ? (
              <div className="mt-2 flex w-full max-w-2xl flex-col gap-2">
                {floorPlanUploads.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-white p-3 px-4 text-left shadow-xs dark:border-blue-900 dark:bg-[#131B2E]"
                  >
                    <div className="flex items-center gap-3">
                      <FileTypeIcon fileName={item.file.name} />
                      <span className="min-w-0 flex-1 break-all text-xs font-bold text-slate-800 dark:text-white">
                        {item.file.name}
                        <span className="ml-2 font-semibold text-slate-400">
                          {item.file.size < 1024 * 1024
                            ? `${Math.max(1, Math.round(item.file.size / 1024))} KB`
                            : `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFloorPlanFile(index)}
                        className="shrink-0 text-slate-400 hover:text-red-500 text-xs font-bold cursor-pointer"
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={item.title}
                      maxLength={MAX_FLOOR_PLAN_TITLE_LENGTH}
                      onChange={e => updateFloorPlanTitle(index, e.target.value)}
                      placeholder="Floor plan title, e.g. Ground Floor, 2nd Floor Mezzanine, Roof Deck"
                      aria-label={`Title for ${item.file.name}`}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                ))}
                {floorPlanUploads.length < MAX_FLOORPLAN_FILES && (
                  <label className="mx-auto mt-1 px-6 py-3 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer inline-flex items-center gap-2">
                    <span>{hasFloorPlans ? '+ Add another floor plan' : 'Open File / Select from Device'}</span>
                    <input
                      type="file"
                      multiple
                      accept={FLOOR_PLAN_ACCEPT}
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) handleFloorPlanFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                {hasFloorPlans && (
                  <p className="text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Titles are optional, but tell the AI which floor each plan shows.
                  </p>
                )}
              </div>
            ) : currentFile ? (
              <div className="mt-2 flex w-full max-w-2xl items-center gap-3 rounded-xl border border-blue-200 bg-white p-3 px-4 shadow-xs dark:border-blue-900 dark:bg-[#131B2E]">
                <span className="min-w-0 flex-1 break-all text-left text-xs font-bold text-slate-800 dark:text-white">{currentFile.parsed.fileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDocType === 'proposal') removeProposalFile();
                    else removeTorFile();
                  }}
                  className="shrink-0 text-slate-400 hover:text-red-500 text-xs font-bold cursor-pointer"
                >
                  ✕ Remove
                </button>
                <FileTypeIcon fileName={currentFile.file.name} />
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
                    accept={REFERENCE_DOCUMENT_ACCEPT}
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        if (selectedDocType === 'proposal') {
                          handleProposalFiles(e.target.files);
                        } else {
                          handleTorFiles(e.target.files);
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            )}

            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-2">
              {selectedDocType === 'floor_plan'
                ? `Accepted floor plans: PDF, PNG, JPG — up to ${MAX_FLOORPLAN_FILES} plans, 12 MB each`
                : 'Accepted TOR / reference documents: PDF, DOCX'}
            </p>
          </>
        )}
      </div>

      {/* System Types — selection happens in a modal, before the analysis */}
      {!floorPlanLoading && !analyzing && (
      <button
        type="button"
        onClick={() => setShowSystemModal(true)}
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-blue-300 dark:border-slate-800 dark:bg-[#131B2E] dark:hover:border-blue-800 sm:p-5 cursor-pointer"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            System Types *
          </p>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
            {systemTypes.length === 0 ? 'Choose systems' : 'Change'}
          </p>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {systemTypes.length === 0
            ? 'None selected — open the modal to pick the systems for this project.'
            : `${systemTypes.length} selected: ${systemTypes
                .map(t => SYSTEM_OPTIONS.find(o => o.type === t)?.label ?? t)
                .join(', ')}`}
        </p>
        <p className="mt-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          Selected before analysis so the AI recommends requirements for this project's systems.
        </p>
      </button>
      )}

      {/* Action Footer */}
      {!floorPlanLoading && !analyzing && (
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {systemTypes.length === 0
            ? 'Select at least one system type to enable AI analysis'
            : selectedDocType === 'floor_plan'
              ? hasFloorPlans
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
              ? !hasFloorPlans || floorPlanLoading
              : !currentFile || analyzing)
          }
          className={`flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-bold transition-all cursor-pointer sm:w-auto ${
            systemTypes.length > 0 &&
            (selectedDocType === 'floor_plan' ? hasFloorPlans : currentFile) &&
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
      )}

      {/* Floor plan queue: live progress on the left, finished results on the right */}
      {selectedDocType === 'floor_plan' && queue.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#131B2E] sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Analysis queue</p>
              <p className="text-[10px] font-bold text-slate-400">{finishedCount} of {queue.length} finished</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(finishedCount / queue.length) * 100}%` }}
              />
            </div>
            <ol className="mt-3 space-y-2">
              {queue.map((item, index) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 ${
                    item.status === 'analyzing'
                      ? 'border-blue-400 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30'
                      : item.status === 'done'
                        ? 'border-emerald-200 dark:border-emerald-900/60'
                        : item.status === 'failed'
                          ? 'border-red-200 dark:border-red-900/60'
                          : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {item.status === 'analyzing' ? (
                      <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4z" />
                      </svg>
                    ) : item.status === 'done' ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[12px] font-black text-white">✓</span>
                    ) : item.status === 'failed' ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[12px] font-black text-white">✕</span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-400 dark:bg-slate-800">{index + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-white">{item.title || item.fileName}</p>
                    <p className={`text-[10px] font-medium ${item.status === 'failed' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                      {item.note
                        ? item.note
                        : item.status === 'waiting'
                          ? 'Waiting in the queue'
                          : item.status === 'analyzing'
                            ? 'Analyzing this floor plan…'
                            : item.status === 'done'
                              ? `Done — ${sectionsOfResult(item.result).length} sections found`
                              : item.status === 'cancelled'
                                ? 'Cancelled'
                                : item.error || 'Analysis failed'}
                    </p>
                  </div>
                  {item.status === 'failed' && !floorPlanLoading && (
                    <button
                      type="button"
                      onClick={() => void runFloorPlanQueue([item.id])}
                      className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-red-700 cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Results by floor plan</p>
            {doneItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Finished floor plans appear here one by one, while the others are still being analyzed.
              </p>
            ) : (
              <div>
                <div className="flex gap-2">
                  <div
                    ref={deckRef}
                    tabIndex={0}
                    onScroll={onDeckScroll}
                    onKeyDown={onDeckKeyDown}
                    onPointerDown={onDeckPointerDown}
                    onPointerMove={onDeckPointerMove}
                    onPointerUp={endDeckDrag}
                    onPointerLeave={endDeckDrag}
                    onPointerCancel={endDeckDrag}
                    aria-label="Floor plan results. Swipe or use the up and down arrow keys to move between floor plans."
                    className={'h-64 flex-1 overflow-y-auto rounded-2xl outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' + (deckDragging ? 'cursor-grabbing select-none snap-none' : 'snap-y snap-mandatory')}
                  >
              {doneItems.map(item => {
                const sections = sectionsOfResult(item.result);
                const summary = item.result?.summary;
                const isFlipped = Boolean(flipped[item.id]);
                const flip = () => {
                  if (dragRef.current.moved) return;
                  setFlipped(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                };
                const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
                const stats: [string, string][] = [
                  ['Sections', String(sections.length)],
                  ['Rooms', String(summary?.totalRooms ?? 0)],
                  ['Corridors', String(summary?.totalCorridors ?? 0)],
                  ['Total area', `${summary?.totalArea ?? 0} ${summary?.unit || 'sqm'}`],
                ];
                return (
                  // Flash card: the front shows the floor plan at a glance, the back lists its sections.
                  <div key={item.id} className="h-64 snap-start snap-always py-1 [perspective:1200px]">
                    <div
                      className={`relative h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                        isFlipped ? '[transform:rotateY(180deg)]' : ''
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={isFlipped ? -1 : 0}
                        onClick={flip}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            flip();
                          }
                        }}
                        aria-label={`${item.title || item.fileName}: show sections`}
                        className="absolute inset-0 flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow [backface-visibility:hidden] hover:shadow-md dark:border-slate-800 dark:bg-[#131B2E]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-slate-900 dark:text-white">{item.title || item.fileName}</p>
                            <p className="truncate text-[10px] font-medium text-slate-400">{item.fileName}</p>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              void downloadReport(item);
                            }}
                            className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 cursor-pointer"
                          >
                            ⬇ Download PDF
                          </button>
                        </div>
                        <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
                          {stats.map(([label, value]) => (
                            <div key={label} className="flex flex-col justify-center rounded-xl bg-slate-50 px-3 dark:bg-slate-900">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                              <span className="text-lg font-black text-slate-900 dark:text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Tap the card to see its {plural(sections.length, 'section')} ↻
                        </p>
                      </div>

                      <div
                        onClick={flip}
                        aria-hidden={!isFlipped}
                        className="absolute inset-0 flex cursor-pointer flex-col rounded-2xl border border-blue-300 bg-blue-50 p-4 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-blue-800 dark:bg-blue-950/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                            {item.title || item.fileName} — {plural(sections.length, 'section')}
                          </p>
                          <button
                            type="button"
                            tabIndex={isFlipped ? 0 : -1}
                            onClick={e => {
                              e.stopPropagation();
                              void downloadReport(item);
                            }}
                            className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 cursor-pointer"
                          >
                            ⬇ PDF
                          </button>
                        </div>
                        <ul
                          onClick={e => e.stopPropagation()}
                          className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1"
                        >
                          {sections.map(section => (
                            <li
                              key={section.sectionId}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-[11px] dark:bg-slate-900"
                            >
                              <span className="truncate font-bold text-slate-800 dark:text-slate-100">{section.label || section.sectionId}</span>
                              <span className="shrink-0 font-semibold text-slate-500 dark:text-slate-400">
                                {section.area !== undefined ? `${section.area} ${section.unit || 'sqm'}` : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-center text-[10px] font-bold text-blue-600 dark:text-blue-400">Tap the card to flip back ↻</p>
                      </div>
                    </div>
                  </div>
                );
              })}
                  </div>
                  <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToCard(deckIndex - 1)}
                      disabled={deckIndex <= 0}
                      aria-label="Previous floor plan"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      ▲
                    </button>
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">{Math.min(deckIndex + 1, doneItems.length)}/{doneItems.length}</span>
                    <button
                      type="button"
                      onClick={() => goToCard(deckIndex + 1)}
                      disabled={deckIndex >= doneItems.length - 1}
                      aria-label="Next floor plan"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      ▼
                    </button>
                  </div>
                </div>
                {doneItems.length > 1 && (
                  <p className="mt-1 text-center text-[10px] font-semibold text-slate-400">Swipe up or down for the next floor plan</p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={continueToSections}
              disabled={floorPlanLoading || doneItems.length === 0}
              className={`rounded-full px-6 py-3 text-xs font-bold transition-all ${
                floorPlanLoading || doneItems.length === 0
                  ? 'cursor-not-allowed bg-blue-50 text-blue-300 dark:bg-blue-950/40 dark:text-blue-700'
                  : 'cursor-pointer bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700'
              }`}
            >
              {floorPlanLoading
                ? 'Waiting for the queue to finish…'
                : `Continue — select areas (${doneItems.length} floor plan${doneItems.length === 1 ? '' : 's'})`}
            </button>
          </div>
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

      {/* System selection modal (pre-analysis scope for every endpoint) */}
      <SystemSelectionModal
        open={showSystemModal}
        onClose={() => setShowSystemModal(false)}
        onConfirm={selected => {
          setSystemTypes(selected);
          setShowSystemModal(false);
        }}
        selected={systemTypes}
      />
    </div>
  );
}