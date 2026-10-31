import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SYSTEM_OPTIONS, type SystemType } from '../estimation/CreateSurveyForm';
import { systemBadgeIcons } from '../../utils/Icons';

interface FloorPlanCardSystemSelectorProps {
  floorTitle?: string;
  selected: SystemType[];
  onChange: (systems: SystemType[]) => void;
  onApplyToAll?: (systems?: SystemType[]) => void;
  hasMultiplePlans?: boolean;
}

export default function FloorPlanCardSystemSelector({
  floorTitle = 'this floor plan',
  selected = [],
  onChange,
  onApplyToAll,
  hasMultiplePlans = false,
}: FloorPlanCardSystemSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<SystemType[]>([]);
  const [search, setSearch] = useState('');

  // Open modal and initialize draft with current selected systems
  const handleOpenModal = () => {
    setDraft([...selected]);
    setSearch('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const toggleDraft = (type: SystemType) => {
    setDraft((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const removeSelected = (type: SystemType) => {
    onChange(selected.filter((t) => t !== type));
  };

  const selectAll = () => {
    setDraft(SYSTEM_OPTIONS.map((opt) => opt.type));
  };

  const clearAll = () => {
    setDraft([]);
  };

  const selectPreset = (types: SystemType[]) => {
    setDraft((prev) => Array.from(new Set([...prev, ...types])));
  };

  const handleSave = () => {
    onChange(draft);
    setIsModalOpen(false);
  };

  const handleApplyToAllAndSave = () => {
    onChange(draft);
    setIsModalOpen(false);
    onApplyToAll?.(draft);
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return SYSTEM_OPTIONS;
    const q = search.toLowerCase();
    return SYSTEM_OPTIONS.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.type.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-1.5 pt-1">
      {/* Header Bar */}
      <div className="flex items-center justify-between text-[10px]">
        <label className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <span>Systems to Estimate</span>
          <span
            className={`font-extrabold px-1.5 py-0.2 rounded-md ${
              selected.length > 0
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
            }`}
          >
            {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
          </span>
        </label>

        <div className="flex items-center gap-1.5 text-[10px] font-semibold">
          {hasMultiplePlans && onApplyToAll && selected.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onApplyToAll?.(selected)}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                title="Copy these selected systems to all uploaded floor plans"
              >
                Copy to all
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
            </>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-slate-400 hover:text-red-500 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Trigger Box & Selected Badges on Card */}
      <div className="flex flex-wrap items-center gap-1 min-h-[34px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
        {selected.length === 0 ? (
          <button
            type="button"
            onClick={handleOpenModal}
            className="w-full text-left px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between cursor-pointer rounded transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-blue-500 font-bold text-sm">+</span>
              <span>Select systems for this floor plan…</span>
            </span>
            <span className="text-blue-500 font-bold text-[10px] bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
              Choose
            </span>
          </button>
        ) : (
          <>
            {selected.map((type) => {
              const opt = SYSTEM_OPTIONS.find((o) => o.type === type);
              const IconComp = systemBadgeIcons[type];
              const label = opt ? opt.label.replace(/ System$/, '') : type;

              return (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100/90 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 shadow-2xs"
                >
                  {IconComp && <IconComp className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                  <span className="truncate max-w-[120px]">{label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSelected(type);
                    }}
                    className="hover:text-red-500 ml-0.5 text-slate-400 cursor-pointer"
                    title={`Remove ${label}`}
                  >
                    ✕
                  </button>
                </span>
              );
            })}

            <button
              type="button"
              onClick={handleOpenModal}
              className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-950/60 cursor-pointer flex items-center gap-1 transition-colors border border-blue-200/50 dark:border-blue-800/50"
            >
              <span>+ Add / Edit</span>
              <span className="text-[10px]">⚙</span>
            </button>
          </>
        )}
      </div>

      {/* ── Modal Popover In Front of the Card (Portaled to Body) ── */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
            onClick={handleCloseModal}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="flex flex-col w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                <div className="min-w-0 pr-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    System Configuration
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-0.5">
                    Select Systems for {floorTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Choose which systems will be installed on this floor plan. The AI will tailor hardware counts and recommendations accordingly.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search & Quick Presets Bar */}
              <div className="p-3.5 sm:px-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131B2E] flex flex-wrap items-center justify-between gap-2.5">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search systems (e.g. CCTV, fire, lock)..."
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() =>
                      selectPreset(['CCTV', 'ACCESS_CONTROL', 'BURGLAR_ALARM', 'DOOR_LOCK'])
                    }
                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 cursor-pointer"
                  >
                    Security
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPreset(['FDAS', 'FIRE_PROTECTION'])}
                    className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 cursor-pointer"
                  >
                    Fire Safety
                  </button>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-2 py-1 rounded-md text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-2 py-1 rounded-md text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Grid of 14 Systems — Pure button elements without input bubbling */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/40 dark:bg-slate-900/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredOptions.map((opt) => {
                    const isChecked = draft.includes(opt.type);
                    const IconComp = systemBadgeIcons[opt.type];

                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => toggleDraft(opt.type)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          isChecked
                            ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/60 shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#162032] hover:border-blue-300 dark:hover:border-blue-800'
                        }`}
                      >
                        {/* Custom Reliable Checkbox Box */}
                        <div
                          className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Icon */}
                        <span
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isChecked
                              ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {IconComp && <IconComp className="w-4 h-4" />}
                        </span>

                        {/* Label */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-bold leading-tight truncate ${
                              isChecked
                                ? 'text-blue-900 dark:text-blue-200'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {opt.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 px-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    <strong className="text-blue-600 dark:text-blue-400">{draft.length}</strong> system{draft.length !== 1 ? 's' : ''} selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasMultiplePlans && onApplyToAll && draft.length > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyToAllAndSave}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                    >
                      Save &amp; Apply to All Floors
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    Apply to {floorTitle}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
