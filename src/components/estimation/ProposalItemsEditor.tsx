import { useState, useMemo } from 'react';
import type {
  EstimationAdditionalFeeEntry,
  EstimationConsumableEntry,
  EstimationManpowerEntry,
} from '../../types';
import { computeEstimationStats, laborLineTotal, materialLineTotal } from '../../services/estimationStats';

interface ProposalItemsEditorProps {
  systems: string[];
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  onUpdateManpower: (next: EstimationManpowerEntry[]) => void;
  onUpdateConsumables: (next: EstimationConsumableEntry[]) => void;
  onUpdateFees: (next: EstimationAdditionalFeeEntry[]) => void;
  onApplyChanges: () => void;
  onResetDefaults: () => void;
  onClose: () => void;
  isGenerating?: boolean;
  includedSystems?: string[];
  onToggleSystemInclusion?: (systemName: string) => void;
}

const isCable = (item: EstimationConsumableEntry): boolean =>
  /cable|wire|utp|fiber|fibre/i.test(`${item.category} ${item.name}`) &&
  !/cable tray|cable tie|cable clip/i.test(item.name);

const isRough = (item: EstimationConsumableEntry): boolean =>
  /rough|conduit|pipe|pvc|trunk|junction|mount|bracket|fastener|anchor|clamp|tape|connector|label|cable tray|cable tie/i.test(
    `${item.category} ${item.name}`
  );

