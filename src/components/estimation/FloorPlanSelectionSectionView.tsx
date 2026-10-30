import { useEffect, useState, useMemo, useRef } from 'react';
import type { Project } from '../../App';
import {
  extractSectionRequirements,
  type FloorPlanAnalyzeResult,
  type FloorPlanLabel,
  type FloorPlanSection,
  type SectionRequirementsResult,
} from '../../services/api/estimationFlow';
import { SYSTEM_OPTIONS, type SystemType } from './CreateSurveyForm';
import { SectionRequirementsPanel } from './EstimationAiPanels';
import { buildFloorPlanPreviews, type FloorPlanImage } from '../../utils/floorPlanPreviews';
import SystemSelectionModal from './SystemSelectionModal';
import SaveEstimationModal from './SaveEstimationModal';
import { useToast } from '../utils/Toast';
import type {
  EstimationFlowAiContext,
  SaveEstimationFn,
} from '../../services/estimationWizardSnapshot';

interface PlanSection {
  id: string;
  name: string;
  category: string;
  area?: number;
  unit?: string;
  confidence?: number;
  selected: boolean;
  floorTitle?: string;
  pageNumber?: number;
  /** Original section payload from /api/floorplan/analyze (API #2 input). */
  raw?: FloorPlanSection;
}

interface Html2PdfWorker {
  set(options: {
    margin: number;
    image: { type: string; quality: number };
    html2canvas: { scale: number; useCORS: boolean };
    jsPDF: { unit: string; format: string; orientation: string };
  }): Html2PdfWorker;
  from(source: HTMLElement): Html2PdfWorker;
  outputPdf(type: 'blob'): Promise<Blob>;
}

type Html2PdfFactory = () => Html2PdfWorker;

function getEstimationPdfFilename(date = new Date()): string {
  const dateStamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return `${dateStamp}_estimation.pdf`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
}

