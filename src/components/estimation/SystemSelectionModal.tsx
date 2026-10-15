import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SYSTEM_OPTIONS, type SystemType } from './CreateSurveyForm';
import { Check, systemBadgeIcons } from '../../utils/Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Commits the selection — only reached with at least one system. */
  onConfirm: (selected: SystemType[]) => void;
  /** Current selection, reloaded into the draft every time the modal opens. */
  selected?: SystemType[];
  eyebrow?: string;
  title?: string;
  description?: string;
  allowAddOnly?: boolean;
}

/**
 * Pre-analysis system selection dialog. The chosen systems scope every
 * analysis endpoint (strict system scope) and prefill the save form, so the
 * selection is collected here before the analysis runs.
 */
export default function SystemSelectionModal({
  open,
  onClose,
  onConfirm,
  selected = [],
  eyebrow = 'System Types *',
  title = 'Systems for this project',
  description = 'Selected before the analysis — the AI scopes its recommendations to these systems.',
  allowAddOnly = false,
}: Props) {
  const [draft, setDraft] = useState<SystemType[]>(selected);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(selected);
      setError('');
    }
  }, [open, selected]);

  if (!open) return null;

  const toggle = (type: SystemType) =>
    setDraft(prev =>
      prev.includes(type)
        ? allowAddOnly
          ? prev
          : prev.filter(t => t !== type)
        : [...prev, type]
    );

  const confirm = () => {
    if (draft.length === 0) {
      setError('Select at least one system type.');
      return;
    }
    onConfirm(draft);
  };

  // Portaled to <body> so the fixed overlay centers on the screen (an
  // ancestor with a transform would otherwise become its containing block).
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="System types"
    >
      <div
        className="bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 sm:p-7"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {eyebrow}
            </p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
              {title}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xs font-black cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEM_OPTIONS.map(opt => {
            const isSelected = draft.includes(opt.type);
            const IconComp = systemBadgeIcons[opt.type];
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => toggle(opt.type)}
                aria-pressed={isSelected}
                className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/60'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-800'
                }`}
              >
                <span className={`shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {IconComp ? <IconComp className="h-4 w-4" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[11px] font-black ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {opt.label}
                  </span>
                  {isSelected && (
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
          {draft.length === 0
            ? 'Select at least one system type to continue.'
            : `${draft.length} system type${draft.length === 1 ? '' : 's'} selected.`}
        </p>

        {error && (
          <div className="mt-3 p-3 px-4 bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 font-semibold">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Apply Selection
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
