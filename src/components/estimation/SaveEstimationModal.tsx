import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SurveyFormData, SystemType } from './CreateSurveyForm';
import { BUILDING_TYPES } from './CreateEstimationFlow';
import type {
  EstimationFlowAiContext,
  SaveEstimationFn,
} from '../../services/estimationWizardSnapshot';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Persists the estimation to the database. */
  onSave: SaveEstimationFn;
  /** AI analysis carried into the saved snapshot (API #1/#2/#3, any subset). */
  ai: EstimationFlowAiContext;
  /** Uploaded file name — prefills the Project Name field. */
  fileName?: string;
  /** Systems picked before the analysis — supplies the saved system scope (no UI here). */
  initialSystemTypes?: SystemType[];
  /** Called once the database accepted the record. */
  onSaved?: (res: { message?: string; projId?: number }) => void;
}

type SaveForm = {
  companyName: string;
  projectName: string;
  clientName: string;
  clientContactNumber: string;
  clientEmail: string;
  locationName: string;
  buildingType: string;
  startDate: string;
  systemTypes: SystemType[];
};

/**
 * Shared save dialog: the client-details form from the Manual Estimation
 * wizard, shown as a modal. Used by the AI Estimation document analysis and
 * the floor-plan analysis views. The system scope is not selectable here —
 * it is the selection made before the analysis (initialSystemTypes).
 */
export default function SaveEstimationModal({
  open,
  onClose,
  onSave,
  ai,
  fileName,
  initialSystemTypes,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ message?: string; projId?: number } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<SaveForm>(() => ({
    companyName: '',
    projectName: (fileName || '').replace(/\.[^.]+$/, ''),
    clientName: '',
    clientContactNumber: '',
    clientEmail: '',
    locationName: '',
    buildingType: '',
    startDate: new Date().toISOString().slice(0, 10),
    systemTypes: [],
  }));

  useEffect(() => {
    if (open) {
      setSaveError('');
      setSuccess(null);
      // Pre-analysis system selection carries into the form.
      if (initialSystemTypes && initialSystemTypes.length > 0) {
        setForm(prev => ({ ...prev, systemTypes: [...initialSystemTypes] }));
      }
    }
  }, [open, initialSystemTypes]);

  const update = (field: keyof SaveForm, raw: string): void => {
    if (field === 'systemTypes') return;
    const value = field === 'clientContactNumber' ? raw.replace(/\D/g, '').slice(0, 11) : raw;
    setForm(prev => ({ ...prev, [field]: value }) as SaveForm);
  };

  const validateSaveForm = (): string | null => {
    if (!form.companyName.trim()) return 'Please enter the Company Name.';
    if (!form.projectName.trim()) return 'Please enter the Project Name.';
    if (!form.locationName.trim()) return 'Please enter the Location Name / Area.';
    if (!form.buildingType) return 'Please select the Building Type.';
    if (!form.startDate) return 'Please select the Survey Schedule Date.';
    if (form.systemTypes.length === 0) return 'Please select at least one system type.';
    return null;
  };

  const handleSave = async () => {
    if (saving || success) return;
    const invalid = validateSaveForm();
    if (invalid) {
      setSaveError(invalid);
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      const data: SurveyFormData = {
        companyName: form.companyName.trim(),
        projectName: form.projectName.trim(),
        clientEmail: form.clientEmail.trim(),
        clientName: form.clientName.trim(),
        clientContactNumber: form.clientContactNumber.trim(),
        locationName: form.locationName.trim(),
        latitude: 0,
        longitude: 0,
        surveyScope: `AI estimation analysis${fileName ? ` of ${fileName}` : ''}`,
        systemTypes: form.systemTypes,
        buildingType: form.buildingType,
        floors: '',
        buildingLength: '',
        buildingWidth: '',
        floorHeight: '',
        startDate: form.startDate,
      };
      const res = await onSave(data, ai);
      if (res.success) {
        setSuccess({ message: res.message, projId: res.projId });
        onSaved?.({ message: res.message, projId: res.projId });
      } else {
        setSaveError(res.message || 'Could not save the estimation to the database.');
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Could not save the estimation to the database.'
      );
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  if (!open) return null;

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    required = false,
    type = 'text'
  ) => (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500"
      />
    </div>
  );

  const cardHeading = (text: string) => (
    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
      {text}
    </p>
  );

  // Portaled to <body>: an ancestor with a transform (animate-fade-in-up keeps
  // translateY(0) via fill-mode both) would otherwise become the containing
  // block for position:fixed and center the dialog inside the main content.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Save estimation to database"
    >
      <div
        className="bg-white dark:bg-[#131B2E] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {success ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              {cardHeading('SAVE TO DATABASE')}
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Estimation saved
              </h3>
            </div>

            <div className="p-3.5 px-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
              {success.projId ? `Saved to the database (Project #${success.projId}).` : 'Saved to the database.'}{' '}
              The project is now pending validation in the Estimation workspace.
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={close}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                {cardHeading('SAVE TO DATABASE')}
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Client details &amp; system selection
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  The same form as the Manual Estimation wizard — required before this analysis can
                  be saved.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-sm font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Client details (wizard: PROJECT INFORMATION) */}
            <div className="space-y-4">
              {cardHeading('CLIENT DETAILS')}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {field('Company Name', form.companyName, v => update('companyName', v), 'e.g. ABC Corporation Philippines', true)}
                {field('Project Name', form.projectName, v => update('projectName', v), 'e.g. Headquarters CCTV Install', true)}
                {field('Client Contact Name (Optional)', form.clientName, v => update('clientName', v), 'e.g. Juan Dela Cruz')}
                {field('Client Contact Number (Optional)', form.clientContactNumber, v => update('clientContactNumber', v), 'e.g. 09171234567')}
              </div>
              {field('Client Email Address (Optional)', form.clientEmail, v => update('clientEmail', v), 'e.g. client@email.com')}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {field('Location Name / Area', form.locationName, v => update('locationName', v), 'e.g. Makati City, Manila', true)}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                    Building Type *
                  </label>
                  <select
                    value={form.buildingType}
                    onChange={e => update('buildingType', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select building type</option>
                    {BUILDING_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {field('Survey Schedule Date', form.startDate, v => update('startDate', v), '', true, 'date')}
              </div>
            </div>

            {/* Save error */}
            {saveError && (
              <div
                className="p-3.5 px-4 bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 font-semibold leading-relaxed"
                role="alert"
              >
                {saveError}
              </div>
            )}

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer ${
                  saving
                    ? 'bg-blue-400 cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                }`}
              >
                {saving ? 'Saving to database…' : 'Save Estimation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
