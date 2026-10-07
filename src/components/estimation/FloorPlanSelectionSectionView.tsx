import React, { useState } from 'react';

interface Room {
  id: string;
  name: string;
  selected: boolean;
}

interface ItemSuggestion {
  id: string;
  item: string;
  area: string;
  quantity: number;
}

interface Props {
  onBackToDocument?: () => void;
  onViewEstimate?: () => void;
  onCreateAnother?: () => void;
  isDark?: boolean;
}

export default function FloorPlanSelectionSectionView({
  onBackToDocument,
  onViewEstimate,
  onCreateAnother,
  isDark = false,
}: Props) {
  // Wizard steps: 2 = Select areas, 3 = Review, 4 = Summary, 5 = Saved
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);

  // Step 2 State
  const [rooms, setRooms] = useState<Room[]>([
    { id: 'lobby', name: 'Lobby', selected: false },
    { id: 'office', name: 'Office', selected: false },
    { id: 'meeting', name: 'Meeting Room', selected: false },
    { id: 'storage', name: 'Storage', selected: false },
  ]);

  // Step 3 State
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([
    { id: 's1', item: 'CCTV camera', area: 'Office', quantity: 2 },
    { id: 's2', item: 'CCTV camera', area: 'Meeting Room', quantity: 2 },
  ]);

  const toggleRoom = (id: string) => {
    setRooms(prev =>
      prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const selectedRooms = rooms.filter(r => r.selected);
  const selectedCount = selectedRooms.length;

  const handleAnalyzeSections = () => {
    if (selectedCount === 0) return;

    // Generate suggestions based on selected rooms
    const newItems: ItemSuggestion[] = selectedRooms.map((r, i) => ({
      id: `s-${i}-${Date.now()}`,
      item: 'CCTV camera',
      area: r.name,
      quantity: 2,
    }));

    setSuggestions(newItems.length > 0 ? newItems : [
      { id: 's1', item: 'CCTV camera', area: 'Office', quantity: 2 },
      { id: 's2', item: 'CCTV camera', area: 'Meeting Room', quantity: 2 },
    ]);

    setStep(3);
  };

  const handleAddItem = () => {
    setSuggestions(prev => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        item: 'CCTV camera',
        area: selectedRooms[0]?.name || 'Lobby',
        quantity: 1,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ItemSuggestion, value: any) => {
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const totalQuantity = suggestions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const selectedAreaNames = selectedRooms.map(r => r.name).join(', ') || 'Office, Meeting Room';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ── STEP 2: SELECT FLOOR-PLAN SECTIONS ── */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Select floor-plan sections
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              AI extracted these sections. Select where AA2000 items will be installed.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              2. Select areas
            </span>
            <span>3. Review</span>
            <span>4. Summary</span>
          </div>

          {/* 2-Column Layout: Blueprint Box Left, Checkbox List Right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blueprint Diagram Box */}
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Office-floor-plan.pdf
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Ground floor • Sample extracted layout
                </p>
              </div>

              {/* Blueprint Frame with 4 Room Boxes & Corridor */}
              <div className="border-4 border-slate-400 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-6 flex flex-col gap-6 select-none my-2">
                {/* Top Row: Lobby & Office */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Lobby */}
                  <div
                    onClick={() => toggleRoom('lobby')}
                    className={`h-24 sm:h-28 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all duration-200 ${
                      rooms.find(r => r.id === 'lobby')?.selected
                        ? 'bg-blue-100 dark:bg-blue-950/80 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {rooms.find(r => r.id === 'lobby')?.selected && (
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">✓</span>
                    )}
                    <span className="text-xs font-bold leading-tight">Lobby</span>
                  </div>

                  {/* Office */}
                  <div
                    onClick={() => toggleRoom('office')}
                    className={`h-24 sm:h-28 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all duration-200 ${
                      rooms.find(r => r.id === 'office')?.selected
                        ? 'bg-blue-100 dark:bg-blue-950/80 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {rooms.find(r => r.id === 'office')?.selected && (
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">✓</span>
                    )}
                    <span className="text-xs font-bold leading-tight">Office</span>
                  </div>
                </div>

                {/* Corridor Label */}
                <div className="text-center text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase py-1">
                  C O R R I D O R
                </div>

                {/* Bottom Row: Meeting Room & Storage */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Meeting Room */}
                  <div
                    onClick={() => toggleRoom('meeting')}
                    className={`h-24 sm:h-28 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all duration-200 ${
                      rooms.find(r => r.id === 'meeting')?.selected
                        ? 'bg-blue-100 dark:bg-blue-950/80 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {rooms.find(r => r.id === 'meeting')?.selected && (
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">✓</span>
                    )}
                    <span className="text-xs font-bold leading-tight">Meeting Room</span>
                  </div>

                  {/* Storage */}
                  <div
                    onClick={() => toggleRoom('storage')}
                    className={`h-24 sm:h-28 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-all duration-200 ${
                      rooms.find(r => r.id === 'storage')?.selected
                        ? 'bg-blue-100 dark:bg-blue-950/80 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-[#131B2E] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {rooms.find(r => r.id === 'storage')?.selected && (
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1">✓</span>
                    )}
                    <span className="text-xs font-bold leading-tight">Storage</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Sections Checkbox List Right */}
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
                  Detected sections
                </h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-6">
                  {selectedCount} of {rooms.length} selected
                </p>

                {/* Checkbox Items */}
                <div className="space-y-4">
                  {rooms.map(room => (
                    <label
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      className="flex items-center gap-3 cursor-pointer select-none group"
                    >
                      <input
                        type="checkbox"
                        checked={room.selected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span
                        className={`text-sm font-bold transition-colors ${
                          room.selected
                            ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                            : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                        }`}
                      >
                        {room.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
                Select rooms on the plan or in this list.
              </p>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => onBackToDocument && onBackToDocument()}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back to Document
            </button>

            <button
              type="button"
              onClick={handleAnalyzeSections}
              disabled={selectedCount === 0}
              className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
                selectedCount > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              Analyze Selected Sections
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW AI SUGGESTIONS ── */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Review AI suggestions
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Office Security Installation
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span>2. Select areas</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              3. Review
            </span>
            <span>4. Summary</span>
          </div>

          {/* Notice Banner */}
          <div className="p-3.5 px-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Review each suggested item and quantity. These are illustrative results, not verified installation recommendations.
          </div>

          {/* Items Table Card */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="grid grid-cols-12 gap-3 text-xs font-bold text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="col-span-5">Item</span>
              <span className="col-span-4">Area</span>
              <span className="col-span-2">Quantity</span>
              <span className="col-span-1 text-center" />
            </div>

            <div className="space-y-3">
              {suggestions.map(s => (
                <div key={s.id} className="grid grid-cols-12 gap-3 items-center">
                  <input
                    type="text"
                    value={s.item}
                    onChange={e => handleUpdateItem(s.id, 'item', e.target.value)}
                    className="col-span-5 px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={s.area}
                    onChange={e => handleUpdateItem(s.id, 'area', e.target.value)}
                    className="col-span-4 px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    value={s.quantity}
                    onChange={e => handleUpdateItem(s.id, 'quantity', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-500 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(s.id)}
                    className="col-span-1 w-7 h-7 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-xs font-black mx-auto transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>+ Add Item</span>
              </button>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              Continue to Summary
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: ESTIMATE SUMMARY ── */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Estimate summary
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Review the scope before saving.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-1">
            <span>1. Documents</span>
            <span>2. Select areas</span>
            <span>3. Review</span>
            <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              4. Summary
            </span>
          </div>

          {/* Summary Card */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Office Security Installation
              </h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">
                Floor Plan • Office-floor-plan.pdf
              </p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                Selected areas: {selectedAreaNames}
              </p>
            </div>

            {/* Items Breakdown Table */}
            <div className="border-t border-b border-slate-100 dark:border-slate-800 py-4 space-y-3">
              <div className="grid grid-cols-12 text-xs font-bold text-slate-400 dark:text-slate-500 pb-1">
                <span className="col-span-6">Item</span>
                <span className="col-span-4">Area</span>
                <span className="col-span-2 text-right">Qty</span>
              </div>
              {suggestions.map(s => (
                <div key={s.id} className="grid grid-cols-12 text-xs font-semibold text-slate-800 dark:text-slate-200 py-1 border-t border-slate-50 dark:border-slate-800/50">
                  <span className="col-span-6">{s.item}</span>
                  <span className="col-span-4 text-slate-500">{s.area}</span>
                  <span className="col-span-2 text-right font-bold">{s.quantity}</span>
                </div>
              ))}
            </div>

            {/* Pricing Pending Banner */}
            <div className="space-y-1">
              <h3 className="text-lg font-black text-blue-600 dark:text-blue-400">
                Pricing pending
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Use the approved AA2000 catalog to finalize prices.
              </p>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Back to Edit
            </button>

            <button
              type="button"
              onClick={() => setStep(5)}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              Save Draft Estimate
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: ESTIMATE SAVED (COMPLETION) ── */}
      {step === 5 && (
        <div className="space-y-6 animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Estimate saved
            </h1>
          </div>

          {/* Completion Card */}
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xs space-y-6">
            <div className="text-emerald-500 text-4xl font-black">
              ✓
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Your draft estimate is ready
              </h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                Office Security Installation
              </p>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                {suggestions.length} item types • {totalQuantity} total units • Pricing pending
              </p>
            </div>

            <div>
              <span className="px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                DRAFT SAVED — PREVIEW
              </span>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onViewEstimate && onViewEstimate()}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all cursor-pointer"
              >
                View Estimate
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onCreateAnother) onCreateAnother();
                  setStep(2);
                }}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all"
              >
                Create Another Estimate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
