import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../utils/Toast';
import { exportBOQPdf } from '../../utils/pdfExporter';

interface SavedBOQ {
  key: string;
  label: string;
  systems: string[];
  savedAt: string;
  result: {
    confidenceScore: number;
    observations: string;
    manpower: { role: string; headcount: number; hours: number; manDays: number; ratePerDay?: number; totalCost?: number }[];
    consumables: { name: string; category: string; quantity: number; unit: string; unitPrice?: number; srp?: number; totalPrice?: number }[];
    fees: { type: string; description?: string; amount: number }[];
    constraints: { physical: string; electrical: string; installation: string };
  };
}

function loadBOQs(): SavedBOQ[] {
  const out: SavedBOQ[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('aa2000_floorplan_')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      out.push({ key, ...data });
    } catch { /* skip corrupt */ }
  }
  return out.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

const confidenceColor = (score: number) =>
  score >= 76 ? '#16A34A' : score >= 51 ? '#CA8A04' : score >= 26 ? '#EA580C' : '#DC2626';

const confidenceLabel = (score: number) =>
  score >= 76 ? 'High Confidence' : score >= 51 ? 'Medium Confidence' : score >= 26 ? 'Low Confidence' : 'Poor Quality';

import { canViewPrices } from '../../constants/roles';

export default function SavedBOQsView({ userRole }: { userRole?: string }) {
  const { toast, confirm } = useToast();
  const showPrices = canViewPrices(userRole);
  const [boqs, setBOQs] = useState<SavedBOQ[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const refresh = useCallback(() => setBOQs(loadBOQs()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (boq: SavedBOQ) => {
    const ok = await confirm(`Delete saved BOQ "${boq.label}"? This cannot be undone.`);
    if (!ok) return;
    localStorage.removeItem(boq.key);
    refresh();
    toast.success(`"${boq.label}" deleted.`);
    if (expandedKey === boq.key) setExpandedKey(null);
  };

  if (boqs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
        </div>
        <h3 className="text-sm font-black text-slate-800 mb-1">No Saved BOQs Yet</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
          Generate a BOQ from the <strong>Floor Plan AI</strong> tab and click <strong>Save BOQ Result</strong> to store it here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Saved Floor Plan BOQs</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{boqs.length} saved result{boqs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {boqs.map(boq => {
        const isOpen = expandedKey === boq.key;
        const cc = confidenceColor(boq.result.confidenceScore);
        const date = new Date(boq.savedAt).toLocaleDateString('en-PH', {
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });

        return (
          <div key={boq.key} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {/* Card Header */}
            <div className="flex items-center gap-4 px-5 py-4">
              {/* Confidence ring */}
              <div className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-[11px] font-black border-2"
                style={{ borderColor: cc, color: cc, background: cc + '10' }}>
                {boq.result.confidenceScore}%
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{boq.label}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {boq.systems.map(s => (
                    <span key={s} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{s}</span>
                  ))}
                  <span className="text-[9px] text-slate-400">{date}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    toast.info('Generating PDF...');
                    try {
                      await exportBOQPdf({
                        title: boq.label,
                        projectName: boq.label,
                        systems: boq.systems,
                        confidenceScore: boq.result.confidenceScore,
                        observations: boq.result.observations,
                        manpower: boq.result.manpower,
                        consumables: boq.result.consumables,
                        fees: boq.result.fees,
                        constraints: boq.result.constraints,
                      });
                      toast.success('PDF downloaded!');
                    } catch {
                      toast.error('Failed to generate PDF.');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1"
                  title="Export PDF"
                >
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </button>
                <button
                  onClick={() => setExpandedKey(isOpen ? null : boq.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                  style={isOpen
                    ? { background: '#1E3A8A', color: '#fff', borderColor: '#1E3A8A' }
                    : { background: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}
                >
                  {isOpen ? 'Close' : 'View'}
                </button>
                <button
                  onClick={() => handleDelete(boq)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expandable Detail */}
            {isOpen && (
              <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4 bg-slate-50/50">
                {/* Observations */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">AI Summary</p>
                  <p className="text-xs text-blue-900 leading-relaxed">{boq.result.observations}</p>
                </div>

                {/* Confidence bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                    style={{ color: cc, borderColor: cc + '40', background: cc + '12' }}>
                    {confidenceLabel(boq.result.confidenceScore)}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${boq.result.confidenceScore}%`, background: cc }} />
                  </div>
                  <span className="text-xs font-black" style={{ color: cc }}>{boq.result.confidenceScore}%</span>
                </div>

                {/* Manpower */}
                {boq.result.manpower.length > 0 && (() => {
                  const totalMpCost = boq.result.manpower.reduce((sum, m) => sum + (m.totalCost || (m.ratePerDay || 0) * m.manDays), 0);
                  return (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Manpower Breakdown</span>
                        <span className="text-[9px] text-slate-400">{boq.result.manpower.reduce((a, m) => a + m.manDays, 0)} total man-days</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="px-4 py-2 text-left font-bold text-slate-500">Role</th>
                          <th className="px-4 py-2 text-right font-bold text-slate-500">HC</th>
                          <th className="px-4 py-2 text-right font-bold text-slate-500">Hours</th>
                          <th className="px-4 py-2 text-right font-bold text-slate-500">Man-Days</th>
                          <th className="px-4 py-2 text-right font-bold text-slate-500">Day Rate (₱)</th>
                          <th className="px-4 py-2 text-right font-bold text-slate-500">Total Cost (₱)</th>
                        </tr></thead>
                        <tbody>
                          {boq.result.manpower.map((m, i) => {
                            const rate = m.ratePerDay || 0;
                            const cost = m.totalCost || rate * m.manDays;
                            return (
                              <tr key={i} className="border-b border-slate-50">
                                <td className="px-4 py-2 font-semibold text-slate-800">{m.role}</td>
                                <td className="px-4 py-2 text-right text-slate-600">{m.headcount}</td>
                                <td className="px-4 py-2 text-right text-slate-600">{m.hours}h</td>
                                <td className="px-4 py-2 text-right font-black text-blue-700">{m.manDays}</td>
                                <td className="px-4 py-2 text-right text-slate-600 font-medium">&#8369;{rate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-2 text-right font-black text-slate-800">&#8369;{cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/70 border-t border-slate-200">
                            <td colSpan={5} className="px-4 py-2 font-bold text-slate-700 text-right">Total Manpower Cost:</td>
                            <td className="px-4 py-2 text-right font-black text-blue-700">&#8369;{totalMpCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}

                {/* Bill of Materials */}
                {boq.result.consumables.length > 0 && (() => {
                  const totalMatCost = boq.result.consumables.reduce((sum, c) => sum + (c.totalPrice || (c.unitPrice || c.srp || 0) * c.quantity), 0);
                  return (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Bill of Materials</span>
                        <span className="text-[9px] text-slate-400">{boq.result.consumables.length} items</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50"><tr className="border-b border-slate-100">
                            <th className="px-4 py-2 text-left font-bold text-slate-500">Item</th>
                            <th className="px-4 py-2 text-left font-bold text-slate-500">Category</th>
                            <th className="px-4 py-2 text-right font-bold text-slate-500">Qty</th>
                            <th className="px-4 py-2 text-left font-bold text-slate-500">Unit</th>
                            {showPrices && (
                              <>
                                <th className="px-4 py-2 text-right font-bold text-slate-500">Unit Price (₱)</th>
                                <th className="px-4 py-2 text-right font-bold text-slate-500">Total Price (₱)</th>
                              </>
                            )}
                          </tr></thead>
                          <tbody>
                            {boq.result.consumables.map((c, i) => {
                              const unitPrice = c.unitPrice || c.srp || 0;
                              const totalPrice = c.totalPrice || unitPrice * c.quantity;
                              return (
                                <tr key={i} className={`border-b border-slate-50 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                                  <td className="px-4 py-2 font-semibold text-slate-800">{c.name}</td>
                                  <td className="px-4 py-2"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{c.category}</span></td>
                                  <td className="px-4 py-2 text-right font-black text-slate-800">{c.quantity}</td>
                                  <td className="px-4 py-2 text-slate-400">{c.unit || '—'}</td>
                                  {showPrices && (
                                    <>
                                      <td className="px-4 py-2 text-right text-slate-600 font-medium">&#8369;{unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                      <td className="px-4 py-2 text-right font-black text-slate-800">&#8369;{totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          {showPrices && (
                            <tfoot>
                              <tr className="bg-slate-100/70 border-t border-slate-200">
                                <td colSpan={5} className="px-4 py-2 font-bold text-slate-700 text-right">Total Materials Price:</td>
                                <td className="px-4 py-2 text-right font-black text-emerald-700">&#8369;{totalMatCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Fees */}
                {boq.result.fees.filter(f => f.amount > 0).length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Additional Fees</span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {boq.result.fees.filter(f => f.amount > 0).map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{f.type}</p>
                            {f.description && <p className="text-[10px] text-slate-400">{f.description}</p>}
                          </div>
                          <span className="text-xs font-black text-slate-700">&#8369;{f.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints */}
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Installation Constraints</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {[
                      { label: 'Physical', value: boq.result.constraints.physical },
                      { label: 'Electrical', value: boq.result.constraints.electrical },
                      { label: 'Installation', value: boq.result.constraints.installation },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                        <p className="text-xs text-slate-700 leading-relaxed mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Exported so Dashboard/Sidebar can read the count without rendering the full component */
export function getSavedBOQCount(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('aa2000_floorplan_')) count++;
  }
  return count;
}
