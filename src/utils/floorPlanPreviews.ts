/**
 * Small JPEG previews of the uploaded floor plans, saved with the estimation so the
 * PDF report can show each plan under its title. The original files are not stored:
 * the previews are for the report only, not for re-analysis.
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface FloorPlanImage {
  /** The user's title for the plan, e.g. "Ground Floor". */
  title: string;
  fileName: string;
  /** Page of a PDF plan (1-based); absent for image uploads. */
  page?: number;
  /** data:image/jpeg;base64,... */
  dataUrl: string;
}

// Budget for every preview of one estimation together: they live in the saved JSON
// and the browser's local estimation cache, so they must stay small.
const MAX_IMAGES = 8;
const MAX_PDF_PAGES_PER_FILE = 3;
const MAX_TOTAL_CHARS = 2_400_000;
const LONG_EDGE = 1400;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

// Photos are only ever shrunk; PDF pages are vector, so they are drawn up to the long edge
function scaledCanvas(width: number, height: number, longEdge: number, allowUpscale = false): { canvas: HTMLCanvasElement; scale: number } {
  const fit = longEdge / Math.max(width, height);
  const scale = allowUpscale ? fit : Math.min(1, fit);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return { canvas, scale };
}

async function imageFileToCanvases(file: File, longEdge: number): Promise<HTMLCanvasElement[]> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Could not read ${file.name}`));
      el.src = url;
    });
    const { canvas } = scaledCanvas(img.naturalWidth, img.naturalHeight, longEdge);
    const ctx = canvas.getContext('2d')!;
    // JPEG has no transparency: plans with a transparent background print on white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return [canvas];
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfFileToCanvases(file: File, longEdge: number, maxPages: number): Promise<HTMLCanvasElement[]> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const canvases: HTMLCanvasElement[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, maxPages); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const { canvas, scale } = scaledCanvas(base.width, base.height, longEdge, true);
      await page.render({ canvas, viewport: page.getViewport({ scale }), background: '#ffffff' }).promise;
      canvases.push(canvas);
    }
    return canvases;
  } finally {
    void task.destroy();
  }
}

/**
 * Previews for the given plans in upload order. A plan that cannot be read is skipped
 * (the report then shows its placeholder) rather than blocking the save.
 */
export async function buildFloorPlanPreviews(
  files: File[],
  titleFor: (file: File) => string,
): Promise<FloorPlanImage[]> {
  const pages: Array<{ file: File; page?: number; canvas: HTMLCanvasElement }> = [];
  for (const file of files) {
    if (pages.length >= MAX_IMAGES) break;
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const canvases = isPdf
        ? await pdfFileToCanvases(file, LONG_EDGE, Math.min(MAX_PDF_PAGES_PER_FILE, MAX_IMAGES - pages.length))
        : await imageFileToCanvases(file, LONG_EDGE);
      canvases.forEach((canvas, index) => pages.push({ file, page: isPdf ? index + 1 : undefined, canvas }));
    } catch (error) {
      console.warn('[floorPlanPreviews] Skipped a floor plan preview:', error);
    }
  }

  // Lower the JPEG quality until everything fits the budget
  for (const quality of [0.72, 0.6, 0.48, 0.36]) {
    const images = pages.map(({ file, page, canvas }) => ({
      title: titleFor(file).trim() || file.name,
      fileName: file.name,
      ...(page ? { page } : {}),
      dataUrl: canvasToJpeg(canvas, quality),
    }));
    const size = images.reduce((sum, image) => sum + image.dataUrl.length, 0);
    if (size <= MAX_TOTAL_CHARS) return images;
  }
  // Still too large at the lowest quality: keep as many as fit
  const kept: FloorPlanImage[] = [];
  let used = 0;
  for (const { file, page, canvas } of pages) {
    const dataUrl = canvasToJpeg(canvas, 0.36);
    if (used + dataUrl.length > MAX_TOTAL_CHARS) break;
    used += dataUrl.length;
    kept.push({ title: titleFor(file).trim() || file.name, fileName: file.name, ...(page ? { page } : {}), dataUrl });
  }
  return kept;
}

/** Saved previews that are safe to print: only JPEG/PNG data URLs, with string titles. */
export function sanitizeFloorPlanImages(value: unknown): FloorPlanImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is FloorPlanImage =>
      !!item && typeof item === 'object' &&
      typeof (item as FloorPlanImage).dataUrl === 'string' &&
      /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test((item as FloorPlanImage).dataUrl))
    .slice(0, MAX_IMAGES)
    .map(item => ({
      title: String(item.title ?? '').slice(0, 80),
      fileName: String(item.fileName ?? '').slice(0, 200),
      ...(Number.isInteger(item.page) ? { page: item.page } : {}),
      dataUrl: item.dataUrl,
    }));
}
