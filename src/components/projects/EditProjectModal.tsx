import React, { useState, useEffect } from 'react';
import type { Project } from '../../App';
import { StatBuilding, SectionBuilding, SysShield, Check } from '../../utils/Icons';

interface Props {
  project: Project;
  onClose: () => void;
  onSave: (updatedProject: Project) => void;
}

const BUILDING_TYPES = [
  'Office', 'Office Building', 'Retail', 'Mall / Retail', 'Warehouse', 'Warehouse / Logistics',
  'School', 'School / University', 'Hospital', 'Hospital / Medical', 'Residential',
  'Residential / Condo', 'Hotel / Hospitality', 'Government / BPO', 'Industrial',
  'Industrial / Factory', 'Parking Structure', 'Data Center', 'Other'
];

const AVAILABLE_SYSTEMS: { id: string; label: string }[] = [
  { id: 'CCTV',                label: 'CCTV System' },
  { id: 'FDAS',                label: 'FDAS / Fire Alarm' },
  { id: 'ACCESS_CONTROL',      label: 'Access Control' },
  { id: 'BURGLAR_ALARM',       label: 'Burglar Alarm' },
  { id: 'DOOR_LOCK',           label: 'Door Lock System' },
  { id: 'EAS_SYSTEM',          label: 'EAS Anti-Shoplifting' },
  { id: 'FIRE_PROTECTION',     label: 'Fire Protection / Suppression' },
  { id: 'FIXED_ARM_ELEVATOR',  label: 'Fixed Arm & Elevator' },
  { id: 'INTERCOM_NURSE_CALL', label: 'Intercom & Nurse Call' },
  { id: 'PABX_PAGING',         label: 'PABX & Public Address' },
  { id: 'PARKING_BARRIER',     label: 'Parking Barrier & Toll' },
  { id: 'POS_SYSTEM',          label: 'POS Security System' },
  { id: 'ROOM_ALERT',          label: 'Room Alert & Environmental' },
  { id: 'XRAY_SECURITY',       label: 'X-Ray & Turnstile Walkthrough' },
];

const STATUS_OPTIONS = [
  'Pending',
  'In Progress',
  'Finalized',
  'Finalized - Approved',
  'Finalized - Rejected',
  'Completed',
];