async function createRequirementsPdf(
  requirements: SectionRequirementsResult | null,
  sectionLabel: string,
  selectedSystems: SystemType[]
): Promise<Blob> {
  const getPdfGenerator = () =>
    (window as Window & { html2pdf?: Html2PdfFactory }).html2pdf;
  if (!getPdfGenerator()) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the PDF generator. Check your connection and try again.'));
      document.head.appendChild(script);
    });
  }
  const pdfGenerator = getPdfGenerator();
  if (!pdfGenerator) {
    throw new Error('The PDF generator did not load. Check your connection and try again.');
  }

  const requirementEntries = Object.entries(requirements?.requirements || {});
  const normalizedRequirementKeys = new Set(
    requirementEntries.map(([system]) => system.replace(/[^a-z0-9]/gi, '').toLowerCase())
  );
  selectedSystems.forEach(type => {
    const key = SYSTEM_OPTIONS.find(option => option.type === type)?.label || type;
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!normalizedRequirementKeys.has(normalizedKey)) {
      requirementEntries.push([
        key,
        {
          required: true,
          coverage: 'Selected for this project. No system-specific AI details were returned.',
        },
      ]);
    }
  });
  const requirementRows = requirementEntries.map(([system, details]) => {
    const detailText = Object.entries(details)
      .filter(([key, value]) => key !== 'required' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' · ');
    return `<tr><td>${escapeHtml(system)}</td><td>${details.required ? 'Required' : 'Optional'}</td><td>${escapeHtml(detailText)}</td></tr>`;
  }).join('');
  const materialRows = (requirements?.materials || []).map(material => `
    <tr><td>${escapeHtml(material.name || material.description || 'Material')}</td><td>${escapeHtml(material.category || '')}</td><td>${escapeHtml(`${material.quantity ?? 0} ${material.unit || ''}`)}</td><td>${escapeHtml(material.unitPrice ?? material.srp ?? '')}</td><td>${escapeHtml(material.totalPrice ?? '')}</td></tr>
  `).join('');
  const manpowerRows = (requirements?.manpower || []).map(person => `
    <tr><td>${escapeHtml(person.role || 'Role')}</td><td>${escapeHtml(person.headcount ?? '')}</td><td>${escapeHtml(person.hours ?? '')}</td><td>${escapeHtml(person.manDays ?? '')}</td><td>${escapeHtml(person.totalCost ?? '')}</td></tr>
  `).join('');
  const scopeRows = (requirements?.scopeOfWorks || []).map(item => `
    <tr><td>${escapeHtml(item.itemNumber ?? '')}</td><td>${escapeHtml(item.description || '')}</td><td>${escapeHtml(item.unit || '')}</td><td>${escapeHtml(item.totalPrice ?? '')}</td></tr>
  `).join('');
  const constraints = requirements?.constraints;
  const complianceRows = (requirements?.compliance?.gaps || []).map(gap => `
    <tr><td>${escapeHtml(gap.system || '')}</td><td>${escapeHtml(gap.requirement || '')}</td><td>${escapeHtml(gap.status || '')}</td><td>${escapeHtml(gap.recommendation || '')}</td></tr>
  `).join('');
  const recommendationRows = (requirements?.recommendations || []).map(item => `
    <tr><td>${escapeHtml(item.priority || '')}</td><td>${escapeHtml(item.system || '')}</td><td>${escapeHtml(item.action || '')}</td><td>${escapeHtml(item.estimatedCost ?? '')}</td></tr>
  `).join('');
  const html = `
    <div style="width:794px;padding:42px;box-sizing:border-box;background:#fff;color:#172033;font:14px Arial,sans-serif">
      <div style="padding:22px 26px;background:#1e3a8a;color:#fff">
        <div style="font-size:12px;font-weight:bold;letter-spacing:2px">AA2000 ESTIMATION STUDIO</div>
        <h1 style="margin:10px 0 4px;font-size:28px;font-weight:900">Estimation</h1>
        <div style="font-size:13px;opacity:.88">System requirements for ${escapeHtml(sectionLabel)}</div>
      </div>
      <p style="margin:18px 0 6px"><b>Prepared:</b> ${escapeHtml(new Date().toLocaleDateString())}</p>
      <p style="margin:0 0 18px"><b>Selected systems:</b> ${escapeHtml(selectedSystems.map(type => SYSTEM_OPTIONS.find(option => option.type === type)?.label || type).join(', ') || 'Not specified')}</p>
      <div style="display:flex;gap:10px;margin:16px 0">
        <div style="flex:1;padding:10px;border:1px solid #dbe2ea;background:#f8fafc"><b>Confidence</b><br>${escapeHtml(requirements?.confidenceScore === undefined ? '—' : `${requirements.confidenceScore}%`)}</div>
        <div style="flex:1;padding:10px;border:1px solid #dbe2ea;background:#f8fafc"><b>Reviewed material estimate</b><br>${escapeHtml(`${requirements?.materialSummary?.currency || 'PHP'} ${Number(requirements?.materialSummary?.totalEstimatedCost || 0).toLocaleString()}`)}</div>
        <div style="flex:1;padding:10px;border:1px solid #dbe2ea;background:#f8fafc"><b>Labor hours</b><br>${escapeHtml(requirements?.laborEstimates?.totalHours ?? '—')}</div>
      </div>
      <h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">System requirements</h2>
      ${requirementRows ? `<table><thead><tr><th>System</th><th>Need</th><th>Reviewed requirements / coverage</th></tr></thead><tbody>${requirementRows}</tbody></table>` : '<p>No system requirements were included in the review.</p>'}
      <h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">Materials</h2>
      ${materialRows ? `<table><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Unit price</th><th>Reviewed total</th></tr></thead><tbody>${materialRows}</tbody></table>` : '<p>No materials were included in the review.</p>'}
      <h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">Manpower</h2>
      ${manpowerRows ? `<table><thead><tr><th>Role</th><th>Headcount</th><th>Hours</th><th>Man-days</th><th>Reviewed total</th></tr></thead><tbody>${manpowerRows}</tbody></table>` : '<p>No manpower rows were included in the review.</p>'}
      <h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">Scope of works</h2>
      ${scopeRows ? `<table><thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Reviewed total</th></tr></thead><tbody>${scopeRows}</tbody></table>` : '<p>No scope items were included in the review.</p>'}
      ${complianceRows ? `<h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">Compliance review</h2><table><thead><tr><th>System</th><th>Requirement</th><th>Status</th><th>Recommendation</th></tr></thead><tbody>${complianceRows}</tbody></table>` : ''}
      <h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">AI suggestions</h2>
      ${recommendationRows ? `<table><thead><tr><th>Priority</th><th>System</th><th>Action</th><th>Estimated cost</th></tr></thead><tbody>${recommendationRows}</tbody></table>` : '<p>No separate AI suggestions were returned.</p>'}
      ${constraints ? `<h2 style="margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #2563eb;font-size:17px">Constraints and notes</h2>
        <p><b>Physical:</b> ${escapeHtml(constraints.physical || '—')}</p>
        <p><b>Electrical:</b> ${escapeHtml(constraints.electrical || '—')}</p>
        <p><b>Installation:</b> ${escapeHtml(constraints.installation || '—')}</p>` : ''}
      <p style="margin-top:30px;padding-top:10px;border-top:1px solid #cbd5e1;color:#64748b;font-size:10px">Generated from the reviewed section requirements. Confirm site conditions and final quantities before installation.</p>
      <style>
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{padding:8px;border:1px solid #dbe2ea;vertical-align:top;text-align:left}
        th{background:#eff6ff;font-weight:bold}
      </style>
    </div>`;
  const outer = document.createElement('div');
  Object.assign(outer.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '794px',
    height: '1px',
    overflow: 'hidden',
    zIndex: '99999',
    pointerEvents: 'none',
  });
  const container = document.createElement('div');
  container.innerHTML = html;
  Object.assign(container.style, {
    width: '794px',
    boxSizing: 'border-box',
    background: '#fff',
    fontFamily: 'Arial, sans-serif',
    color: '#172033',
  });
  outer.appendChild(container);
  document.body.appendChild(outer);
  try {
    const blob = await pdfGenerator()
      .set({
        margin: 0,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .outputPdf('blob');
    const signature = await blob.slice(0, 5).text();
    if (blob.size === 0 || signature !== '%PDF-') {
      throw new Error('The generated summary is not a valid PDF. Please try again.');
    }
    return blob;
  } finally {
    outer.remove();
  }
}

interface Props {
  onBackToDocument?: () => void;
  isDark?: boolean;
  /** Result of POST /api/floorplan/analyze — extracted sections drive the UI. */
  result?: FloorPlanAnalyzeResult | null;
  /** Original uploaded floor plan, previewed alongside the extracted sections. */
  uploadedFile?: File;
  /** All uploaded floor plans (multi-floor); previewed one at a time. */
  uploadedFiles?: File[];
  /** Titles the user gave each plan, sent to the AI with every follow-up call. */
  floorPlans?: FloorPlanLabel[];
  /** Persists the floor-plan analysis to the database (wizard form in a modal). */
  onSaveEstimation?: SaveEstimationFn;
  /** Systems picked before the analysis — prefills the save form. */
  initialSystemTypes?: SystemType[];
  projects?: Project[];
}

function buildSections(
  result: FloorPlanAnalyzeResult | null | undefined,
  floorPlans?: FloorPlanLabel[],
  previewFiles?: File[]
): PlanSection[] {
  if (!result?.pages || result.pages.length === 0) {
    return [];
  }

  const sections: PlanSection[] = [];
  result.pages.forEach((page, pageIdx) => {
    const floorTitle =
      page.title?.trim() ||
      floorPlans?.[pageIdx]?.title?.trim() ||
      floorPlans?.find(fp => fp.fileName === result.fileInfo?.fileName)?.title?.trim() ||
      (previewFiles?.[pageIdx] ? (floorPlans?.find(f => f.fileName === previewFiles![pageIdx].name)?.title || previewFiles![pageIdx].name.replace(/\.[^/.]+$/, '')) : '') ||
      (page.floorNumber !== undefined && page.floorNumber > 0
        ? `Floor ${page.floorNumber}`
        : `Floor Plan #${page.pageNumber || pageIdx + 1}`);

    const groups: [string, typeof page.sections][] = [
      ['Rooms / Sections', page.sections],
      ['Corridors', page.corridors],
      ['Vertical Circulation', page.verticalCirculation],
      ['Utility Areas', page.utilityAreas],
    ];
    groups.forEach(([category, items]) => {
      (items || []).forEach(item => {
        sections.push({
          id: item.sectionId,
          name: item.label || item.sectionId,
          category,
          area: item.area,
          unit: item.unit,
          confidence:
            item.confidence !== undefined
              ? item.confidence <= 1
                ? Math.round(item.confidence * 100)
                : Math.round(item.confidence)
              : undefined,
          selected: false,
          raw: item,
          floorTitle,
          pageNumber: page.pageNumber || pageIdx + 1,
        });
      });
    });
  });
  return sections;
}

