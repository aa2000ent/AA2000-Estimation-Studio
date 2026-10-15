import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SurveyFormData, SystemType } from './CreateSurveyForm';
import { BUILDING_TYPES } from './CreateEstimationFlow';
import type {
  EstimationFlowAiContext,
  SaveEstimationFn,
} from '../../services/estimationWizardSnapshot';
import type { Project } from '../../App';

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
  /** Optional project list for client lookup */
  projects?: Project[];
  /** Called once the database accepted the record. */
  onSaved?: (res: { message?: string; projId?: number; pdfUrl?: string }) => void;
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

export default function SaveEstimationModal({
  open,
  onClose,
  onSave,
  ai,
  fileName,
  initialSystemTypes,
  projects = [],
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ message?: string; projId?: number; pdfUrl?: string } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
      setTouched({});
      if (initialSystemTypes && initialSystemTypes.length > 0) {
        setForm(prev => ({ ...prev, systemTypes: [...initialSystemTypes] }));
      }
    }
  }, [open, initialSystemTypes]);

  const update = (field: keyof SaveForm, raw: string): void => {
    if (field === 'systemTypes') return;
    const value = field === 'clientContactNumber' ? raw.replace(/\D/g, '').slice(0, 11) : raw;
    setForm(prev => ({ ...prev, [field]: value }) as SaveForm);
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Client lookup filtering
  const matchingClients = projects.filter(p => {
    if (!clientSearch.trim()) return false;
    const term = clientSearch.toLowerCase();
    return (
      p.clientName?.toLowerCase().includes(term) ||
      p.name?.toLowerCase().includes(term) ||
      p.clientContactName?.toLowerCase().includes(term)
    );
  });

  const handleSelectClient = (p: Project) => {
    setForm(prev => ({
      ...prev,
      companyName: p.clientName || p.name,
      clientName: p.clientContactName || '',
      clientEmail: p.clientEmail || '',
      clientContactNumber: p.clientPhone || '',
      locationName: p.locationName || p.location || '',
    }));
    setClientSearch(p.clientName || p.name);
    setShowClientDropdown(false);
  };

  // Required Field Checks
  const isCompanyNameValid = Boolean(form.companyName.trim());
  const isProjectNameValid = Boolean(form.projectName.trim());
  const isLocationValid = Boolean(form.locationName.trim());
  const isBuildingTypeValid = Boolean(form.buildingType);
  const isStartDateValid = Boolean(form.startDate);

  const isFormValid =
    isCompanyNameValid &&
    isProjectNameValid &&
    isLocationValid &&
    isBuildingTypeValid &&
    isStartDateValid;

  const handleSave = async () => {
    if (saving || success || !isFormValid) return;
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
        systemTypes: form.systemTypes.length > 0 ? form.systemTypes : ['CCTV'],
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

  const renderField = (
    label: string,
    fieldKey: keyof SaveForm,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    required = false,
    type = 'text'
  ) => {
    const isInvalid = required && touched[fieldKey] && !value.trim();
    return (
      <div>
        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          {label}
          {required ? <span className="text-red-500 font-bold ml-1">*</span> : ''}
        </label>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setTouched(prev => ({ ...prev, [fieldKey]: true }))}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-xs font-semibold border rounded-xl outline-none transition-colors ${
            isInvalid
              ? 'border-red-500 bg-red-50/20 text-red-900 focus:border-red-600'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:border-blue-500'
          }`}
        />
        {isInvalid && (
          <p className="text-[10px] font-bold text-red-500 mt-1">This field is required.</p>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Save estimation to database"
    >
      <div
        className="bg-white dark:bg-[#131B2E] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 font-black text-2xl flex items-center justify-center mx-auto">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Estimation Saved Successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {success.projId ? `Project #${success.projId} registered in database.` : 'Project record stored.'}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold leading-relaxed text-left">
              The project details and BOQ analysis have been saved. You can review or edit the estimate from the Dashboard workspace.
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={close}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  SAVE TO DATABASE
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Save Estimation Project
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Fill in client &amp; project information to store this estimate in the database.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-sm font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Existing Client Lookup */}
            {projects.length > 0 && (
              <div className="relative bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1.5">
                  🔍 Look Up Existing Client / Company
                </label>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Type company name or contact person..."
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-blue-200 dark:border-blue-800 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
                {showClientDropdown && matchingClients.length > 0 && (
                  <div className="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50 p-2 space-y-1">
                    {matchingClients.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectClient(p)}
                        className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between"
                      >
                        <div>
                          <p>{p.clientName || p.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal">{p.locationName || p.location}</p>
                        </div>
                        <span className="text-[10px] text-blue-600 font-bold">Autofill →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Group 1: CLIENT & COMPANY INFORMATION */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                1. Client &amp; Company Information
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderField('Company Name', 'companyName', form.companyName, v => update('companyName', v), 'e.g. ABC Corporation Philippines', true)}
                {renderField('Client Contact Name', 'clientName', form.clientName, v => update('clientName', v), 'e.g. Juan Dela Cruz')}
                {renderField('Client Email Address', 'clientEmail', form.clientEmail, v => update('clientEmail', v), 'e.g. client@email.com')}
                {renderField('Client Contact Number', 'clientContactNumber', form.clientContactNumber, v => update('clientContactNumber', v), 'e.g. 09171234567')}
              </div>
            </div>

            {/* Group 2: PROJECT & SITE DETAILS */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                2. Project &amp; Site Details
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderField('Project Name', 'projectName', form.projectName, v => update('projectName', v), 'e.g. Headquarters CCTV Install', true)}
                {renderField('Location Name / Area', 'locationName', form.locationName, v => update('locationName', v), 'e.g. Makati City, Manila', true)}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                    Building Type <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    value={form.buildingType}
                    onChange={e => update('buildingType', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, buildingType: true }))}
                    className={`w-full px-3 py-2 text-xs font-semibold border rounded-xl outline-none cursor-pointer ${
                      touched.buildingType && !form.buildingType
                        ? 'border-red-500 bg-red-50/20 text-red-900'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:border-blue-500'
                    }`}
                  >
                    <option value="">Select building type</option>
                    {BUILDING_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {touched.buildingType && !form.buildingType && (
                    <p className="text-[10px] font-bold text-red-500 mt-1">Please select building type.</p>
                  )}
                </div>
                {renderField('Survey Schedule Date', 'startDate', form.startDate, v => update('startDate', v), '', true, 'date')}
              </div>
            </div>

            {/* Error banner */}
            {saveError && (
              <div className="p-3.5 px-4 bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-300 font-semibold leading-relaxed">
                {saveError}
              </div>
            )}

            {/* Actions */}
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
                disabled={saving || !isFormValid}
                title={!isFormValid ? "Please fill in all required fields (Company Name, Project Name, Location, Building Type, and Schedule Date) to save." : "Save Estimation to Database"}
                className={`px-6 py-2.5 rounded-full text-xs font-bold text-white transition-all shadow-md ${
                  saving || !isFormValid
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-blue-500/20'
                }`}
              >
                {saving ? 'Saving to Database...' : 'Save Estimation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
