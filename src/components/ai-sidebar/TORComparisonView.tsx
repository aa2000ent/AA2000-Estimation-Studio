import { useState, useCallback, useRef, useEffect } from 'react';
import { parseFile, type ParsedFile } from '../../services/fileParser';
import { auditTorDocument, analyzeProposalOnly, type AuditDetails } from '../../services/torAuditorService';
import { exportAuditPdf } from '../../utils/pdfExporter';
import type { AIScanGroup, AIScanFile, Project } from '../../App';
import { useToast } from '../utils/Toast';
import QuotationModal, { type ScopeOfWorkEntry, type QuotationHeaderState } from '../estimation/QuotationModal';

interface FileWithContent {
  file: File;
  parsed: ParsedFile;
  loading: boolean;
  error: string | null;
}

import { canViewPrices } from '../../constants/roles';

interface Props {
  userRole?: string;
  onSaveAIScan?: (scan: AIScanGroup) => void;
  onScanningChange?: (scanning: boolean) => void;
}

interface DropZoneProps {
  label: string;
  description: string;
  file: FileWithContent | null;
  onFiles: (files: FileList | File[]) => void;
  onRemove: () => void;
  acceptedTypes?: string;
  color?: 'blue' | 'amber';
}

function DropZone({
  label,
  description,
  file,
  onFiles,
  onRemove,
  acceptedTypes = '.pdf,.xlsx,.xls,.docx,.doc,.txt,.csv',
  color = 'blue',
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const colorStyles = {
    blue: {
      idle: 'border-blue-200/80 dark:border-blue-500/30 bg-transparent',
      hover: 'hover:border-blue-400 dark:hover:border-blue-400/70 hover:bg-blue-500/[0.04] dark:hover:bg-blue-500/10',
      active: 'border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-500/20',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-700 dark:text-blue-300',
    },
    amber: {
      idle: 'border-amber-200/80 dark:border-amber-500/30 bg-transparent',
      hover: 'hover:border-amber-400 dark:hover:border-amber-400/70 hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/10',
      active: 'border-amber-500 dark:border-amber-400 bg-amber-500/10 dark:bg-amber-500/20',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-700 dark:text-amber-300',
    },
  };

  const currentStyle = colorStyles[color];

  const handleContainerClick = () => {
    if (!file && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const filesCopy = Array.from(e.dataTransfer.files);
          onFiles(filesCopy);
        }
      }}
      onClick={handleContainerClick}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 overflow-hidden ${
        dragOver
          ? currentStyle.active
          : `${currentStyle.idle} ${currentStyle.hover}`
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            const filesCopy = Array.from(e.target.files);
            e.target.value = '';
            onFiles(filesCopy);
          }
        }}
      />
      
      {file ? (
        <div className="text-left w-full" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2 w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm" 
                style={{ background: `linear-gradient(135deg, ${color === 'blue' ? '#2563EB' : '#D97706'}CC, ${color === 'blue' ? '#2563EB' : '#D97706'}88)` }}
              >
                {file.parsed.fileName.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate whitespace-nowrap">{file.parsed.fileName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate whitespace-nowrap">{file.loading ? 'Parsing...' : `${(file.parsed.content.length / 1024).toFixed(1)} KB`}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 ml-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <svg className={`w-12 h-12 mb-3 ${currentStyle.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className={`text-base font-bold ${currentStyle.text}`}>
            {label}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {description}
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Open File / Select from Device
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TOR_AUDIT_STEPS = [
  'Ingesting & parsing TOR document structure...',
  'Extracting technical specifications & hardware requirements...',
  'Cross-referencing equipment models with Philippine market standards...',
  'Calculating labor ratios, installation man-hours & engineering team...',
  'Auditing cabling lengths, conduits & consumable allowances...',
  'Computing confidence score and finalizing technical audit report...',
];

const COMPARISON_AUDIT_STEPS = [
  'Parsing customer TOR specifications & technician proposal...',
  'Comparing proposed equipment models vs TOR required specs...',
  'Detecting quantity discrepancies, missing hardware & brand mismatches...',
  'Validating labor hours against standard installation rates...',
  'Auditing cabling, conduits, and accessories for scope completeness...',
  'Generating variance analysis & executive compliance report...',
];

export default function TORComparisonView({ userRole, onSaveAIScan, onScanningChange }: Props) {
  const { toast } = useToast();
  const showPrices = canViewPrices(userRole);
  const [torFile, setTorFile] = useState<FileWithContent | null>(null);
  const [proposalFile, setProposalFile] = useState<FileWithContent | null>(null);
  const [auditResult, setAuditResult] = useState<AuditDetails | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [scanGroupName, setScanGroupName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  // Baseline cost override editing
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);
  const [baselineInput, setBaselineInput] = useState('');
  const [isEditingAiCost, setIsEditingAiCost] = useState(false);
  const [aiCostInput, setAiCostInput] = useState('');

  // AA2000 Official Quotation Modal state
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showEditQuotation, setShowEditQuotation] = useState(false);
  const [quotDiscount, setQuotDiscount] = useState(8390);
  const [quotHeader, setQuotHeader] = useState<QuotationHeaderState>({
    referenceCode: 'PQ-FDAS-2026-08-013',
    attentionTo: 'Mr. Jon Carlo A. Castronuevo',
    thru: 'Building Manager',
    emailAdd: 'jollibee_center@yahoo.com',
    contactNo: '0917 709 1015',
    company: 'JOLLIBEE CENTER CONDOMINIUM CORPORATION',
    address: 'San Miguel Ave., Ortigas Center, Brgy. San Antonio, Pasig City',
    projectSite: 'Pasig City',
    projectTitle: 'FDAS PREVENTIVE MAINTENANCE FY: 2026 (QUARTERLY)',
    quoteDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(),
    validityPeriod: '30 days from date of this quotation',
  });

  const handleTorFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    
    const file = fileArray[0];
    setTorFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: true, error: null });
    
    try {
      const parsed = await parseFile(file);
      setTorFile({ file, parsed, loading: false, error: null });
      toast.success(`TOR document "${file.name}" loaded successfully`);
    } catch (err) {
      setTorFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: false, error: 'Failed to parse file' });
      toast.error(`Failed to parse TOR document: ${err}`);
    }
  }, [toast]);

  const handleProposalFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    
    const file = fileArray[0];
    setProposalFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: true, error: null });
    
    try {
      const parsed = await parseFile(file);
      setProposalFile({ file, parsed, loading: false, error: null });
      toast.success(`Technician Proposal "${file.name}" loaded successfully`);
    } catch (err) {
      setProposalFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: false, error: 'Failed to parse file' });
      toast.error(`Failed to parse Technician Proposal: ${err}`);
    }
  }, [toast]);

  const removeTorFile = useCallback(() => setTorFile(null), []);
  const removeProposalFile = useCallback(() => setProposalFile(null), []);

  const handleRunComparison = useCallback(async () => {
    if (!torFile && !proposalFile) {
      toast.error('Please upload at least a Technician Proposal or a TOR document');
      return;
    }
    if ((torFile && torFile.loading) || (proposalFile && proposalFile.loading)) {
      toast.error('Please wait for documents to finish loading');
      return;
    }

    const hasTor = !!torFile && !torFile.loading;
    const hasProposal = !!proposalFile && !proposalFile.loading;
    const currentSteps = hasTor && hasProposal ? COMPARISON_AUDIT_STEPS : TOR_AUDIT_STEPS;

    setAuditStep(0);
    setAuditing(true);
    setAuditResult(null);
    onScanningChange?.(true);

    const stepInterval = setInterval(() => {
      setAuditStep(prev => (prev < currentSteps.length - 1 ? prev + 1 : prev));
    }, 2200);

    try {
      let auditDetails: AuditDetails;

      if (hasTor && hasProposal) {
        toast.info('Running AI TOR vs Proposal comparison...');
        auditDetails = await auditTorDocument(
          torFile!.parsed.fileName,
          torFile!.parsed.content,
          { technicianProposalText: proposalFile!.parsed.content }
        );
        toast.success('AI comparison completed!');
      } else if (hasTor && !hasProposal) {
        toast.info('Running AI TOR audit...');
        auditDetails = await auditTorDocument(
          torFile!.parsed.fileName,
          torFile!.parsed.content,
          {}
        );
        toast.success('AI TOR audit completed!');
      } else {
        toast.info('Running AI analysis on Technician Proposal...');
        auditDetails = await analyzeProposalOnly(
          proposalFile!.parsed.fileName,
          proposalFile!.parsed.content
        );
        toast.success('AI Proposal analysis completed!');
      }

      setAuditResult(auditDetails);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      clearInterval(stepInterval);
      setAuditing(false);
      onScanningChange?.(false);
    }
  }, [torFile, proposalFile, toast, onScanningChange]);

  const handleSave = useCallback(() => {
    if (!onSaveAIScan || !scanGroupName.trim() || (!torFile && !proposalFile) || !auditResult) return;

    const files: AIScanFile[] = [];

    if (torFile) {
      files.push({
        fileName: torFile.parsed.fileName,
        fileType: torFile.parsed.fileType || torFile.parsed.fileName.split('.').pop() || '',
        fileSizeLabel: `${(torFile.parsed.content.length / 1024).toFixed(1)} KB extracted`,
        parsedContent: torFile.parsed.content.slice(0, 10000),
        aiResult: { auditDetails: auditResult },
        role: 'tor' as const,
      });
    }

    if (proposalFile) {
      files.push({
        fileName: proposalFile.parsed.fileName,
        fileType: proposalFile.parsed.fileType || proposalFile.parsed.fileName.split('.').pop() || '',
        fileSizeLabel: `${(proposalFile.parsed.content.length / 1024).toFixed(1)} KB extracted`,
        parsedContent: proposalFile.parsed.content.slice(0, 10000),
        aiResult: torFile ? null : { auditDetails: auditResult },
        role: 'technician_proposal' as const,
      });
    }

    const group: AIScanGroup = {
      id: `scan-${Date.now()}`,
      name: scanGroupName.trim(),
      createdAt: new Date().toISOString(),
      files,
    };

    onSaveAIScan(group);
    setIsSaved(true);
    setShowSaveModal(false);
    toast.success(torFile && proposalFile ? 'Comparison saved successfully!' : 'Analysis saved successfully!');
  }, [onSaveAIScan, scanGroupName, torFile, proposalFile, auditResult, toast]);

  const hasBothFiles = torFile && proposalFile;
  const hasTor = !!torFile;
  const hasProposal = !!proposalFile;
  const canRunComparison = (hasTor || hasProposal) && !torFile?.loading && !proposalFile?.loading && !auditing;

  const getButtonLabel = () => {
    if (auditing) return 'Auditing TOR Specifications...';
    return 'Audit TOR Specifications';
  };
  const getButtonIcon = () => 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z';
  const getButtonStyle = () => 'linear-gradient(135deg, #2563EB, #1D4ED8)';

  const handleDownload = async () => {
    if (!auditResult) return;
    setDownloading(true);
    toast.info('Generating PDF...');
    try {
      const primaryName = torFile?.parsed.fileName || proposalFile?.parsed.fileName || 'Audit';
      const mode = torFile && proposalFile ? 'Comparison' : torFile ? 'TOR Audit' : 'Proposal Analysis';
      await exportAuditPdf({
        title: `${primaryName.replace(/\.[^.]+$/, '')} — ${mode}`,
        torFileName: torFile?.parsed.fileName,
        proposalFileName: proposalFile?.parsed.fileName,
        confidenceScore: auditResult.confidenceScore,
        totalTechnicianCost: auditResult.totalTechnicianCost,
        totalAiRecommendedCost: auditResult.totalAiRecommendedCost,
        varianceAmount: auditResult.varianceAmount,
        variancePercent: auditResult.variancePercent,
        overallAuditRationale: auditResult.overallAuditRationale,
        equipmentComparison: auditResult.equipmentComparison,
        manpowerComparison: auditResult.manpowerComparison,
        consumablesComparison: auditResult.consumablesComparison,
      });
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleUpdateBaseline = (newVal: number) => {
    if (!auditResult) return;
    const newTechCost = Math.max(0, newVal);
    const newVariance = auditResult.totalAiRecommendedCost - newTechCost;
    const newVariancePercent = newTechCost !== 0 ? (newVariance / newTechCost) * 100 : (auditResult.totalAiRecommendedCost !== 0 ? 100 : 0);
    
    setAuditResult({
      ...auditResult,
      totalTechnicianCost: newTechCost,
      varianceAmount: newVariance,
      variancePercent: parseFloat(newVariancePercent.toFixed(2)),
    });
    toast.success(`Baseline cost updated to ₱${newTechCost.toLocaleString()}`);
  };

  const handleUpdateAiCost = (newVal: number) => {
    if (!auditResult) return;
    const newAiCost = Math.max(0, newVal);
    const newVariance = newAiCost - auditResult.totalTechnicianCost;
    const newVariancePercent = auditResult.totalTechnicianCost !== 0 ? (newVariance / auditResult.totalTechnicianCost) * 100 : (newAiCost !== 0 ? 100 : 0);
    
    setAuditResult({
      ...auditResult,
      totalAiRecommendedCost: newAiCost,
      varianceAmount: newVariance,
      variancePercent: parseFloat(newVariancePercent.toFixed(2)),
    });
    toast.success(`AI Recommended cost updated to ₱${newAiCost.toLocaleString()}`);
  };

  const handleUpdateEquipmentPrice = (index: number, newUnitPrice: number) => {
    if (!auditResult) return;
    const updatedEq = [...auditResult.equipmentComparison];
    const item = { ...updatedEq[index] };
    item.unitPrice = newUnitPrice;
    item.totalPrice = newUnitPrice * (item.aiQty || 1);
    updatedEq[index] = item;

    const sumItemCosts = updatedEq.reduce((sum, eq) => sum + (eq.totalPrice ?? (eq.unitPrice ?? 0) * (eq.aiQty || 1)), 0);
    const newAiCost = sumItemCosts > 0 ? sumItemCosts : auditResult.totalAiRecommendedCost;
    const newVariance = newAiCost - auditResult.totalTechnicianCost;
    const newVariancePercent = auditResult.totalTechnicianCost !== 0 ? (newVariance / auditResult.totalTechnicianCost) * 100 : (newAiCost !== 0 ? 100 : 0);

    setAuditResult({
      ...auditResult,
      equipmentComparison: updatedEq,
      totalAiRecommendedCost: newAiCost,
      varianceAmount: newVariance,
      variancePercent: parseFloat(newVariancePercent.toFixed(2)),
    });
  };

  const conf = auditResult?.confidenceScore ?? 0;
  const confColor = conf >= 75 ? '#16A34A' : conf >= 50 ? '#CA8A04' : conf >= 25 ? '#EA580C' : '#DC2626';
  const confLabel = conf >= 75 ? 'High Confidence' : conf >= 50 ? 'Medium Confidence' : conf >= 25 ? 'Low Confidence' : 'Poor Quality';
  const confDesc = conf >= 75
    ? 'Both documents are detailed and results are well-supported.'
    : conf >= 50
    ? 'Results are reasonable but document coverage is limited.'
    : conf >= 25
    ? 'Limited data — treat results as preliminary estimates only.'
    : 'Insufficient document detail — results may be unreliable.';

  const varianceColor = (auditResult?.varianceAmount ?? 0) > 0 ? 'text-red-600' : (auditResult?.varianceAmount ?? 0) < 0 ? 'text-amber-600' : 'text-slate-600';
  const varianceBg = (auditResult?.varianceAmount ?? 0) > 0 ? 'bg-red-50' : (auditResult?.varianceAmount ?? 0) < 0 ? 'bg-amber-50' : 'bg-slate-50';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B132B] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-16 shrink-0 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <span className="text-base font-black text-slate-900 dark:text-white">TOR Comparison Tool</span>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Instruction */}
          <div className="p-4 bg-blue-50/70 dark:bg-[#131B2E] border border-blue-200/80 dark:border-slate-800 rounded-xl transition-colors">
            <p className="text-sm text-blue-900 dark:text-blue-200 font-medium leading-relaxed">
              Upload a <span className="font-bold text-blue-950 dark:text-white">Terms of Reference (TOR)</span> or technical specifications document (PDF, XLSX, DOCX).
              The AI will extract hardware requirements, identify scope and compliance gaps, and provide a detailed audit with cost recommendations.
            </p>
          </div>

          {/* Drop Zone */}
          <div className="w-full">
            <DropZone
              label="Upload TOR Document"
              description="PDF, XLSX, DOCX, TXT, CSV"
              file={torFile}
              onFiles={handleTorFiles}
              onRemove={removeTorFile}
              color="blue"
            />
          </div>

          {/* Action Button */}
          <div className="flex justify-center gap-4 pt-4">
            {canRunComparison && (
              <button
                onClick={handleRunComparison}
                disabled={auditing}
                className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md disabled:opacity-50"
                style={{ background: getButtonStyle() }}
              >
                {auditing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {getButtonLabel()}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={getButtonIcon()} />
                    </svg>
                    {getButtonLabel()}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Real-time AI Audit Scanning Progress Animation */}
          {auditing && (() => {
            const isComparison = torFile && proposalFile;
            const currentSteps = isComparison ? COMPARISON_AUDIT_STEPS : TOR_AUDIT_STEPS;
            const progressPercent = Math.round(((auditStep + 1) / currentSteps.length) * 100);

            return (
              <div className="mt-6 rounded-2xl bg-gradient-to-b from-blue-50/90 via-blue-50/40 to-indigo-50/30 border border-blue-200/80 p-6 space-y-5 shadow-sm">
                {/* Header with animated AI radar icon and step badge */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                      <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        AI Document Auditor in Progress
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 uppercase tracking-wider">
                          Neural Engine
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {isComparison
                          ? 'Auditing Technician Proposal against Customer Terms of Reference (TOR)...'
                          : 'Extracting hardware specs, quantities, labor hours & compliance rules from TOR...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-blue-700 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
                      Step {auditStep + 1} of {currentSteps.length}
                    </span>
                    <span className="text-xs font-black text-slate-700">{progressPercent}%</span>
                  </div>
                </div>

                {/* Smooth Progress Bar with Glowing Pulse */}
                <div className="space-y-1.5">
                  <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
                    <span>{currentSteps[auditStep]}</span>
                    <span>{progressPercent}% Completed</span>
                  </div>
                </div>

                {/* Animated Step Checklist */}
                <div className="space-y-1.5 pt-1">
                  {currentSteps.map((stepText, idx) => {
                    const isDone = idx < auditStep;
                    const isCurrent = idx === auditStep;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 text-xs px-3 py-2 rounded-xl transition-all duration-300 ${
                          isCurrent
                            ? 'bg-white border border-blue-200 shadow-xs text-blue-950 font-bold'
                            : isDone
                            ? 'bg-white/50 text-slate-600 font-medium'
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
                          <div className="w-4 h-4 rounded-full border border-slate-300/80 bg-slate-100 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          </div>
                        )}
                        <span className={isCurrent ? 'text-blue-900 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'}>
                          {stepText}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Document Information Strip */}
                <div className="pt-2 border-t border-blue-100/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active File:</span>
                    <span className="font-bold text-slate-800 truncate max-w-xs">
                      {torFile?.parsed.fileName || proposalFile?.parsed.fileName}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600/90">
                    Applying Philippine Electrical Code (PEC) &amp; Security Standards
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Results */}
          {auditResult && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {/* Results Header with Confidence Meter */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">AI Audit Results</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {torFile && proposalFile ? 'TOR vs Technician Proposal comparison' :
                       torFile ? 'TOR-only audit' : 'Technician Proposal analysis'}
                    </p>
                  </div>
                  {/* Confidence Meter */}
                  <div className="shrink-0 min-w-[160px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">AI Confidence</span>
                      <span className="text-sm font-black" style={{ color: confColor }}>{conf}%</span>
                    </div>
                    {/* Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${conf}%`, background: confColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold" style={{ color: confColor }}>{confLabel}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{confDesc}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Summary Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {auditResult.totalTechnicianCost > 0 ? (
                    <>
                      {/* Baseline Proposed Card */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Baseline / Tech Proposed</span>
                          <button
                            onClick={() => {
                              setIsEditingBaseline(true);
                              setBaselineInput(String(auditResult.totalTechnicianCost));
                            }}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-slate-200/60"
                            title="Click to edit baseline cost"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        </div>
                        {isEditingBaseline ? (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-sm font-bold text-slate-500">₱</span>
                            <input
                              type="number"
                              value={baselineInput}
                              onChange={e => setBaselineInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const num = parseFloat(baselineInput);
                                  if (!isNaN(num)) handleUpdateBaseline(num);
                                  setIsEditingBaseline(false);
                                } else if (e.key === 'Escape') {
                                  setIsEditingBaseline(false);
                                }
                              }}
                              autoFocus
                              className="w-full text-sm font-black text-slate-800 bg-white border border-blue-400 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                              onClick={() => {
                                const num = parseFloat(baselineInput);
                                if (!isNaN(num)) handleUpdateBaseline(num);
                                setIsEditingBaseline(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shrink-0"
                            >
                              Set
                            </button>
                          </div>
                        ) : (
                          <div
                            className="text-xl font-black text-slate-800 cursor-pointer hover:text-blue-700 transition-colors"
                            onClick={() => {
                              setIsEditingBaseline(true);
                              setBaselineInput(String(auditResult.totalTechnicianCost));
                            }}
                            title="Click to edit baseline cost"
                          >
                            ₱{auditResult.totalTechnicianCost.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* AI Recommended Card */}
                      <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase text-blue-700">AI Recommended Cost (Reconciled)</span>
                          <button
                            onClick={() => {
                              setIsEditingAiCost(true);
                              setAiCostInput(String(auditResult.totalAiRecommendedCost));
                            }}
                            className="text-blue-400 hover:text-blue-700 transition-colors p-0.5 rounded hover:bg-blue-100"
                            title="Click to edit AI recommended cost"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        </div>
                        {isEditingAiCost ? (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-sm font-bold text-blue-500">₱</span>
                            <input
                              type="number"
                              value={aiCostInput}
                              onChange={e => setAiCostInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const num = parseFloat(aiCostInput);
                                  if (!isNaN(num)) handleUpdateAiCost(num);
                                  setIsEditingAiCost(false);
                                } else if (e.key === 'Escape') {
                                  setIsEditingAiCost(false);
                                }
                              }}
                              autoFocus
                              className="w-full text-sm font-black text-blue-900 bg-white border border-blue-400 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                              onClick={() => {
                                const num = parseFloat(aiCostInput);
                                if (!isNaN(num)) handleUpdateAiCost(num);
                                setIsEditingAiCost(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shrink-0"
                            >
                              Set
                            </button>
                          </div>
                        ) : (
                          <div
                            className="text-xl font-black text-blue-800 cursor-pointer hover:text-blue-900 transition-colors"
                            onClick={() => {
                              setIsEditingAiCost(true);
                              setAiCostInput(String(auditResult.totalAiRecommendedCost));
                            }}
                            title="Click to edit AI recommended cost"
                          >
                            ₱{auditResult.totalAiRecommendedCost.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Variance Card */}
                      <div className={`p-4 rounded-2xl border ${varianceColor} ${varianceBg} border-opacity-30`}>
                        <div className={`text-[10px] font-bold uppercase ${varianceColor} mb-1`}>Variance vs Proposed</div>
                        <div className={`text-xl font-black ${varianceColor}`}>
                          {auditResult.varianceAmount > 0 ? '+' : ''}₱{auditResult.varianceAmount.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {auditResult.variancePercent.toFixed(2)}% {auditResult.varianceAmount > 0 ? 'Under-budgeted' : 'Over-budgeted'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Single TOR Mode: Total Recommended Project Cost */}
                      <div className="p-4 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Total Recommended Cost</span>
                          <button
                            onClick={() => {
                              setIsEditingAiCost(true);
                              setAiCostInput(String(auditResult.totalAiRecommendedCost));
                            }}
                            className="text-blue-400 hover:text-blue-700 transition-colors p-0.5 rounded hover:bg-blue-100"
                            title="Click to edit AI recommended cost"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        </div>
                        {isEditingAiCost ? (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-sm font-bold text-blue-500">₱</span>
                            <input
                              type="number"
                              value={aiCostInput}
                              onChange={e => setAiCostInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const num = parseFloat(aiCostInput);
                                  if (!isNaN(num)) handleUpdateAiCost(num);
                                  setIsEditingAiCost(false);
                                } else if (e.key === 'Escape') {
                                  setIsEditingAiCost(false);
                                }
                              }}
                              autoFocus
                              className="w-full text-sm font-black text-blue-900 bg-white border border-blue-400 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                              onClick={() => {
                                const num = parseFloat(aiCostInput);
                                if (!isNaN(num)) handleUpdateAiCost(num);
                                setIsEditingAiCost(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shrink-0"
                            >
                              Set
                            </button>
                          </div>
                        ) : (
                          <div
                            className="text-2xl font-black text-blue-900 cursor-pointer hover:text-blue-700 transition-colors"
                            onClick={() => {
                              setIsEditingAiCost(true);
                              setAiCostInput(String(auditResult.totalAiRecommendedCost));
                            }}
                            title="Click to edit AI recommended cost"
                          >
                            ₱{auditResult.totalAiRecommendedCost.toLocaleString()}
                          </div>
                        )}
                        <p className="text-[10px] font-bold text-blue-600/80 mt-1">Realistic Philippine Market Rate</p>
                      </div>

                      {/* Detected Equipment Items */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Detected Hardware Items</span>
                        <div className="text-2xl font-black text-slate-800 mt-0.5">
                          {auditResult.equipmentComparison.length} <span className="text-sm font-semibold text-slate-500">Line Items</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">Extracted directly from TOR specifications</p>
                      </div>

                      {/* Detected Labor Roles */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Estimated Manpower Scope</span>
                        <div className="text-2xl font-black text-slate-800 mt-0.5">
                          {auditResult.manpowerComparison.length} <span className="text-sm font-semibold text-slate-500">Labor Roles</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">Required installation & engineering team</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Audit Findings */}
                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl mb-6 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">AI Audit Scanning & Technical Recommendations</span>
                  </div>
                  
                  {(() => {
                    const rawStr = typeof auditResult.overallAuditRationale === 'string'
                      ? auditResult.overallAuditRationale
                      : typeof auditResult.overallAuditRationale === 'object' && auditResult.overallAuditRationale !== null
                        ? Object.values(auditResult.overallAuditRationale as Record<string, unknown>).filter(v => typeof v === 'string').join('\n')
                        : String(auditResult.overallAuditRationale ?? '');
                    
                    const bullets = rawStr
                      .split(/\n|•|\\n/)
                      .map(s => s.replace(/^[•\-\d\.]+\s*/, '').trim())
                      .filter(Boolean);

                    if (bullets.length <= 1) {
                      return (
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                          {rawStr || 'Document scan completed.'}
                        </p>
                      );
                    }

                    return (
                      <ul className="space-y-2.5">
                        {bullets.map((b, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="flex-1 text-slate-800">{b}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>

                {/* Equipment Comparison */}
                {auditResult.equipmentComparison.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Equipment & Materials (Editable Prices)</h4>
                      <span className="text-[10px] font-bold text-slate-400">{auditResult.equipmentComparison.length} line items</span>
                    </div>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold">
                            <th className="p-2.5 text-left">Item</th>
                            <th className="p-2.5 text-right">Tech Qty</th>
                            <th className="p-2.5 text-right">AI Qty</th>
                            <th className="p-2.5 text-center">Variance</th>
                            {showPrices && (
                              <>
                                <th className="p-2.5 text-right">Unit Price (₱)</th>
                                <th className="p-2.5 text-right">Total Price (₱)</th>
                              </>
                            )}
                            <th className="p-2.5 text-left">Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditResult.equipmentComparison.map((item, i) => {
                            const unitPrice = item.unitPrice ?? 0;
                            const totalPrice = item.totalPrice ?? (unitPrice * (item.aiQty || 1));
                            return (
                              <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                                <td className="p-2.5 font-semibold text-slate-700">{item.name}</td>
                                <td className="p-2.5 text-right text-slate-500">{item.technicianQty}</td>
                                <td className="p-2.5 text-right font-bold text-slate-800">{item.aiQty}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.variance > 0 ? 'bg-red-50 text-red-600' : 
                                    item.variance < 0 ? 'bg-amber-50 text-amber-600' : 
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {item.variance > 0 ? `+${item.variance}` : item.variance < 0 ? item.variance : 'Match'}
                                  </span>
                                </td>
                                {showPrices && (
                                  <>
                                    <td className="p-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-slate-400 font-bold">₱</span>
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          placeholder="0.00"
                                          value={unitPrice || ''}
                                          onChange={e => handleUpdateEquipmentPrice(i, parseFloat(e.target.value) || 0)}
                                          className="w-24 px-2 py-1 text-right text-xs font-bold rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-slate-800"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-slate-800">
                                      &#8369;{totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                  </>
                                )}
                                <td className="p-2.5 text-slate-600">{item.rationale}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Manpower Comparison */}
                {auditResult.manpowerComparison.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Labor & Manpower</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold">
                            <th className="p-2.5 text-left">Role</th>
                            <th className="p-2.5 text-right">Tech Hours</th>
                            <th className="p-2.5 text-right">AI Hours</th>
                            <th className="p-2.5 text-center">Variance</th>
                            <th className="p-2.5 text-left">Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditResult.manpowerComparison.map((item, i) => (
                            <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                              <td className="p-2.5 font-semibold text-slate-700">{item.role}</td>
                              <td className="p-2.5 text-right text-slate-500">{item.technicianHours}</td>
                              <td className="p-2.5 text-right font-bold text-slate-800">{item.aiHours}</td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.variance > 0 ? 'bg-red-50 text-red-600' : 
                                  item.variance < 0 ? 'bg-amber-50 text-amber-600' : 
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {item.variance > 0 ? `+${item.variance}` : item.variance < 0 ? item.variance : 'Match'}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">{item.rationale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Consumables Comparison */}
                {auditResult.consumablesComparison && auditResult.consumablesComparison.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Cabling & Consumables</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold">
                            <th className="p-2.5 text-left">Material</th>
                            <th className="p-2.5 text-right">Tech Qty</th>
                            <th className="p-2.5 text-right">AI Qty</th>
                            <th className="p-2.5 text-center">Variance</th>
                            <th className="p-2.5 text-left">Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditResult.consumablesComparison.map((item, i) => (
                            <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                              <td className="p-2.5 font-semibold text-slate-700">{item.name}</td>
                              <td className="p-2.5 text-right text-slate-500">{item.technicianQty}</td>
                              <td className="p-2.5 text-right font-bold text-slate-800">{item.aiQty}</td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.variance > 0 ? 'bg-red-50 text-red-600' : 
                                  item.variance < 0 ? 'bg-amber-50 text-amber-600' : 
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {item.variance > 0 ? `+${item.variance}` : item.variance < 0 ? item.variance : 'Match'}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600">{item.rationale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  {/* View AA2000 Official Commercial Quotation */}
                  <button
                    onClick={() => setShowQuotationModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Commercial Quotation
                  </button>

                  {/* Download PDF */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {downloading ? (
                      <svg className="w-3.5 h-3.5 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    {downloading ? 'Generating...' : 'Download PDF'}
                  </button>

                  {/* Save to AI Scans */}
                  {onSaveAIScan && (
                    <button
                      onClick={() => {
                        const primaryName = (torFile?.parsed.fileName || proposalFile?.parsed.fileName || 'Document').replace(/\.[^.]+$/, '');
                        const mode = torFile && proposalFile ? 'Comparison' : torFile ? 'TOR Audit' : 'Proposal Analysis';
                        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        setScanGroupName(`${primaryName} ${mode} — ${dateStr}`);
                        setShowSaveModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      {torFile && proposalFile ? 'Save Comparison' : torFile ? 'Save TOR Audit' : 'Save Analysis'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-black text-slate-800 mb-1">Save Comparison</h3>
            <p className="text-sm text-slate-500 mb-4">Enter a name for this TOR comparison to save it to your projects.</p>
            <input
              type="text"
              value={scanGroupName}
              onChange={e => setScanGroupName(e.target.value)}
              placeholder="e.g., St Miguel Hall TOR Comparison"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                Save Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Confirmation */}
      {isSaved && (
        <div className="fixed bottom-6 right-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-lg animate-scale-in z-50">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">✓</div>
            <p className="text-sm font-bold text-slate-800">Comparison saved successfully!</p>
          </div>
        </div>
      )}

      {/* AA2000 Official Commercial Sales Quotation Modal */}
      {showQuotationModal && (
        <QuotationModal
          project={{
            id: 'tor-audit',
            name: (torFile?.parsed.fileName || 'Terms of Reference Project').replace(/\.[^.]+$/, ''),
            clientName: quotHeader.company,
            clientContactName: quotHeader.attentionTo,
            clientEmail: quotHeader.emailAdd,
            clientPhone: quotHeader.contactNo,
            locationName: quotHeader.projectSite || 'Project Site',
            location: quotHeader.projectSite,
            assignedTechnicians: [],
            status: 'Completed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Project}
          aiQuotation={null}
          consumables={auditResult?.equipmentComparison.map(eq => ({
            id: crypto.randomUUID(),
            name: eq.name,
            brand: 'Asenware',
            category: 'Hardware',
            quantity: eq.aiQty || eq.technicianQty || 1,
            unit: 'pcs',
            unitPrice: 1850,
            srp: 1850,
            contractorPrice: 1600,
            dealerPrice: 1400,
            totalPrice: 1850 * (eq.aiQty || eq.technicianQty || 1),
          })) || []}
          manpower={auditResult?.manpowerComparison.map(m => ({
            id: crypto.randomUUID(),
            role: m.role,
            headcount: 1,
            hours: m.aiHours || m.technicianHours || 80,
            manDays: Math.ceil((m.aiHours || m.technicianHours || 80) / 8),
            dayRate: 1000,
            totalCost: Math.ceil((m.aiHours || m.technicianHours || 80) / 8) * 1000,
          })) || []}
          fees={[
            { id: '1', type: 'Travel Fee', amount: 12500, description: 'Mobilization/Demobilization/Delivery' },
            { id: '2', type: 'Permit Fee', amount: 10000, description: 'Site Management & Supervision' },
            { id: '3', type: 'Other', amount: 5000, description: 'Admin, Coordination & Waste Disposal' },
          ]}
          quotHeader={quotHeader}
          setQuotHeader={setQuotHeader}
          quotDiscount={quotDiscount}
          setQuotDiscount={setQuotDiscount}
          showEditQuotation={showEditQuotation}
          setShowEditQuotation={setShowEditQuotation}
          onClose={() => setShowQuotationModal(false)}
        />
      )}
    </div>
  );
}