const SAMPLE_SECTIONS: PlanSection[] = [
  { id: 'lobby', name: 'Lobby', category: 'Rooms / Sections', selected: false, floorTitle: 'Ground Floor' },
  { id: 'office', name: 'Office', category: 'Rooms / Sections', selected: false, floorTitle: 'Ground Floor' },
  { id: 'meeting', name: 'Meeting Room', category: 'Rooms / Sections', selected: false, floorTitle: '2nd Floor' },
  { id: 'storage', name: 'Storage', category: 'Rooms / Sections', selected: false, floorTitle: '2nd Floor' },
];

export default function FloorPlanSelectionSectionView({
  onBackToDocument,
  isDark = false,
  result = null,
  uploadedFile,
  uploadedFiles,
  floorPlans,
  onSaveEstimation,
  initialSystemTypes,
  projects,
}: Props) {
  const { toast } = useToast();
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const previewFiles = uploadedFiles && uploadedFiles.length > 0 ? uploadedFiles : uploadedFile ? [uploadedFile] : [];
  const [previewIndex, setPreviewIndex] = useState(0);
  const activeFile = previewFiles[Math.min(previewIndex, Math.max(previewFiles.length - 1, 0))];
  const titleFor = (file: File) => floorPlans?.find(label => label.fileName === file.name)?.title || file.name;

  useEffect(() => {
    if (!activeFile) {
      setUploadedFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(activeFile);
    setUploadedFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeFile]);

  // Wizard steps: 2 = Select areas, 3 = Review, 4 = Summary
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);

  // Previews of every uploaded plan, saved with the estimation for the PDF report
  const [floorPlanImages, setFloorPlanImages] = useState<FloorPlanImage[]>([]);
  const previewKey = previewFiles.map(file => `${file.name}:${file.size}:${titleFor(file)}`).join('|');
  useEffect(() => {
    let active = true;
    if (previewFiles.length === 0) {
      setFloorPlanImages([]);
      return;
    }
    buildFloorPlanPreviews(previewFiles, titleFor).then(images => { if (active) setFloorPlanImages(images); });
    return () => { active = false; };
  }, [previewKey]);

  // Step 2 State — real sections extracted by /api/floorplan/analyze
  const [sections, setSections] = useState<PlanSection[]>(() =>
    result?.pages && result.pages.length > 0
      ? buildSections(result, floorPlans, previewFiles)
      : SAMPLE_SECTIONS.map(s => ({ ...s }))
  );

  const lastResultKeyRef = useRef<string | null>(
    result?.requestId || result?.analyzedAt || (result?.pages?.length ? 'initial-result' : null)
  );

  useEffect(() => {
    const currentKey = result?.requestId || result?.analyzedAt || (result?.pages?.length ? 'result-loaded' : null);
    if (currentKey && currentKey !== lastResultKeyRef.current) {
      lastResultKeyRef.current = currentKey;
      if (result?.pages && result.pages.length > 0) {
        setSections(buildSections(result, floorPlans, previewFiles));
      }
    }
  }, [result?.requestId, result?.analyzedAt, result?.pages?.length]);

  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');

  // Groups detected sections by floor plan
  const floorGroups = useMemo(() => {
    const map = new Map<string, { floorTitle: string; pageNumber?: number; items: PlanSection[] }>();
    sections.forEach(section => {
      const title = section.floorTitle || 'Floor Plan';
      if (!map.has(title)) {
        map.set(title, {
          floorTitle: title,
          pageNumber: section.pageNumber,
          items: [],
        });
      }
      map.get(title)!.items.push(section);
    });
    return Array.from(map.values());
  }, [sections]);

  const uniqueFloorTitles = useMemo(() => {
    return floorGroups.map(g => g.floorTitle);
  }, [floorGroups]);

  const filteredFloorGroups = useMemo(() => {
    if (selectedFloorFilter === 'all') return floorGroups;
    return floorGroups.filter(g => g.floorTitle === selectedFloorFilter);
  }, [floorGroups, selectedFloorFilter]);

  // API #2 — POST /service/estimation/ai/section/requirements
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqResult, setReqResult] = useState<SectionRequirementsResult | null>(null);
  const [analyzedSectionId, setAnalyzedSectionId] = useState<string | null>(null);
  const [analyzedPayload, setAnalyzedPayload] = useState<FloorPlanSection | null>(null);

  // Save-to-database (wizard client details + system selection, in a modal)
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dbSaved, setDbSaved] = useState(false);
  const [dbSaveMessage, setDbSaveMessage] = useState('');
  const [activeSystemTypes, setActiveSystemTypes] = useState<SystemType[]>(initialSystemTypes || []);
  const [showAddSystemsModal, setShowAddSystemsModal] = useState(false);
  const [summaryPdfUrl, setSummaryPdfUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    if (!summaryPdfUrl) return;
    return () => URL.revokeObjectURL(summaryPdfUrl);
  }, [summaryPdfUrl]);

  // Toggle single section (supports multi-selection / checking list)
  const toggleSection = (id: string) => {
    if (reqLoading) return;
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
    setReqError('');
  };

  // Sections currently visible according to floor filter
  const visibleSections = useMemo(() => {
    if (selectedFloorFilter === 'all') return sections;
    return sections.filter(s => (s.floorTitle || 'Floor Plan') === selectedFloorFilter);
  }, [sections, selectedFloorFilter]);

  const isAllChecked = useMemo(() => {
    return visibleSections.length > 0 && visibleSections.every(s => s.selected);
  }, [visibleSections]);

  // Toggle all sections in the current view
  const handleToggleAll = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (reqLoading || sections.length === 0) return;
    const shouldSelect = !isAllChecked;

    setSections(prev =>
      prev.map(s => {
        if (selectedFloorFilter === 'all' || (s.floorTitle || 'Floor Plan') === selectedFloorFilter) {
          return { ...s, selected: shouldSelect };
        }
        return s;
      })
    );
    setReqError('');
  };

  // Toggle all sections in a specific floor group
  const handleToggleFloorGroup = (floorTitle: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (reqLoading) return;
    const groupSections = sections.filter(s => (s.floorTitle || 'Floor Plan') === floorTitle);
    const allInGroupSelected = groupSections.length > 0 && groupSections.every(s => s.selected);
    const shouldSelect = !allInGroupSelected;

    setSections(prev =>
      prev.map(s =>
        (s.floorTitle || 'Floor Plan') === floorTitle
          ? { ...s, selected: shouldSelect }
          : s
      )
    );
    setReqError('');
  };

  const selectedSections = sections.filter(s => s.selected);
  const selectedCount = selectedSections.length;
  const isSample = !result;

  const totalSelectedArea = useMemo(() => {
    const sum = selectedSections.reduce((acc, s) => acc + (s.area || 0), 0);
    return Math.round(sum * 10) / 10;
  }, [selectedSections]);

  const handleAnalyzeSections = async () => {
    if (selectedCount === 0 || reqLoading) return;

    let targetSection: FloorPlanSection;
    let sectionCacheKey: string;

    if (selectedSections.length === 1) {
      const single = selectedSections[0];
      targetSection = single.raw ?? {
        sectionId: single.id,
        type: 'room',
        label: single.name,
        area: single.area,
        unit: single.unit,
      };
      sectionCacheKey = single.id;
    } else {
      const totalArea = selectedSections.reduce((sum, s) => sum + (s.area || 0), 0);
      const unit = selectedSections[0]?.unit || 'sqm';
      const distinctFloors = Array.from(
        new Set(selectedSections.map(s => s.floorTitle).filter(Boolean))
      );
      const isAll = selectedSections.length === sections.length;
      const combinedLabel = isAll
        ? `All Detected Sections (${selectedSections.length} areas)`
        : `${selectedSections.length} Selected Areas (${selectedSections.map(s => s.name).slice(0, 3).join(', ')}${selectedSections.length > 3 ? '…' : ''})`;

      targetSection = {
        sectionId: `combined-${selectedSections.map(s => s.id).join('-').slice(0, 50)}`,
        type: 'room',
        subType: distinctFloors.length === 1 ? `Multi-room (${distinctFloors[0]})` : 'Entire Facility',
        label: combinedLabel,
        area: totalArea > 0 ? Math.round(totalArea * 10) / 10 : undefined,
        unit,
        annotations: selectedSections.map(
          s => `${s.floorTitle ? `[${s.floorTitle}] ` : ''}${s.name}${s.area ? ` (${s.area} ${s.unit || 'sqm'})` : ''}`
        ),
      };
      sectionCacheKey = targetSection.sectionId;
    }

    // Already analyzed this exact section/set — reopen results without extra call
    if (reqResult && analyzedSectionId === sectionCacheKey) {
      setStep(3);
      return;
    }

    setReqLoading(true);
    setReqError('');
    try {
      // Distinct floor numbers found in the analyzed pages (0 = unknown).
      const floors = new Set(
        (result?.pages ?? [])
          .map(p => p.floorNumber)
          .filter((n): n is number => typeof n === 'number')
      ).size;

      const requirements = await extractSectionRequirements({
        section: targetSection,
        floorPlans,
        projectContext: {
          systemTypes: activeSystemTypes,
          ...(floors > 0 ? { floors } : {}),
        },
        analysisOptions: {
          includeCatalogMatches: true,
          includeLaborEstimates: true,
          includeMaterialAlternates: true,
          includeCodeReferences: true,
          market: 'philippines',
          currency: 'PHP',
        },
      });
      setReqResult(requirements);
      setAnalyzedSectionId(sectionCacheKey);
      setAnalyzedPayload(targetSection);

      setStep(3);
    } catch (err) {
      setReqError(
        err instanceof Error ? err.message : 'Section requirements extraction failed.'
      );
    } finally {
      setReqLoading(false);
    }
  };

  const addSystemsToRequirements = async (nextSystems: SystemType[]) => {
    const addedSystems = nextSystems.filter(type => !activeSystemTypes.includes(type));
    setShowAddSystemsModal(false);
    if (addedSystems.length === 0) {
      toast.info('Select at least one additional system.');
      return;
    }
    const targetSection =
      analyzedPayload ||
      sections.find(item => item.id === analyzedSectionId)?.raw ||
      (analyzedSectionId ? {
        sectionId: analyzedSectionId,
        type: 'room',
        label: 'Selected section',
      } : null);

    if (!targetSection || !reqResult) {
      toast.error('Section requirements are not available. Analyze the section again.');
      return;
    }

    setReqLoading(true);
    setReqError('');
    try {
      const updatedRequirements = await extractSectionRequirements({
        section: targetSection,
        floorPlans,
        projectContext: { systemTypes: nextSystems },
        analysisOptions: {
          includeCatalogMatches: true,
          includeLaborEstimates: true,
          includeMaterialAlternates: true,
          includeCodeReferences: true,
          market: 'philippines',
          currency: 'PHP',
        },
      });
      setActiveSystemTypes(nextSystems);
      setReqResult({
        ...reqResult,
        ...updatedRequirements,
        requirements: {
          ...reqResult.requirements,
          ...updatedRequirements.requirements,
        },
      });
      setSummaryPdfUrl(null);
      setReqError('');
      toast.success('Additional system requirements loaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load additional system requirements.';
      setReqError(message);
      toast.error(message);
    } finally {
      setReqLoading(false);
    }
  };

  const openSummaryPdf = async () => {
    setPdfGenerating(true);
    setPdfError('');
    try {
      const blob = await createRequirementsPdf(reqResult, analyzedLabel, activeSystemTypes);
      setSummaryPdfUrl(URL.createObjectURL(blob));
      setStep(4);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate the summary PDF.';
      setPdfError(message);
      toast.error(message);
    } finally {
      setPdfGenerating(false);
    }
  };

  const shareSummaryPdf = async () => {
    if (!summaryPdfUrl) return;
    try {
      const filename = getEstimationPdfFilename();
      const file = new File(
        [await (await fetch(summaryPdfUrl)).blob()],
        filename,
        { type: 'application/pdf' }
      );
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'Estimation' });
        return;
      }
      setPdfError('File sharing is not available in this browser; the PDF will download so you can share it manually.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setPdfError(error instanceof Error ? error.message : 'The PDF could not be shared.');
    }
    const link = document.createElement('a');
    link.href = summaryPdfUrl;
    link.download = getEstimationPdfFilename();
    link.click();
  };

  // Section that produced the current requirements result (step 3+)
  const analyzedSection = sections.find(s => s.id === analyzedSectionId);
  const distinctFloors = Array.from(
    new Set(selectedSections.map(s => s.floorTitle).filter(Boolean))
  );
  const floorBadge = distinctFloors.length > 1
    ? `🏢 ${distinctFloors.length} Floors`
    : distinctFloors.length === 1
      ? `🏢 ${distinctFloors[0]}`
      : analyzedSection?.floorTitle
        ? `🏢 ${analyzedSection.floorTitle}`
        : undefined;

  const analyzedLabel =
    reqResult?.sectionLabel ||
    analyzedPayload?.label ||
    analyzedSection?.name ||
    (selectedSections.length > 1 ? `${selectedSections.length} Selected Areas` : selectedSections[0]?.name) ||
    'Selected section';
  const analyzedArea = reqResult?.area ?? analyzedPayload?.area ?? analyzedSection?.area;
  const analyzedUnit = reqResult?.unit || analyzedPayload?.unit || analyzedSection?.unit || 'sqm';
  const analyzedMeta = [
    reqResult?.sectionType || analyzedPayload?.subType || analyzedSection?.category || (selectedSections.length > 1 ? `${selectedSections.length} areas` : undefined),
    floorBadge,
    analyzedArea !== undefined ? `${Math.round(analyzedArea * 10) / 10} ${analyzedUnit}` : undefined,
    reqResult?.confidenceScore !== undefined
      ? `${Math.round(reqResult.confidenceScore)}% confidence`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  // What gets persisted: API #1 (+ API #2 rows when a section was analyzed).
  const dbFileName = result?.fileInfo?.fileName;
  const dbAiContext: EstimationFlowAiContext = {
    mode: 'ai',
    floorPlan: result ?? null,
    floorPlans,
    floorPlanImages,
    selectedSection: analyzedSection?.raw ?? null,
    sectionRequirements: reqResult,
    estimation: null,
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto px-2 sm:px-4 lg:px-6 py-4 space-y-6">
      {/* ── STEP 2: SELECT FLOOR-PLAN SECTIONS ── */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Select floor-plan sections
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {isSample
                ? 'Sample layout — upload a floor plan to extract real sections. Select one section to analyze.'
                : 'Sections extracted via /api/floorplan/analyze. Select one section — requirements are extracted for it via /service/estimation/ai/section/requirements.'}
            </p>
          </div>

          {/* Analysis Summary (real API result) */}
          {result && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Confidence</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {result.confidenceScore !== undefined ? `${Math.round(result.confidenceScore)}%` : '—'}
                </p>
              </div>
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sections</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{sections.length}</p>
              </div>
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Rooms / Corridors</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {result.summary?.totalRooms ?? '—'} / {result.summary?.totalCorridors ?? '—'}
                </p>
              </div>
              <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Area</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {result.summary?.totalArea !== undefined
                    ? `${Math.round(result.summary.totalArea * 10) / 10} ${result.summary.unit || 'sqm'}`
                    : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Stepper Progress Bar & Unified Floor Selector at the Top (Position X) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 pb-1">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
              <span>1. Documents</span>
              <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
                2. Select areas
              </span>
              <span>3. Review</span>
              <span>4. Summary</span>
            </div>

            {/* Floor Selection Tabs at the Top */}
            {previewFiles.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedFloorFilter('all')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                    selectedFloorFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-[#131B2E] dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  All Floors ({sections.length})
                </button>
                {previewFiles.map((file, index) => {
                  const title = titleFor(file);
                  const group = floorGroups.find(
                    g => g.floorTitle.toLowerCase() === title.toLowerCase() || g.pageNumber === index + 1
                  );
                  const count = group?.items.length ?? sections.filter(s => s.pageNumber === index + 1).length;
                  const isSelected = selectedFloorFilter === title;

                  return (
                    <button
                      key={`${file.name}-${index}`}
                      type="button"
                      onClick={() => {
                        setPreviewIndex(index);
                        setSelectedFloorFilter(title);
                      }}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-[#131B2E] dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>{title}</span>
                      {count > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            isSelected
                              ? 'bg-white/25 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2-Column Layout: Blueprint Box Left, Checkbox List Right (Maximized Layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Blueprint Diagram Box */}
            <div className="lg:col-span-7 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeFile ? titleFor(activeFile) : result?.fileInfo?.fileName || 'Floor Plan'}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isSample
                    ? 'Ground floor • Sample extracted layout'
                    : `${result?.fileInfo?.pages || result?.pages?.length || 1} page(s)${(floorPlans?.length ?? 0) > 0 ? ` (${floorPlans!.map(label => label.title).join(', ')})` : ''} • ${sections.length} sections extracted`}
                </p>
              </div>

              {activeFile && uploadedFileUrl ? (
                <div className="my-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 flex flex-col flex-1">
                  <div className="flex-1 min-h-[500px] max-h-[680px] flex items-center justify-center p-3 bg-slate-950/90 dark:bg-slate-950 overflow-hidden rounded-xl">
                    {/\.(png|jpe?g|webp|gif)$/i.test(activeFile.name) ? (
                      <img
                        src={uploadedFileUrl}
                        alt={`Preview of ${activeFile.name}`}
                        className="max-h-[640px] max-w-full mx-auto my-auto object-contain block"
                      />
                    ) : (
                      <iframe
                        src={`${uploadedFileUrl}#toolbar=0&navpanes=0`}
                        title={`Preview of ${activeFile.name}`}
                        className="h-[640px] w-full bg-white mx-auto block rounded-lg border-0"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 dark:border-slate-700 bg-white dark:bg-[#131B2E]">
                    <span className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Uploaded document preview ({activeFile.name})
                    </span>
                    <a
                      href={uploadedFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open file
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border-4 border-slate-400 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-6 select-none my-2 max-h-[420px] overflow-y-auto">
                  {sections.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center py-8">
                      No sections were detected in this floor plan.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {sections.map(section => (
                        <div
                          key={section.id}
                          onClick={() => toggleSection(section.id)}
                          className={`min-h-20 sm:min-h-24 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all duration-200 ${
                            section.selected
                              ? 'bg-blue-100 dark:bg-blue-950/80 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : 'bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {section.selected && (
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">✓</span>
                          )}
                          <span className="text-xs font-bold leading-tight break-words">{section.name}</span>
                          {(section.area !== undefined || section.confidence !== undefined) && (
                            <span className="text-[10px] font-semibold opacity-70 mt-0.5">
                              {section.area !== undefined
                                ? `${Math.round(section.area * 10) / 10} ${section.unit || 'sqm'}`
                                : ''}
                              {section.area !== undefined && section.confidence !== undefined ? ' • ' : ''}
                              {section.confidence !== undefined ? `${section.confidence}%` : ''}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Detected Sections Checkbox List Right */}
            <div className="lg:col-span-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Detected sections
                    </h3>
                    {uniqueFloorTitles.length > 1 && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                        {uniqueFloorTitles.length} floor plans
                      </span>
                    )}
                  </div>

                  {sections.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleAll}
                      disabled={reqLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border select-none ${
                        isAllChecked
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border-blue-200/80 dark:border-blue-800/80'
                      }`}
                      title={isAllChecked ? 'Deselect all' : 'Check all'}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] font-black transition-colors ${
                          isAllChecked
                            ? 'bg-white text-blue-600 border-white'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span>{isAllChecked ? 'Deselect All' : 'Check All'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-3">
                  <span>
                    {selectedFloorFilter === 'all'
                      ? (selectedCount === sections.length && sections.length > 0
                          ? `All ${sections.length} sections selected${totalSelectedArea > 0 ? ` (${totalSelectedArea} ${sections[0]?.unit || 'sqm'})` : ''}`
                          : `${selectedCount} of ${sections.length} selected${totalSelectedArea > 0 && selectedCount > 0 ? ` (${totalSelectedArea} ${sections[0]?.unit || 'sqm'})` : ''}`)
                      : `Showing ${selectedFloorFilter} (${filteredFloorGroups.reduce((acc, g) => acc + g.items.length, 0)} areas) · ${selectedCount} selected total`}
                  </span>
                  {selectedFloorFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedFloorFilter('all')}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Show all floors
                    </button>
                  )}
                </div>



                {/* Checkbox Items Grouped by Floor Plan */}
                <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                  {filteredFloorGroups.map((group) => (
                    <div key={group.floorTitle} className="space-y-2">
                      {/* Floor Plan Category Header with Floor Select All Toggle */}
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFloorGroup(group.floorTitle, e)}
                          disabled={reqLoading}
                          className="flex items-center gap-2 min-w-0 cursor-pointer select-none text-left"
                          title={`Toggle all in ${group.floorTitle}`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] font-black transition-colors shrink-0 ${
                              group.items.length > 0 && group.items.every(s => s.selected)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="text-xs">🏢</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {group.floorTitle}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleToggleFloorGroup(group.floorTitle, e)}
                          disabled={reqLoading}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-900/60 shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/80 cursor-pointer transition-colors"
                          title={`Toggle all in ${group.floorTitle}`}
                        >
                          {group.items.filter(s => s.selected).length}/{group.items.length} selected
                        </button>
                      </div>

                      {/* Sections under this Floor Plan */}
                      <div className="space-y-1.5 pl-1.5">
                        {group.items.map((section) => (
                          <div
                            key={section.id}
                            onClick={() => {
                              toggleSection(section.id);
                              if (section.pageNumber && section.pageNumber <= previewFiles.length) {
                                setPreviewIndex(section.pageNumber - 1);
                              }
                            }}
                            className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer select-none group transition-colors ${
                              section.selected
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border text-[11px] font-black transition-colors shrink-0 ${
                                section.selected
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-transparent group-hover:border-blue-400'
                              }`}
                            >
                              ✓
                            </span>
                            <div className="min-w-0 flex-1">
                              <span
                                className={`text-sm font-bold transition-colors block ${
                                  section.selected
                                    ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                                    : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                                }`}
                              >
                                {section.name}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold">
                                  {section.floorTitle}
                                </span>
                                <span>•</span>
                                <span>{section.category}</span>
                                {section.area !== undefined
                                  ? ` · ${Math.round(section.area * 10) / 10} ${section.unit || 'sqm'}`
                                  : ''}
                                {section.confidence !== undefined ? ` · ${section.confidence}%` : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {sections.length === 0 && (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center py-6">
                      No sections detected. Try another floor plan.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
                Select sections to include — check individual areas, select whole floors, or Check All to estimate equipment and labor across the project.
              </p>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => onBackToDocument && onBackToDocument()}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back to Document
            </button>

            <button
              type="button"
              onClick={handleAnalyzeSections}
              disabled={selectedCount === 0 || reqLoading}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
                selectedCount > 0 && !reqLoading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              {reqLoading
                ? 'Extracting Requirements…'
                : selectedCount > 1
                  ? `Analyze ${selectedCount} Sections`
                  : 'Analyze Section'}
            </button>
          </div>

          {/* Requirements extraction error */}
          {reqError && !reqLoading && (
            <div className="p-3.5 px-4 bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 font-semibold leading-relaxed flex items-start justify-between gap-3">
              <span>{reqError}</span>
              <button
                type="button"
                onClick={handleAnalyzeSections}
                className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: SECTION REQUIREMENTS (API #2) ── */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Section requirements
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Identified for “{analyzedLabel}” via /service/estimation/ai/section/requirements.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span>2. Select areas</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              3. Review
            </span>
            <span>4. Summary</span>
          </div>

          {/* Analyzed section context */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
            <p className="font-black text-slate-900 dark:text-white">{analyzedLabel}</p>
            {analyzedMeta && (
              <p className="font-semibold mt-0.5 text-slate-500 dark:text-slate-400">{analyzedMeta}</p>
            )}
          </div>

          {/* Notice Banner */}
          <div className="p-3.5 px-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Requirements below were identified by the AI for this section. Review them, then
            continue to the summary.
          </div>

          {/* Identified requirements (API #2 result) */}
          {reqResult ? (
            <SectionRequirementsPanel
              result={reqResult}
              isDark={isDark}
              editable
              selectedSystems={activeSystemTypes}
              onChange={next => {
                setReqResult(next);
                setSummaryPdfUrl(null);
              }}
              onAddSystem={() => setShowAddSystemsModal(true)}
            />
          ) : (
            <div className="p-3.5 px-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold">
              No requirements were returned for this section. Go back and run the analysis again.
            </div>
          )}
          {reqLoading && (
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Updating the requirements for your selected systems…
            </p>
          )}

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => void openSummaryPdf()}
              disabled={pdfGenerating || reqLoading || !reqResult}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all disabled:cursor-wait disabled:opacity-60"
            >
              {pdfGenerating ? 'Preparing PDF…' : 'Continue to PDF Summary'}
            </button>
          </div>
          {pdfError && <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{pdfError}</p>}
        </div>
      )}

      {/* ── STEP 4: ESTIMATE SUMMARY ── */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Estimate summary
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Review the scope before saving.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span>2. Select areas</span>
            <span>3. Review</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              4. Summary
            </span>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#131B2E]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Estimation
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Generated from the latest reviewed requirements for {analyzedLabel}.
                </p>
                {summaryPdfUrl && (
                  <p className="mt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {getEstimationPdfFilename()}
                  </p>
                )}
              </div>
              {summaryPdfUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(summaryPdfUrl, '_blank', 'noopener,noreferrer')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Open / Print
                  </button>
                  <a
                    href={summaryPdfUrl}
                    download={getEstimationPdfFilename()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-700"
                  >
                    Download PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => void shareSummaryPdf()}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Share PDF
                  </button>
                  {pdfError && <span role="alert" className="text-[10px] font-semibold text-red-600">{pdfError}</span>}
                </div>
              )}
            </div>
            {summaryPdfUrl ? (
              <iframe
                src={summaryPdfUrl}
                title="Printable system requirements summary PDF"
                className="h-[min(78vh,900px)] min-h-[520px] w-full bg-slate-100"
              />
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  The reviewed PDF summary is not available. Generate it again to continue.
                </p>
                <button
                  type="button"
                  onClick={() => void openSummaryPdf()}
                  disabled={pdfGenerating}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {pdfGenerating ? 'Preparing PDF…' : 'Generate PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Saved-to-database confirmation */}
          {dbSaved && dbSaveMessage && (
            <div className="p-3.5 px-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
              {dbSaveMessage} The project is now pending validation in the Estimation workspace.
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back to Edit
            </button>

            <div className="flex flex-wrap items-center gap-3">
              {onSaveEstimation && !dbSaved && (
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                >
                  Save to Database
                </button>
              )}

              {dbSaved && (
                <span className="px-5 py-2.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                  ✓ Saved to Database
                </span>
              )}
            </div>
            {pdfError && !summaryPdfUrl && <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{pdfError}</p>}
          </div>
        </div>
      )}

      {/* ── MODAL LOADING ANIMATION (Transparent Grey Overlay) ── */}
      {reqLoading && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Analyzing Section Requirements"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4 select-none"
        >
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm sm:max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-5 animate-scale-in">
            {/* Multi-ring Spinner Animation */}
            <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 dark:bg-blue-500/30 animate-ping opacity-60" />
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-blue-600 dark:border-t-blue-400 border-r-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <svg className="w-7 h-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
            </div>

            {/* Title & Status */}
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {selectedCount > 1
                  ? `Analyzing ${selectedCount} Sections...`
                  : 'Analyzing Section Requirements...'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                Extracting equipment specs, material quantities, labor hours, and building code compliance.
              </p>
            </div>

            {/* Animated Loading Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-full w-full animate-pulse" />
            </div>

            {/* Informative Wait Notice */}
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <span>⏳</span>
              <span>Please wait while the AI models process your request</span>
            </p>
          </div>
        </div>
      )}

      {/* Save dialog (wizard client details) */}
      <SystemSelectionModal
        open={showAddSystemsModal}
        onClose={() => setShowAddSystemsModal(false)}
        onConfirm={selected => void addSystemsToRequirements(selected)}
        selected={activeSystemTypes}
        eyebrow="System Requirements"
        title="Add more in system requirement"
        description="Keep the current systems selected and choose additional systems. Requirements will be re-generated for the combined selection."
        allowAddOnly
      />

      {onSaveEstimation && (
        <SaveEstimationModal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={onSaveEstimation}
          ai={dbAiContext}
          fileName={dbFileName}
          initialSystemTypes={activeSystemTypes}
          projects={projects}
          onSaved={res => {
            setDbSaved(true);
            setDbSaveMessage(
              res.projId ? `Saved to the database (Project #${res.projId}).` : 'Saved to the database.'
            );
          }}
        />
      )}
    </div>
  );
}
