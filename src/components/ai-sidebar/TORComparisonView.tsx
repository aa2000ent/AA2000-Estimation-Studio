import React, { useState, useCallback } from 'react';
import { parseFile, type ParsedFile } from '../../services/fileParser';
import { auditTorDocument, analyzeProposalOnly, type AuditDetails } from '../../services/torAuditorService';
import { exportAuditPdf } from '../../utils/pdfExporter';
import type { AIScanGroup, AIScanFile } from '../../App';
import { useToast } from '../utils/Toast';
import { canViewPrices } from '../../constants/roles';

interface FileWithContent {
  file: File;
  parsed: ParsedFile;
  loading: boolean;
  error: string | null;
}

interface Props {
  userRole?: string;
  onSaveAIScan?: (scan: AIScanGroup) => Promise<void>;
  onScanningChange?: (scanning: boolean) => void;
}

const TOR_AUDIT_STEPS = [
  'Ingesting & parsing document structure...',
  'Extracting technical specifications & hardware requirements...',
  'Cross-referencing equipment models with Philippine market standards...',
  'Calculating labor ratios, installation man-hours & engineering team...',
  'Auditing cabling lengths, conduits & consumable allowances...',
  'Computing confidence score and finalizing technical audit report...',
];

export default function TORComparisonView({ userRole, onSaveAIScan, onScanningChange }: Props) {
  const { toast } = useToast();
  const showPrices = canViewPrices(userRole);
  const [selectedDocType, setSelectedDocType] = useState<'floor_plan' | 'tor' | 'proposal'>('floor_plan');
  const [torFile, setTorFile] = useState<FileWithContent | null>(null);
  const [proposalFile, setProposalFile] = useState<FileWithContent | null>(null);
  const [auditResult, setAuditResult] = useState<AuditDetails | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [scanGroupName, setScanGroupName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTorFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const file = fileArray[0];
    setTorFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: true, error: null });
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
    try {
      const parsed = await parseFile(file);
      setProposalFile({ file, parsed, loading: false, error: null });
      toast.success(`Proposal "${file.name}" loaded successfully`);
    } catch (err) {
      setProposalFile({ file, parsed: { fileName: file.name, fileType: '', content: '', size: file.size }, loading: false, error: 'Failed to parse file' });
      toast.error(`Failed to parse proposal: ${err}`);
    }
  }, [toast]);

  const removeTorFile = useCallback(() => setTorFile(null), []);
  const removeProposalFile = useCallback(() => setProposalFile(null), []);

  const handleRunComparison = useCallback(async () => {
    const activeFile = selectedDocType === 'proposal' ? proposalFile : torFile;
    if (!activeFile) {
      toast.error('Please select or upload a document to analyze.');
      return;
    }

    setAuditStep(0);
    setAuditing(true);
    setAuditResult(null);
    onScanningChange?.(true);

    const stepInterval = setInterval(() => {
      setAuditStep(prev => (prev < TOR_AUDIT_STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);

    try {
      let auditDetails: AuditDetails;
      if (selectedDocType === 'proposal' && proposalFile) {
        auditDetails = await analyzeProposalOnly(proposalFile.parsed.fileName, proposalFile.parsed.content, proposalFile.file);
      } else if (torFile) {
        auditDetails = await auditTorDocument(torFile.parsed.fileName, torFile.parsed.content, { torFile: torFile.file });
      } else {
        throw new Error('No valid file available for analysis.');
      }
      setAuditResult(auditDetails);
      toast.success('AI Document Analysis completed!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      clearInterval(stepInterval);
      setAuditing(false);
      onScanningChange?.(false);
    }
  }, [selectedDocType, torFile, proposalFile, toast, onScanningChange]);

  const handleSave = useCallback(async () => {
    if (!onSaveAIScan || !scanGroupName.trim() || !auditResult) return;
    const activeFile = selectedDocType === 'proposal' ? proposalFile : torFile;
    if (!activeFile) return;

    const files: AIScanFile[] = [{
      fileName: activeFile.parsed.fileName,
      fileType: activeFile.parsed.fileType || activeFile.parsed.fileName.split('.').pop() || '',
      fileSizeLabel: `${(activeFile.parsed.content.length / 1024).toFixed(1)} KB extracted`,
      parsedContent: activeFile.parsed.content.slice(0, 10000),
      aiResult: { auditDetails: auditResult },
      role: selectedDocType === 'proposal' ? 'technician_proposal' : 'tor',
    }];

    const group: AIScanGroup = {
      id: `scan-${Date.now()}`,
      name: scanGroupName.trim(),
      createdAt: new Date().toISOString(),
      files,
    };

    setIsSaving(true);
    try {
      await onSaveAIScan(group);
      setIsSaved(true);
      setShowSaveModal(false);
      toast.success('Analysis saved successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The analysis could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }, [onSaveAIScan, scanGroupName, selectedDocType, torFile, proposalFile, auditResult, toast]);

  const handleDownload = async () => {
    if (!auditResult) return;
    setDownloading(true);
    toast.info('Generating PDF...');
    try {
      const primaryName = torFile?.parsed.fileName || proposalFile?.parsed.fileName || 'Audit';
      await exportAuditPdf({
        title: `${primaryName.replace(/\.[^.]+$/, '')} — Document Analysis`,
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

  const currentFile = selectedDocType === 'proposal' ? proposalFile : torFile;
  const conf = auditResult?.confidenceScore ?? 0;
  const confLabel = conf >= 75 ? 'High Confidence' : conf >= 50 ? 'Medium Confidence' : conf >= 25 ? 'Low Confidence' : 'Poor Quality';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B132B] transition-colors p-6 overflow-y-auto space-y-6">
      {/* Section Title */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-blue-600 dark:text-blue-400 text-lg">✨</span>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">AI Document Reader</h2>
      </div>

      {/* "What document do you have?" Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          What document do you have?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Floor Plan */}
          <div
            onClick={() => setSelectedDocType('floor_plan')}
            className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between ${
              selectedDocType === 'floor_plan'
                ? 'border-2 border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-blue-300'
            }`}
          >
            <div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 text-sm">
                🗺️
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Floor Plan</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                Identify rooms and select installation areas.
              </p>
            </div>
            <div className="mt-4">
              {selectedDocType === 'floor_plan' ? (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">✓ Selected</span>
              ) : (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Select document type</span>
              )}
            </div>
          </div>

          {/* Card 2: Terms of Reference */}
          <div
            onClick={() => setSelectedDocType('tor')}
            className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between ${
              selectedDocType === 'tor'
                ? 'border-2 border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-blue-300'
            }`}
          >
            <div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 text-sm">
                📄
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Terms of Reference</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                Extract the required systems and specifications.
              </p>
            </div>
            <div className="mt-4">
              {selectedDocType === 'tor' ? (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">✓ Selected</span>
              ) : (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Select document type</span>
              )}
            </div>
          </div>

          {/* Card 3: Proposal */}
          <div
            onClick={() => setSelectedDocType('proposal')}
            className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between ${
              selectedDocType === 'proposal'
                ? 'border-2 border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E] hover:border-blue-300'
            }`}
          >
            <div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 text-sm">
                📋
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Proposal</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                Review proposed equipment and quantities.
              </p>
            </div>
            <div className="mt-4">
              {selectedDocType === 'proposal' ? (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">✓ Selected</span>
              ) : (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Select document type</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashed Upload Dropzone Box */}
      <div className="border-2 border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/10 dark:bg-blue-950/10 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center my-6 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
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
          <div className="flex items-center gap-3 bg-white dark:bg-[#131B2E] p-3 px-5 rounded-2xl border border-blue-200 dark:border-blue-900 shadow-xs mt-2">
            <span className="font-bold text-xs text-slate-800 dark:text-white">{currentFile.parsed.fileName}</span>
            <button
              type="button"
              onClick={() => {
                if (selectedDocType === 'proposal') removeProposalFile();
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
                accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    if (selectedDocType === 'proposal') {
                      handleProposalFiles(e.target.files);
                    } else {
                      handleTorFiles(e.target.files);
                    }
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => toast.info('Sample floor plan loaded!')}
              className="px-5 py-2 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Try Sample Floor Plan
            </button>
          </div>
        )}

        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-2">
          PDF, PNG, JPG, DOCX, XLSX • Preview uses simulated analysis
        </p>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {currentFile ? 'Document ready for AI analysis' : 'Choose a document to enable AI analysis'}
        </span>
        <button
          onClick={handleRunComparison}
          disabled={!currentFile || auditing}
          className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold transition-all cursor-pointer ${
            currentFile
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          <span>✨</span>
          <span>{auditing ? 'Analyzing Document...' : 'Analyze Document'}</span>
        </button>
      </div>

      {/* Real-time AI Audit Scanning Progress Animation */}
      {auditing && (
        <div className="mt-6 rounded-2xl bg-gradient-to-b from-blue-50/90 via-blue-50/40 to-indigo-50/30 border border-blue-200/80 p-6 space-y-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  AI Document Auditor in Progress
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 uppercase tracking-wider">
                    Neural Engine
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Extracting hardware specs, quantities, labor hours &amp; compliance rules from document...
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-blue-700 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
              Step {auditStep + 1} of {TOR_AUDIT_STEPS.length}
            </span>
          </div>
        </div>
      )}

      {/* Results View */}
      {auditResult && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b">
            <h3 className="text-base font-black text-slate-800">AI Document Analysis Results</h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              Confidence Score: {conf}% ({confLabel})
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border text-xs text-slate-700 font-medium leading-relaxed">
            {typeof auditResult.overallAuditRationale === 'string'
              ? auditResult.overallAuditRationale
              : 'Document analysis completed successfully.'}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {downloading ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
            {onSaveAIScan && (
              <button
                onClick={() => {
                  const primaryName = currentFile?.parsed.fileName || 'Document';
                  setScanGroupName(`${primaryName} Analysis`);
                  setShowSaveModal(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Save Analysis
              </button>
            )}
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <h3 className="text-lg font-black text-slate-800 mb-1">Save Analysis</h3>
            <p className="text-xs text-slate-500 mb-4">Enter a folder name for this document analysis.</p>
            <input
              type="text"
              value={scanGroupName}
              onChange={e => setScanGroupName(e.target.value)}
              placeholder="e.g. Building A Blueprint Scan"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-blue-400 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100">Cancel</button>
              <button onClick={handleSave} disabled={isSaving || !scanGroupName.trim()} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
