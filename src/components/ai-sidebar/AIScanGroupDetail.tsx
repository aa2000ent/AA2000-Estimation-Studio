import { useState, useCallback } from 'react';
import type { AIScanGroup, AIScanFile, FileRole } from '../../App';
import { auditTorDocument, type AuditDetails } from '../../services/torAuditorService';
import { useToast } from '../utils/Toast';

interface Props {
  scan: AIScanGroup;
  onBack: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUpdateScan?: (updatedScan: AIScanGroup) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isXls = ext === 'xls' || ext === 'xlsx';
  const isPdf = ext === 'pdf';
  const color = isXls ? '#16A34A' : isPdf ? '#DC2626' : '#2563EB';
  const label = isXls ? 'XLS' : isPdf ? 'PDF' : ext.toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-black shrink-0"
      style={{ background: `linear-gradient(135deg, ${color}CC, ${color}88)` }}
    >
      {label}
    </div>
  );
}

function FileRoleBadge({ role }: { role: string }) {
  const roleLabels: Record<string, string> = {
    tor: 'TOR',
    technician_proposal: 'Technician Proposal',
    floor_plan: 'Floor Plan',
    other: 'Other',
  };
  const roleColors: Record<string, string> = {
    tor: 'bg-blue-100 text-blue-700 border-blue-200',
    technician_proposal: 'bg-amber-100 text-amber-700 border-amber-200',
    floor_plan: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    other: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const label = roleLabels[role] || roleLabels.other;
  const colors = roleColors[role] || roleColors.other;
  
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors}`}>
      {label}
    </span>
  );
}

function ScanFileCard({ file, onRunAudit, onUpdateRole }: { file: AIScanFile; onRunAudit: (file: AIScanFile) => Promise<void>; onUpdateRole?: (file: AIScanFile, newRole: FileRole) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const { toast } = useToast();
  const audit = file.aiResult?.auditDetails;
  
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onUpdateRole) {
      onUpdateRole(file, e.target.value as FileRole);
    }
  };

  const handleRunAudit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditing(true);
    toast.info(`Auditing TOR document "${file.fileName}" with AI...`);
    try {
      await onRunAudit(file);
      toast.success('TOR AI Audit completed successfully!');
      setExpanded(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI Audit failed');
    } finally {
      setAuditing(false);
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!audit) return;
    const todayStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const thStyle = 'background:#F1F5F9;padding:6px 8px;font-weight:700;text-align:left;border-bottom:2px solid #CBD5E1;color:#334155';
    const buildRows = (items: any[], fields: { name: string; tech: string; ai: string; rationale: string }) =>
      (items || []).map((item: any) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #F1F5F9;font-weight:600">${item[fields.name]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #F1F5F9;text-align:right">${item[fields.tech]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #F1F5F9;text-align:right;font-weight:bold">${item[fields.ai]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #F1F5F9;text-align:center">
            <span style="padding:2px 6px;border-radius:4px;font-size:8px;font-weight:bold;${item.variance > 0 ? 'background:#FEF2F2;color:#DC2626' : item.variance < 0 ? 'background:#FFFBEB;color:#D97706' : 'background:#F1F5F9;color:#64748B'}">
              ${item.variance > 0 ? '+' + item.variance : item.variance < 0 ? item.variance : 'Match'}
            </span>
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #F1F5F9">${item[fields.rationale]}</td>
        </tr>`).join('');

    const eqRows = buildRows(audit.equipmentComparison, { name: 'name', tech: 'technicianQty', ai: 'aiQty', rationale: 'rationale' });
    const mpRows = buildRows(audit.manpowerComparison, { name: 'role', tech: 'technicianHours', ai: 'aiHours', rationale: 'rationale' });
    const cRows  = buildRows(audit.consumablesComparison || [], { name: 'name', tech: 'technicianQty', ai: 'aiQty', rationale: 'rationale' });

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1E293B;font-size:11px;line-height:1.5">
        <div style="border-bottom:2px solid #E2E8F0;padding-bottom:15px;margin-bottom:20px">
          <p style="font-size:20px;font-weight:800;color:#1E3A8A;margin:0">AA2000</p>
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#64748B;margin-top:2px;margin-bottom:0">Security and Technology Solutions Inc.</p>
          <h2 style="font-size:15px;font-weight:800;margin-top:15px;margin-bottom:5px;color:#0F172A">AI TOR Audit &amp; Specification Report</h2>
          <div style="font-size:10px;color:#64748B"><strong>Source File:</strong> ${file.fileName}<br><strong>Generated:</strong> ${todayStr}</div>
        </div>
        <div style="display:flex;gap:15px;margin-bottom:20px">
          <div style="flex:1;padding:12px;border:1px solid #E2E8F0;border-radius:8px;background:#F8FAFC">
            <div style="font-size:8px;text-transform:uppercase;font-weight:700;color:#64748B">Baseline / Tech Total</div>
            <div style="font-size:16px;font-weight:800;margin-top:3px;color:#0F172A">&#8369;${audit.totalTechnicianCost.toLocaleString()}</div>
          </div>
          <div style="flex:1;padding:12px;border:1px solid #BFDBFE;border-radius:8px;background:#EFF6FF">
            <div style="font-size:8px;text-transform:uppercase;font-weight:700;color:#2563EB">Reconciled Value</div>
            <div style="font-size:16px;font-weight:800;margin-top:3px;color:#1E40AF">&#8369;${audit.totalAiRecommendedCost.toLocaleString()}</div>
          </div>
          <div style="flex:1;padding:12px;border:1px solid ${audit.varianceAmount > 0 ? '#FED7AA' : '#A7F3D0'};border-radius:8px;background:${audit.varianceAmount > 0 ? '#FFF7ED' : '#ECFDF5'}">
            <div style="font-size:8px;text-transform:uppercase;font-weight:700;color:${audit.varianceAmount > 0 ? '#C2410C' : '#047857'}">Variance</div>
            <div style="font-size:16px;font-weight:800;margin-top:3px;color:${audit.varianceAmount > 0 ? '#C2410C' : '#047857'}">${audit.varianceAmount > 0 ? '+' : ''}&#8369;${audit.varianceAmount.toLocaleString()}</div>
          </div>
        </div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin-bottom:10px">AI Audit Findings</div>
        <div style="padding:12px;border:1px solid #E2E8F0;border-radius:8px;background:#F8FAFC;margin-bottom:20px">${(audit.overallAuditRationale || '').replace(/\n/g, '<br>')}</div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin-bottom:10px">Equipment &amp; Materials (TOR Audit)</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:20px">
          <thead><tr><th style="${thStyle};width:25%">Item</th><th style="${thStyle};width:15%;text-align:right">Baseline</th><th style="${thStyle};width:15%;text-align:right">TOR Rec</th><th style="${thStyle};width:10%;text-align:center">Var</th><th style="${thStyle}">Rationale</th></tr></thead>
          <tbody>${eqRows}</tbody>
        </table>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin-bottom:10px">Labor &amp; Manpower</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:20px">
          <thead><tr><th style="${thStyle};width:25%">Role</th><th style="${thStyle};width:15%;text-align:right">Base Hrs</th><th style="${thStyle};width:15%;text-align:right">AI Hrs</th><th style="${thStyle};width:10%;text-align:center">Var</th><th style="${thStyle}">Rationale</th></tr></thead>
          <tbody>${mpRows}</tbody>
        </table>
        ${cRows ? `<div style="font-size:10px;font-weight:800;text-transform:uppercase;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin-bottom:10px">Consumables &amp; Cabling</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:20px">
          <thead><tr><th style="${thStyle};width:25%">Material</th><th style="${thStyle};width:15%;text-align:right">Baseline</th><th style="${thStyle};width:15%;text-align:right">AI Rec</th><th style="${thStyle};width:10%;text-align:center">Var</th><th style="${thStyle}">Rationale</th></tr></thead>
          <tbody>${cRows}</tbody>
        </table>` : ''}
      </div>`;

    const outer = document.createElement('div');
    outer.style.cssText = 'position:fixed;top:0;left:0;width:816px;height:1px;overflow:hidden;z-index:99999;pointer-events:none';
    const container = document.createElement('div');
    container.style.cssText = 'width:816px;padding:30px;box-sizing:border-box;background:#FFFFFF;overflow:visible';
    container.innerHTML = html;
    outer.appendChild(container);
    document.body.appendChild(outer);
    try {
      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          s.onload = () => resolve(); s.onerror = () => reject();
          document.head.appendChild(s);
        });
      }
      await (window as any).html2pdf().set({
        margin: 0,
        filename: `AA2000_TOR_Audit_${file.fileName.replace(/\.[^.]+$/, '').replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      }).from(container).save();
    } finally {
      document.body.removeChild(outer);
    }
  }, [audit, file.fileName]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileTypeIcon fileName={file.fileName} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800 truncate">{file.fileName}</p>
              <select
                value={file.role || 'other'}
                onChange={handleRoleChange}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-white text-slate-600"
              >
                <option value="tor">TOR</option>
                <option value="technician_proposal">Technician Proposal</option>
                <option value="floor_plan">Floor Plan</option>
                <option value="other">Other</option>
              </select>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{file.fileSizeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {audit ? (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Audit Complete
            </span>
          ) : (
            <button
              onClick={handleRunAudit}
              disabled={auditing}
              className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1 shadow-sm"
            >
              {auditing ? 'Auditing...' : 'Run AI Audit'}
            </button>
          )}
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="p-6 space-y-6 animate-fade-in">
          {audit ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Baseline / Tech Proposed', value: audit.totalTechnicianCost, color: '#334155', bg: '#F8FAFC' },
                  { label: 'AI TOR Recommended', value: audit.totalAiRecommendedCost, color: '#1E40AF', bg: '#EFF6FF' },
                  {
                    label: `Variance ${audit.varianceAmount > 0 ? '(Under-budgeted)' : '(Over-budgeted)'}`,
                    value: audit.varianceAmount,
                    color: audit.varianceAmount > 0 ? '#C2410C' : '#047857',
                    bg: audit.varianceAmount > 0 ? '#FFF7ED' : '#ECFDF5',
                  },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="p-4 rounded-2xl border" style={{ background: bg, borderColor: color + '30' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</div>
                    <div className="text-xl font-black" style={{ color }}>
                      {value > 0 && label.includes('Variance') ? '+' : ''}₱{value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 leading-relaxed font-medium">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">AI Audit Findings</div>
                {audit.overallAuditRationale}
              </div>

              {(audit.equipmentComparison?.length > 0) && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Equipment &amp; Materials (TOR Audit)</h5>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <th className="p-2.5 text-left">Item</th>
                          <th className="p-2.5 text-right w-24">Tech</th>
                          <th className="p-2.5 text-right w-24">AI</th>
                          <th className="p-2.5 text-center w-20">Variance</th>
                          <th className="p-2.5 text-left">Rationale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.equipmentComparison.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="p-2.5 font-semibold text-slate-700">{item.name}</td>
                            <td className="p-2.5 text-right text-slate-500">{item.technicianQty}</td>
                            <td className="p-2.5 text-right font-bold text-slate-800">{item.aiQty}</td>
                            <td className="p-2.5 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${item.variance > 0 ? 'bg-red-50 text-red-600' : item.variance < 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
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

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Audited TOR (PDF)
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-xl">
                📋
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">TOR Document Ready for Audit</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  This document has been stored in this folder. Click below to run a full AI audit to extract requirements, device counts, labor hours, and compliance rationales.
                </p>
              </div>
              {file.aiResult?.summary && (
                <div className="text-left bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 max-h-36 overflow-y-auto font-medium">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Extracted Summary Preview</span>
                  {file.aiResult.summary}
                </div>
              )}
              <button
                disabled={auditing}
                onClick={handleRunAudit}
                className="px-6 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 mx-auto"
                style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563EB)' }}
              >
                {auditing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Auditing TOR with AI...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    Run AI Audit on this TOR
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIScanGroupDetail({ scan, onBack, onRename, onDelete, onUpdateScan }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(scan.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSaveName = () => {
    if (nameInput.trim()) onRename(scan.id, nameInput.trim());
    else setNameInput(scan.name);
    setEditingName(false);
  };

  const handleUpdateFileRole = useCallback((file: AIScanFile, newRole: FileRole) => {
    const updatedFiles = scan.files.map(f => {
      if (f.fileName === file.fileName) {
        return { ...f, role: newRole };
      }
      return f;
    });

    const updatedScan: AIScanGroup = {
      ...scan,
      files: updatedFiles,
    };

    onUpdateScan?.(updatedScan);
  }, [scan, onUpdateScan]);

  const handleRunAuditForFile = async (targetFile: AIScanFile) => {
    const fileContent = targetFile.parsedContent || targetFile.aiResult?.summary || targetFile.fileName;
    
    // Find the technician proposal file if it exists in this scan group
    const technicianProposalFile = scan.files.find(f => f.role === 'technician_proposal');
    const technicianProposalText = technicianProposalFile?.parsedContent || technicianProposalFile?.aiResult?.summary || '';

    // Only run audit if this is a TOR file
    if (targetFile.role !== 'tor') {
      return;
    }

    const auditDetails = await auditTorDocument(targetFile.fileName, fileContent, {
      technicianProposalText: technicianProposalText,
    });

    const updatedFiles = scan.files.map(f => {
      if (f.fileName === targetFile.fileName) {
        return {
          ...f,
          aiResult: {
            ...(f.aiResult || {}),
            auditDetails,
          },
        };
      }
      return f;
    });

    const updatedScan: AIScanGroup = {
      ...scan,
      files: updatedFiles,
    };

    onUpdateScan?.(updatedScan);
  };

  const totalFiles = scan.files.length;
  const auditedFiles = scan.files.filter(f => f.aiResult?.auditDetails).length;

  return (
    <div className="min-h-full bg-slate-50 p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-800 border border-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            {editingName ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') { setNameInput(scan.name); setEditingName(false); }
                  }}
                  className="px-3 py-1 rounded-xl text-sm font-bold border border-blue-400 outline-none text-slate-800"
                  autoFocus
                />
                <button onClick={handleSaveName} className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">Save</button>
                <button onClick={() => { setNameInput(scan.name); setEditingName(false); }} className="px-3 py-1 rounded-xl bg-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-300">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditingName(true)}>
                <h3 className="text-base font-black text-slate-800" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>
                  {scan.name}
                </h3>
                <span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {totalFiles} file{totalFiles !== 1 ? 's' : ''} · {auditedFiles} audited · Saved {formatDate(scan.createdAt)}
            </p>
          </div>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <span className="text-xs font-bold text-red-700">Delete this folder?</span>
            <button onClick={() => { onDelete(scan.id); onBack(); }} className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700">Yes, Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 border border-red-100 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Folder
          </button>
        )}
      </div>

      {/* File cards */}
      <div className="space-y-4">
        {scan.files.map((file, i) => (
          <ScanFileCard 
            key={i} 
            file={file} 
            onRunAudit={handleRunAuditForFile}
            onUpdateRole={handleUpdateFileRole}
          />
        ))}
      </div>
    </div>
  );
}
