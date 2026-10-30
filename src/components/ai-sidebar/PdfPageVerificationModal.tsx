import { useState, useEffect } from 'react';
import type { PdfExtractedPage } from '../../utils/pdfPageSeparator';

interface PdfPageVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  pages: PdfExtractedPage[];
  onConfirm: (
    selected: {
      file: File;
      title: string;
      thumbnailUrl: string;
      pageNumber: number;
    }[]
  ) => void;
}

export default function PdfPageVerificationModal({
  isOpen,
  onClose,
  fileName,
  pages,
  onConfirm,
}: PdfPageVerificationModalProps) {
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  const [titleMap, setTitleMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isOpen && pages.length > 0) {
      const initialSelected: Record<number, boolean> = {};
      const initialTitles: Record<number, string> = {};
      pages.forEach((p, idx) => {
        initialSelected[idx] = true;
        initialTitles[idx] = p.defaultTitle || `Page ${p.pageNumber}`;
      });
      setSelectedMap(initialSelected);
      setTitleMap(initialTitles);
    }
  }, [isOpen, pages]);

  if (!isOpen) return null;

  const togglePage = (index: number) => {
    setSelectedMap((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleTitleChange = (index: number, title: string) => {
    setTitleMap((prev) => ({
      ...prev,
      [index]: title,
    }));
  };

  const selectAll = () => {
    const updated: Record<number, boolean> = {};
    pages.forEach((_, idx) => {
      updated[idx] = true;
    });
    setSelectedMap(updated);
  };

  const deselectAll = () => {
    const updated: Record<number, boolean> = {};
    pages.forEach((_, idx) => {
      updated[idx] = false;
    });
    setSelectedMap(updated);
  };

  const selectedCount = Object.values(selectedMap).filter(Boolean).length;

  const handleProceed = () => {
    const result = pages
      .map((p, idx) => {
        if (!selectedMap[idx]) return null;
        return {
          file: p.file,
          title: (titleMap[idx] || '').trim() || p.defaultTitle || `Page ${p.pageNumber}`,
          thumbnailUrl: p.thumbnailUrl,
          pageNumber: p.pageNumber,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="flex flex-col w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* ── Modal Header ── */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Verify &amp; Select Floor Plan Pages
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Found <strong className="text-slate-700 dark:text-slate-200">{pages.length} pages</strong> in <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{fileName}</span>. Each page is separated into an individual floor plan to avoid token limits and increase detection accuracy.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Selection Tools Bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-300">
              Selected: <strong className="text-blue-600 dark:text-blue-400">{selectedCount}</strong> of {pages.length} pages
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* ── Page Grid List ── */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pages.map((p, idx) => {
              const isSelected = Boolean(selectedMap[idx]);
              const titleVal = titleMap[idx] ?? p.defaultTitle;

              return (
                <div
                  key={p.pageNumber}
                  className={`group rounded-xl border p-3 bg-white dark:bg-[#162032] flex flex-col justify-between transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-90'
                  }`}
                >
                  {/* Top card row: checkbox + page number */}
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePage(idx)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        Page {p.pageNumber}
                      </span>
                    </label>

                    {isSelected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        Included
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Preview */}
                  <div
                    onClick={() => togglePage(idx)}
                    className="relative w-full aspect-4/3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer mb-2.5"
                  >
                    <img
                      src={p.thumbnailUrl}
                      alt={`Page ${p.pageNumber}`}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Title Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Floor Title <span className="font-normal lowercase text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={titleVal}
                      disabled={!isSelected}
                      onChange={(e) => handleTitleChange(idx, e.target.value)}
                      placeholder="e.g. Ground Floor, 2nd Floor"
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B2E]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel / Keep Single PDF
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={selectedCount === 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
          >
            <span>Proceed with {selectedCount} Selected Floor Plan{selectedCount !== 1 ? 's' : ''}</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
