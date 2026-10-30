import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfExtractedPage {
  pageNumber: number;
  thumbnailUrl: string;
  file: File;
  defaultTitle: string;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export async function getPdfPageCount(file: File): Promise<number> {
  if (!isPdfFile(file)) return 1;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const task = getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await task.promise;
    const count = pdf.numPages;
    void task.destroy();
    return count;
  } catch (err) {
    console.warn('Could not read PDF page count:', err);
    return 1;
  }
}

export async function getPdfPageThumbnail(file: File, pageNumber = 1): Promise<string | null> {
  if (!isPdfFile(file)) return null;
  let task;
  try {
    const arrayBuffer = await file.arrayBuffer();
    task = getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await task.promise;
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const thumbLongEdge = 480;
    const thumbScale = thumbLongEdge / Math.max(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale: thumbScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (err) {
    console.warn('Could not generate PDF thumbnail:', err);
    return null;
  } finally {
    if (task) void task.destroy();
  }
}

function getDefaultFloorTitle(pageNumber: number, totalPages: number): string {
  if (pageNumber === 1 && totalPages > 1) return 'Ground Floor';
  if (pageNumber === 2) return '2nd Floor';
  if (pageNumber === 3) return '3rd Floor';
  if (pageNumber === 4) return '4th Floor';
  if (pageNumber === 5) return '5th Floor';
  if (pageNumber === totalPages && totalPages > 2) return 'Roof Deck / Top Floor';
  return `Floor Plan - Page ${pageNumber}`;
}

export async function extractPdfPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PdfExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const task = getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await task.promise;
  const numPages = pdf.numPages;
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const extracted: PdfExtractedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      onProgress?.(pageNumber, numPages);
      const page = await pdf.getPage(pageNumber);

      // 1. High resolution render for AI analysis
      const baseViewport = page.getViewport({ scale: 1.0 });
      const targetLongEdge = 1800;
      const fitScale = targetLongEdge / Math.max(baseViewport.width, baseViewport.height);
      const renderScale = Math.max(1.0, fitScale);
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

      // 2. High-res PNG File for analysis
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) continue;

      const pageFile = new File(
        [blob],
        `${baseName}_page_${pageNumber}.png`,
        { type: 'image/png' }
      );

      // 3. Compact JPEG thumbnail for modal preview
      const thumbLongEdge = 360;
      const thumbScale = thumbLongEdge / Math.max(canvas.width, canvas.height);
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = Math.max(1, Math.round(canvas.width * thumbScale));
      thumbCanvas.height = Math.max(1, Math.round(canvas.height * thumbScale));
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        thumbCtx.fillStyle = '#ffffff';
        thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }
      const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.65);

      extracted.push({
        pageNumber,
        thumbnailUrl,
        file: pageFile,
        defaultTitle: getDefaultFloorTitle(pageNumber, numPages),
      });
    }
    return extracted;
  } finally {
    void task.destroy();
  }
}
