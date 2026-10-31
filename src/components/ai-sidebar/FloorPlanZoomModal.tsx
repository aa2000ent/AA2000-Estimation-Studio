import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isPdfFile } from '../../utils/pdfPageSeparator';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

interface FloorPlanZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  thumbnailUrl?: string;
  title: string;
  pageNumber?: number;
  currentIndex: number;
  totalCount: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function FloorPlanZoomModal({
  isOpen,
  onClose,
  file,
  thumbnailUrl,
  title,
  pageNumber,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
}: FloorPlanZoomModalProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highResUrl, setHighResUrl] = useState<string | null>(null);
  const [isLoadingHighRes, setIsLoadingHighRes] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset viewport state when opening or switching files
  useEffect(() => {
    if (isOpen) {
      setScale(1.0);
      setPan({ x: 0, y: 0 });
      setRotation(0);
    }
  }, [isOpen, file, pageNumber]);

  // Load high-resolution preview URL
  useEffect(() => {
    if (!isOpen || !file) {
      setHighResUrl(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    if (!isPdfFile(file)) {
      // Normal image file (PNG, JPG, WebP)
      createdUrl = URL.createObjectURL(file);
      setHighResUrl(createdUrl);
      setIsLoadingHighRes(false);
      return () => {
        if (createdUrl) URL.revokeObjectURL(createdUrl);
      };
    }

    // PDF file rendering high-res vector preview
    setIsLoadingHighRes(true);
    async function renderHighResPdf() {
      try {
        const arrayBuffer = await file!.arrayBuffer();
        const task = getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await task.promise;
        const page = await pdf.getPage(pageNumber || 1);

        // Render at scale 2.0 for razor-sharp blueprint reading
        const baseViewport = page.getViewport({ scale: 1.0 });
        const targetLongEdge = 2400;
        const fitScale = targetLongEdge / Math.max(baseViewport.width, baseViewport.height);
        const renderScale = Math.max(1.5, Math.min(fitScale, 3.0));
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvas, viewport, background: '#ffffff' }).promise;
        void task.destroy();

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
        );

        if (!active || !blob) return;
        createdUrl = URL.createObjectURL(blob);
        setHighResUrl(createdUrl);
      } catch (err) {
        console.warn('Failed to render high-res PDF in zoom viewer:', err);
      } finally {
        if (active) setIsLoadingHighRes(false);
      }
    }

    void renderHighResPdf();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [isOpen, file, pageNumber]);

  // Zoom helpers
  const handleZoomIn = () => setScale((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 6.0));
  const handleZoomOut = () => setScale((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 0.25));
  const handleResetZoom = () => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((prev) => {
      const next = prev + zoomFactor;
      return Math.min(Math.max(Number(next.toFixed(2)), 0.25), 6.0);
    });
  }, []);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrev && currentIndex > 0) {
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext && currentIndex < totalCount - 1) {
        onNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onPrev, onNext, currentIndex, totalCount]);

  if (!isOpen || !file) return null;

  const displayUrl = highResUrl || thumbnailUrl;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in select-none">
      {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-900/80 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5 4 6v13.5l5-1.5 6 1.5 5-1.5V4.5l-5 1.5-6-1.5Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v13.5M15 6v13.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white truncate max-w-md">
                {title || file.name}
              </h2>
              {pageNumber && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Page {pageNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>

        {/* Center: Previous / Next Floor Plan switcher */}
        {totalCount > 1 && (
          <div className="flex items-center gap-2 bg-slate-800/80 rounded-xl px-2.5 py-1 border border-slate-700">
            <button
              type="button"
              onClick={onPrev}
              disabled={currentIndex <= 0}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Floor Plan (Left Arrow)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-bold text-slate-200 px-1">
              {currentIndex + 1} of {totalCount}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Floor Plan (Right Arrow)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Right: Close button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Viewer (Esc)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main Pan/Zoom Interactive Workspace ── */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleResetZoom}
        className={`relative flex-1 overflow-hidden flex items-center justify-center p-4 bg-[#0a0f1d] ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* Subtle grid pattern for blueprint look */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle, #3b82f6 1px, transparent 1px), radial-gradient(circle, #3b82f6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0, 20px 20px',
          }}
        />

        {/* Loading Indicator */}
        {isLoadingHighRes && !displayUrl && (
          <div className="absolute z-20 flex flex-col items-center gap-3 text-slate-300">
            <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-semibold">Rendering high-resolution blueprint…</span>
          </div>
        )}

        {/* Image / Canvas Display */}
        {displayUrl ? (
          <div
            className="transition-transform duration-75 ease-out max-w-none"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={displayUrl}
              alt={title || file.name}
              draggable={false}
              className="max-h-[82vh] max-w-[88vw] object-contain rounded shadow-2xl bg-white border border-slate-700 pointer-events-none select-none"
            />
          </div>
        ) : (
          !isLoadingHighRes && (
            <div className="text-slate-400 text-sm">
              Unable to preview this file. Click "Scan All" to separate PDF pages.
            </div>
          )
        )}
      </div>

      {/* ── Bottom Floating Controls Toolbar ── */}
      <div className="p-4 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out (-)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>

          {/* Scale Display */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded-xl text-xs font-bold text-blue-400 hover:bg-slate-800 transition-colors min-w-[54px] text-center"
            title="Click to Reset Zoom (100%)"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In (+)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div className="w-px h-5 bg-slate-700 mx-1" />

          {/* Fit to screen */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fit to Screen (0)"
          >
            Fit
          </button>

          {/* Rotate */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Rotate 90° (R)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Rotate</span>
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Reset Pan & Zoom"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Interaction hints */}
        <p className="text-[10px] text-slate-400 font-medium">
          Scroll wheel to zoom • Drag to pan • Double-click to reset • Arrows to switch plans
        </p>
      </div>
    </div>
  );
}