const uid = (prefix = 'item'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const money = (val: number): string =>
  `PHP ${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProposalItemsEditor({
  systems,
  manpower,
  consumables,
  fees,
  onUpdateManpower,
  onUpdateConsumables,
  onUpdateFees,
  onApplyChanges,
  onResetDefaults,
  onClose,
  isGenerating = false,
  includedSystems = [],
  onToggleSystemInclusion,
}: ProposalItemsEditorProps) {
  const normalizedSystems = useMemo(() => {
    const list = (systems && systems.length > 0) ? systems : ['CCTV'];
    return list.map(s => {
      const u = s.toUpperCase();
      if (/FDAS|FIRE/i.test(u)) return 'FDAS';
      if (/CCTV/i.test(u)) return 'CCTV';
      if (/ACCESS/i.test(u)) return 'ACCESS CONTROL';
      return s;
    });
  }, [systems]);

  const [activeSystem, setActiveSystem] = useState<string>(normalizedSystems[0] || 'CCTV');

  // Match system for materials
  const isSysMatchMat = (item: EstimationConsumableEntry, sys: string): boolean => {
    const text = `${item.systemLabel || ''} ${item.systemType || ''} ${item.category || ''} ${item.name}`.toUpperCase();
    const sUpper = sys.toUpperCase();
    if (/FDAS|FIRE/i.test(sUpper)) return /FDAS|FIRE/i.test(text);
    if (/CCTV/i.test(sUpper)) return /CCTV|CAMERA|SURVEILLANCE|NVR/i.test(text);
    if (/ACCESS/i.test(sUpper)) return /ACCESS|DOOR|LOCK/i.test(text);
    return text.includes(sUpper);
  };

  // Match system for labor
  const isSysMatchLab = (row: EstimationManpowerEntry, sys: string): boolean => {
    const text = `${row.role} ${row.responsibilities || ''}`.toUpperCase();
    const sUpper = sys.toUpperCase();
    if (/FDAS|FIRE/i.test(sUpper)) return /FDAS|FIRE/i.test(text);
    if (/CCTV/i.test(sUpper)) return /CCTV|CAMERA|SURVEILLANCE|NVR/i.test(text);
    if (/ACCESS/i.test(sUpper)) return /ACCESS|DOOR|LOCK/i.test(text);
    return text.includes(sUpper) || (!/FDAS|FIRE|ACCESS/i.test(text) && sys === normalizedSystems[0]);
  };

  // Match system for fees
  const isSysMatchFee = (fee: EstimationAdditionalFeeEntry, sys: string): boolean => {
    const text = `${fee.type} ${fee.description || ''} ${fee.notes || ''}`.toUpperCase();
    const sUpper = sys.toUpperCase();
    if (/FDAS|FIRE/i.test(sUpper)) return /FDAS|FIRE/i.test(text);
    if (/CCTV/i.test(sUpper)) return /CCTV|CAMERA|SURVEILLANCE/i.test(text);
    if (/ACCESS/i.test(sUpper)) return /ACCESS|DOOR|LOCK/i.test(text);
    return text.includes(sUpper) || (!/FDAS|FIRE|ACCESS/i.test(text) && sys === normalizedSystems[0]);
  };

  const isCurrentIncluded = includedSystems.length === 0 || includedSystems.some(s =>
    s.toUpperCase().includes(activeSystem.toUpperCase()) || activeSystem.toUpperCase().includes(s.toUpperCase())
  );

  // Grouped items for current system
  const currentActive = consumables.filter(i => isSysMatchMat(i, activeSystem) && !isCable(i) && !isRough(i));
  const currentRough = consumables.filter(i => isSysMatchMat(i, activeSystem) && isRough(i) && !isCable(i));
  const currentCable = consumables.filter(i => isSysMatchMat(i, activeSystem) && isCable(i));
  const currentLabor = manpower.filter(r => isSysMatchLab(r, activeSystem));
  const currentFees = fees.filter(f => isSysMatchFee(f, activeSystem));

  // Calculations for current section and total
  const sectionStats = computeEstimationStats(currentLabor, [...currentActive, ...currentRough, ...currentCable], currentFees);

  const includedConsumables = useMemo(() => {
    if (!includedSystems || includedSystems.length === 0) return consumables;
    return consumables.filter(item =>
      includedSystems.some(sys => isSysMatchMat(item, sys))
    );
  }, [consumables, includedSystems]);

  const includedManpower = useMemo(() => {
    if (!includedSystems || includedSystems.length === 0) return manpower;
    return manpower.filter(row =>
      includedSystems.some(sys => isSysMatchLab(row, sys))
    );
  }, [manpower, includedSystems]);

  const includedFees = useMemo(() => {
    if (!includedSystems || includedSystems.length === 0) return fees;
    return fees.filter(fee =>
      includedSystems.some(sys => isSysMatchFee(fee, sys))
    );
  }, [fees, includedSystems]);

  const totalStats = computeEstimationStats(includedManpower, includedConsumables, includedFees);

  // Handlers for consumable updates
  const handleUpdateConsumable = (id: string, patch: Partial<EstimationConsumableEntry>) => {
    onUpdateConsumables(
      consumables.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...patch };
        if (patch.quantity != null || patch.unitPrice != null) {
          const qty = Number(updated.quantity) || 0;
          const price = Number(updated.unitPrice) || 0;
          updated.totalPrice = qty * price;
        }
        return updated;
      })
    );
  };

  const handleRemoveConsumable = (id: string) => {
    onUpdateConsumables(consumables.filter(item => item.id !== id));
  };

  const handleAddConsumable = (type: 'active' | 'rough' | 'cable') => {
    const sysTag = activeSystem === 'FDAS' ? 'FDAS' : activeSystem === 'ACCESS CONTROL' ? 'ACCESS CONTROL' : 'CCTV';
    const newItem: EstimationConsumableEntry = {
      id: uid(`custom_${type}`),
      name:
        type === 'active'
          ? 'New Active Device'
          : type === 'rough'
          ? 'Conduit Pipe / Box Fitting'
          : 'Communication / Power Cable',
      productId: 'NEW-ITEM',
      brand: 'Generic',
      category: sysTag,
      systemType: sysTag,
      systemLabel: sysTag,
      quantity: 1,
      unit: type === 'cable' ? 'm' : 'pcs',
      unitPrice: 1000,
      totalPrice: 1000,
      notes: type === 'rough' ? 'Roughing-ins conduit & accessories' : type === 'cable' ? 'Signal / Network cable' : 'Active system device',
    };
    onUpdateConsumables([...consumables, newItem]);
  };

  // Handlers for manpower updates
  const handleUpdateManpower = (id: string, patch: Partial<EstimationManpowerEntry>) => {
    onUpdateManpower(
      manpower.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, ...patch };
        if (patch.dayRate != null || patch.manDays != null || patch.hours != null || patch.headcount != null) {
          updated.totalCost = laborLineTotal(updated);
        }
        return updated;
      })
    );
  };

  const handleRemoveManpower = (id: string) => {
    onUpdateManpower(manpower.filter(r => r.id !== id));
  };

  const handleAddManpower = () => {
    const newLabor: EstimationManpowerEntry = {
      id: uid('custom_lab'),
      role: `${activeSystem} Installation Specialist`,
      headcount: 2,
      hours: 16,
      manDays: 2,
      dayRate: 1800,
      totalCost: 7200,
      responsibilities: `Installation, testing, and commissioning for ${activeSystem}.`,
    };
    onUpdateManpower([...manpower, newLabor]);
  };

  // Handlers for fee updates
  const handleUpdateFee = (id: string, patch: Partial<EstimationAdditionalFeeEntry>) => {
    onUpdateFees(
      fees.map(f => {
        if (f.id !== id) return f;
        return { ...f, ...patch };
      })
    );
  };

  const handleRemoveFee = (id: string) => {
    onUpdateFees(fees.filter(f => f.id !== id));
  };

  const handleAddFee = () => {
    const newFee: EstimationAdditionalFeeEntry = {
      id: uid('custom_fee'),
      type: 'mobilization',
      amount: 2500,
      description: `Mobilization and Safety Logistics for ${activeSystem}`,
      notes: activeSystem,
    };
    onUpdateFees([...fees, newFee]);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 p-5 space-y-6 animate-fade-in-up">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              ✏️ Proposal Items &amp; Scope Editor
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              Full Control
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Add, edit, or remove line items for each proposal table. The AI has provided standard default components.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Reset to AI Defaults
          </button>
          <button
            type="button"
            onClick={onApplyChanges}
            disabled={isGenerating}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-all disabled:opacity-60 shadow-xs"
          >
            {isGenerating ? 'Updating PDF…' : 'Apply & Update PDF'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* System Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {normalizedSystems.map((sys, idx) => {
          const isSysIncluded = includedSystems.length === 0 || includedSystems.some(s =>
            s.toUpperCase().includes(sys.toUpperCase()) || sys.toUpperCase().includes(s.toUpperCase())
          );
          return (
            <button
              key={sys}
              type="button"
              onClick={() => setActiveSystem(sys)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeSystem === sys
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-[#131B2E] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              <span>{sys === 'FDAS' ? '🚨' : sys === 'ACCESS CONTROL' ? '🔐' : '📹'}</span>
              <span>Section {idx + 1} — {sys === 'FDAS' ? 'FDAS (Fire Alarm System)' : sys}</span>
              {includedSystems.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  isSysIncluded
                    ? activeSystem === sys ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  {isSysIncluded ? 'SHOW' : 'HIDDEN'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Section Inclusion Control for Project Proposal */}
      <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Show in Proposal:
          </span>
          <button
            type="button"
            onClick={() => onToggleSystemInclusion?.(activeSystem)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
              isCurrentIncluded
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-300 dark:border-slate-700'
            }`}
          >
            <span>{isCurrentIncluded ? '✓ Showing in Proposal' : '✕ Hidden from Proposal'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {isCurrentIncluded
            ? `Section tables and breakdown for ${activeSystem} will appear in the proposal PDF.`
            : `Section ${activeSystem} will be omitted from the project proposal report and cost total.`}
        </p>
      </div>

      {/* 5 Quotation Tables Editor for Active System */}
      <div className="space-y-5">
        {/* TABLE A: GENERAL REQUIREMENTS */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-amber-300/20 dark:bg-amber-950/40 border-b border-amber-300/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              A. General Requirements ({currentFees.length} items)
            </span>
            <button
              type="button"
              onClick={handleAddFee}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              + Add Requirement
            </button>
          </div>
          <div className="p-3 overflow-x-auto">
            {currentFees.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No general requirements. Click &quot;+ Add Requirement&quot; to add.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                    <th className="pb-1.5 w-8">#</th>
                    <th className="pb-1.5">Description</th>
                    <th className="pb-1.5 w-36 text-right">Amount (PHP)</th>
                    <th className="pb-1.5 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentFees.map((fee, idx) => (
                    <tr key={fee.id}>
                      <td className="py-2 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={fee.description || ''}
                          onChange={e => handleUpdateFee(fee.id, { description: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          placeholder="Description (e.g. Mobilization, Testing)"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          value={fee.amount ?? ''}
                          onChange={e => handleUpdateFee(fee.id, { amount: Number(e.target.value) || 0 })}
                          className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-right font-mono"
                          step="100"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveFee(fee.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* TABLE B: SCOPE OF WORKS (INSTALLATION LABOR) */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-amber-300/20 dark:bg-amber-950/40 border-b border-amber-300/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              B. Scope of Works / Installation Labor ({currentLabor.length} roles)
            </span>
            <button
              type="button"
              onClick={handleAddManpower}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              + Add Labor Role
            </button>
          </div>
          <div className="p-3 overflow-x-auto">
            {currentLabor.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No labor roles recorded. Click &quot;+ Add Labor Role&quot; to add.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                    <th className="pb-1.5 w-8">#</th>
                    <th className="pb-1.5">Role &amp; Responsibilities</th>
                    <th className="pb-1.5 w-16 text-center">Pax</th>
                    <th className="pb-1.5 w-16 text-center">Hours</th>
                    <th className="pb-1.5 w-20 text-center">Man-Days</th>
                    <th className="pb-1.5 w-28 text-right">Day Rate</th>
                    <th className="pb-1.5 w-28 text-right">Total Price</th>
                    <th className="pb-1.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentLabor.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="py-2 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={row.role || ''}
                          onChange={e => handleUpdateManpower(row.id, { role: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold mb-1"
                          placeholder="Role (e.g. FDAS Lead Technician)"
                        />
                        <input
                          type="text"
                          value={row.responsibilities || ''}
                          onChange={e => handleUpdateManpower(row.id, { responsibilities: e.target.value })}
                          className="w-full px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-500"
                          placeholder="Responsibilities / Scope details"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={row.headcount ?? 1}
                          onChange={e => handleUpdateManpower(row.id, { headcount: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-12 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center font-mono"
                          min="1"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={row.hours ?? 8}
                          onChange={e => handleUpdateManpower(row.id, { hours: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-12 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center font-mono"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={row.manDays ?? 1}
                          onChange={e => handleUpdateManpower(row.id, { manDays: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center font-mono"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          value={row.dayRate ?? ''}
                          onChange={e => handleUpdateManpower(row.id, { dayRate: Number(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-right font-mono"
                          step="100"
                        />
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {money(laborLineTotal(row))}
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveManpower(row.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* TABLE C: ACTIVE COMPONENTS */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-amber-300/20 dark:bg-amber-950/40 border-b border-amber-300/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              C. Active Components ({currentActive.length} items)
            </span>
            <button
              type="button"
              onClick={() => handleAddConsumable('active')}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              + Add Active Component
            </button>
          </div>
          <div className="p-3 overflow-x-auto">
            {currentActive.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No active components. Click &quot;+ Add Active Component&quot; to add.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                    <th className="pb-1.5 w-8">#</th>
                    <th className="pb-1.5 w-28">Model / Code</th>
                    <th className="pb-1.5">Description &amp; Notes</th>
                    <th className="pb-1.5 w-24">Brand</th>
                    <th className="pb-1.5 w-16 text-center">Qty</th>
                    <th className="pb-1.5 w-16 text-center">Unit</th>
                    <th className="pb-1.5 w-24 text-right">Unit Price</th>
                    <th className="pb-1.5 w-28 text-right">Total Price</th>
                    <th className="pb-1.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentActive.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.productId || ''}
                          onChange={e => handleUpdateConsumable(item.id, { productId: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                          placeholder="Model #"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateConsumable(item.id, { name: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold mb-1"
                          placeholder="Device Description"
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={e => handleUpdateConsumable(item.id, { notes: e.target.value })}
                          className="w-full px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-500"
                          placeholder="Specifications / details"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.brand || ''}
                          onChange={e => handleUpdateConsumable(item.id, { brand: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          placeholder="Brand"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => handleUpdateConsumable(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center font-mono"
                          min="1"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="text"
                          value={item.unit || 'pcs'}
                          onChange={e => handleUpdateConsumable(item.id, { unit: e.target.value })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          value={item.unitPrice ?? ''}
                          onChange={e => handleUpdateConsumable(item.id, { unitPrice: Number(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-right font-mono"
                          step="10"
                        />
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {money(materialLineTotal(item))}
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveConsumable(item.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* TABLE D: ROUGHING-INS MATERIALS */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-amber-300/20 dark:bg-amber-950/40 border-b border-amber-300/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              D. Roughing-ins Materials ({currentRough.length} items)
            </span>
            <button
              type="button"
              onClick={() => handleAddConsumable('rough')}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              + Add Roughing-in Item
            </button>
          </div>
          <div className="p-3 overflow-x-auto">
            {currentRough.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No roughing-ins recorded. Click &quot;+ Add Roughing-in Item&quot; to add.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                    <th className="pb-1.5 w-8">#</th>
                    <th className="pb-1.5 w-28">Model / Code</th>
                    <th className="pb-1.5">Description &amp; Specifications</th>
                    <th className="pb-1.5 w-24">Brand</th>
                    <th className="pb-1.5 w-16 text-center">Qty</th>
                    <th className="pb-1.5 w-16 text-center">Unit</th>
                    <th className="pb-1.5 w-24 text-right">Unit Price</th>
                    <th className="pb-1.5 w-28 text-right">Total Price</th>
                    <th className="pb-1.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentRough.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.productId || ''}
                          onChange={e => handleUpdateConsumable(item.id, { productId: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                          placeholder="Code"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateConsumable(item.id, { name: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold mb-1"
                          placeholder="Conduit / Box item"
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={e => handleUpdateConsumable(item.id, { notes: e.target.value })}
                          className="w-full px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-500"
                          placeholder="Roughing-in notes"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.brand || ''}
                          onChange={e => handleUpdateConsumable(item.id, { brand: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          placeholder="Brand"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => handleUpdateConsumable(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center font-mono"
                          min="1"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="text"
                          value={item.unit || 'pcs'}
                          onChange={e => handleUpdateConsumable(item.id, { unit: e.target.value })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          value={item.unitPrice ?? ''}
                          onChange={e => handleUpdateConsumable(item.id, { unitPrice: Number(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-right font-mono"
                          step="10"
                        />
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {money(materialLineTotal(item))}
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveConsumable(item.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* TABLE E: CABLE COMPONENTS */}
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-amber-300/20 dark:bg-amber-950/40 border-b border-amber-300/30 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              E. Cable Components ({currentCable.length} items)
            </span>
            <button
              type="button"
              onClick={() => handleAddConsumable('cable')}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              + Add Cable Item
            </button>
          </div>
          <div className="p-3 overflow-x-auto">
            {currentCable.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No cable components. Click &quot;+ Add Cable Item&quot; to add.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                    <th className="pb-1.5 w-8">#</th>
                    <th className="pb-1.5 w-28">Model / Code</th>
                    <th className="pb-1.5">Description &amp; Specifications</th>
                    <th className="pb-1.5 w-24">Brand</th>
                    <th className="pb-1.5 w-16 text-center">Qty</th>
                    <th className="pb-1.5 w-16 text-center">Unit</th>
                    <th className="pb-1.5 w-24 text-right">Unit Price</th>
                    <th className="pb-1.5 w-28 text-right">Total Price</th>
                    <th className="pb-1.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentCable.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.productId || ''}
                          onChange={e => handleUpdateConsumable(item.id, { productId: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                          placeholder="Code"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleUpdateConsumable(item.id, { name: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold mb-1"
                          placeholder="Cable item"
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={e => handleUpdateConsumable(item.id, { notes: e.target.value })}
                          className="w-full px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-500"
                          placeholder="Wire specifications"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.brand || ''}
                          onChange={e => handleUpdateConsumable(item.id, { brand: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          placeholder="Brand"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => handleUpdateConsumable(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center font-mono"
                          min="1"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="text"
                          value={item.unit || 'm'}
                          onChange={e => handleUpdateConsumable(item.id, { unit: e.target.value })}
                          className="w-14 px-1 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          value={item.unitPrice ?? ''}
                          onChange={e => handleUpdateConsumable(item.id, { unitPrice: Number(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-right font-mono"
                          step="5"
                        />
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {money(materialLineTotal(item))}
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveConsumable(item.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
            {activeSystem} Section Subtotal (VAT Exclusive):
          </span>
          <span className="text-base font-black text-slate-900 dark:text-white">
            {money(sectionStats.subtotal)}
          </span>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Project Subtotal:</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{money(totalStats.subtotal)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">12% VAT:</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{money(totalStats.vat)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Amount (VAT Inc.):</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{money(totalStats.grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