export default function EditProjectModal({ project, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<'general' | 'building' | 'systems'>('general');

  // General details
  const [name, setName] = useState(project.name || '');
  const [clientName, setClientName] = useState(project.clientName || '');
  const [clientContactName, setClientContactName] = useState(project.clientContactName || '');
  const [clientEmail, setClientEmail] = useState(project.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(project.clientPhone || '');
  const [location, setLocation] = useState(project.location || project.locationName || '');
  const [status, setStatus] = useState(project.status || 'Pending');
  const [startDate, setStartDate] = useState(project.startDate || '');

  // Building details
  const [isNewBuilding, setIsNewBuilding] = useState<boolean>(project.isNewBuilding ?? true);
  const [buildingType, setBuildingType] = useState(project.buildingType || '');
  const [floors, setFloors] = useState<number | ''>(project.floors ?? '');
  const [rooms, setRooms] = useState<number | ''>(project.rooms ?? '');
  const [buildingLength, setBuildingLength] = useState<number | ''>(project.buildingLength ?? '');
  const [buildingWidth, setBuildingWidth] = useState<number | ''>(project.buildingWidth ?? '');
  const [floorHeight, setFloorHeight] = useState<number | ''>(project.floorHeight ?? '');
  const [totalFloorArea, setTotalFloorArea] = useState<number | ''>(project.totalFloorArea ?? '');

  // System types & scope
  const [systemTypes, setSystemTypes] = useState<string[]>(project.systemTypes || []);
  const [surveyScope, setSurveyScope] = useState(project.surveyScope || '');

  // Auto-calculate Total Floor Area whenever length, width, or floors change
  useEffect(() => {
    const l = Number(buildingLength) || 0;
    const w = Number(buildingWidth) || 0;
    const f = Number(floors) || 0;
    if (l > 0 && w > 0) {
      setTotalFloorArea(l * w * (f > 0 ? f : 1));
    }
  }, [buildingLength, buildingWidth, floors]);

  const toggleSystem = (sysId: string) => {
    setSystemTypes(prev =>
      prev.includes(sysId) ? prev.filter(s => s !== sysId) : [...prev, sysId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedProject: Project = {
      ...project,
      name: name.trim(),
      clientName: clientName.trim(),
      clientContactName: clientContactName.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      location: location.trim(),
      locationName: location.trim(),
      status,
      startDate: startDate || undefined,
      isNewBuilding,
      buildingType: buildingType || undefined,
      floors: floors !== '' && !isNaN(Number(floors)) ? Number(floors) : undefined,
      rooms: rooms !== '' && !isNaN(Number(rooms)) ? Number(rooms) : undefined,
      buildingLength: buildingLength !== '' && !isNaN(Number(buildingLength)) ? Number(buildingLength) : undefined,
      buildingWidth: buildingWidth !== '' && !isNaN(Number(buildingWidth)) ? Number(buildingWidth) : undefined,
      floorHeight: floorHeight !== '' && !isNaN(Number(floorHeight)) ? Number(floorHeight) : undefined,
      totalFloorArea: totalFloorArea !== '' && !isNaN(Number(totalFloorArea)) ? Number(totalFloorArea) : undefined,
      systemTypes,
      surveyScope: surveyScope.trim() || undefined,
    };

    onSave(updatedProject);
    onClose();
  };

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-black">
              <StatBuilding className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">Edit Project Details</h2>
              <p className="text-[11px] text-slate-400 font-medium">Update structural specifications, client info, and system scope</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 bg-white gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <StatBuilding className="w-3.5 h-3.5" />
            General & Client
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('building')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'building'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <SectionBuilding className="w-3.5 h-3.5" />
            Building Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('systems')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'systems'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <SysShield className="w-3.5 h-3.5" />
            Systems & Scope
            {systemTypes.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-extrabold flex items-center justify-center">
                {systemTypes.length}
              </span>
            )}
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'general' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Tower 1 Security Survey"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Company / Client Organization *</label>
                  <input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Ayala Land Inc."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Contact Person (Optional)</label>
                  <input
                    value={clientContactName}
                    onChange={e => setClientContactName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Email (Optional)</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. juan@company.com"
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Number (Optional)</label>
                  <input
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className={inputCls}
                    placeholder="e.g. 09171234567"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Site Location / Address *</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Bonifacio Global City, Taguig"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Project Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className={`${inputCls} cursor-pointer font-bold`}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Survey Schedule Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'building' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Building Type</label>
                  <select
                    value={buildingType}
                    onChange={e => setBuildingType(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="">Select Building Type...</option>
                    {BUILDING_TYPES.map(bt => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Is New Building?</label>
                  <select
                    value={isNewBuilding ? 'Yes' : 'No'}
                    onChange={e => setIsNewBuilding(e.target.value === 'Yes')}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="Yes">Yes (New Construction)</option>
                    <option value="No">No (Existing Facility)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Floors</label>
                  <input
                    type="number"
                    min={1}
                    value={floors}
                    onChange={e => setFloors(e.target.value === '' ? '' : Number(e.target.value))}
                    className={inputCls}
                    placeholder="e.g. 3"
                  />
                </div>
                <div>
                  <label className={labelCls}>Rooms</label>
                  <input
                    type="number"
                    min={0}
                    value={rooms}
                    onChange={e => setRooms(e.target.value === '' ? '' : Number(e.target.value))}
                    className={inputCls}
                    placeholder="e.g. 12"
                  />
                </div>
                <div>
                  <label className={labelCls}>Floor Height (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={floorHeight}
                    onChange={e => setFloorHeight(e.target.value === '' ? '' : Number(e.target.value))}
                    className={inputCls}
                    placeholder="e.g. 3.5"
                  />
                </div>
                <div>
                  <label className={labelCls}>Total Area (m²)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={totalFloorArea ? `${totalFloorArea} m²` : 'Auto-computed'}
                    className={`${inputCls} bg-slate-50 text-slate-600 font-bold cursor-not-allowed`}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Building Dimensions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Building Length (meters)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={buildingLength}
                      onChange={e => setBuildingLength(e.target.value === '' ? '' : Number(e.target.value))}
                      className={inputCls}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Building Width (meters)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={buildingWidth}
                      onChange={e => setBuildingWidth(e.target.value === '' ? '' : Number(e.target.value))}
                      className={inputCls}
                      placeholder="e.g. 30"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'systems' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className={labelCls}>Assigned System Types</label>
                <p className="text-[11px] text-slate-400 mb-3">Click on the systems required for this site estimation:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AVAILABLE_SYSTEMS.map(sys => {
                    const isSelected = systemTypes.includes(sys.id);
                    return (
                      <button
                        key={sys.id}
                        type="button"
                        onClick={() => toggleSystem(sys.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate mr-1">{sys.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Survey Scope & Engineering Notes</label>
                <textarea
                  rows={4}
                  value={surveyScope}
                  onChange={e => setSurveyScope(e.target.value)}
                  className={`${inputCls} resize-none font-normal leading-relaxed`}
                  placeholder="Specify client special requirements, camera placement zones, containment constraints, or installation deadlines..."
                />
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              {activeTab !== 'general' && (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'systems' ? 'building' : 'general')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  ← Back
                </button>
              )}
              {activeTab !== 'systems' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'general' ? 'building' : 'systems')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  Next Section →
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Project Changes
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
