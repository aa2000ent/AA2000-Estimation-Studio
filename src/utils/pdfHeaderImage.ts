import aa2000HeaderImg from '../images/aa2000_full_header.png';

let cachedDataUrl: string | null = null;
let dataUrlPromise: Promise<string> | null = null;

/**
 * Returns the AA2000 full header as a base64 Data URL.
 * html2canvas and html2pdf render base64 data URLs reliably and synchronously
 * without CORS or network timing issues during PDF export.
 */
export function getHeaderDataUrl(): Promise<string> {
  if (cachedDataUrl) return Promise.resolve(cachedDataUrl);
  if (dataUrlPromise) return dataUrlPromise;

  dataUrlPromise = new Promise<string>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(aa2000HeaderImg);
      return;
    }

    const img = new Image();

    const finalize = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(img, 0, 0);
          cachedDataUrl = canvas.toDataURL('image/png');
          resolve(cachedDataUrl);
          return;
        }
      } catch (err) {
        console.warn('Failed to convert header image to Data URL, fallback to asset URL:', err);
      }
      resolve(aa2000HeaderImg);
    };

    img.onload = finalize;
    img.onerror = () => {
      resolve(aa2000HeaderImg);
    };
    img.src = aa2000HeaderImg;

    if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
      finalize();
    }
  });

  return dataUrlPromise;
}

/**
 * Returns an HTML string rendering the full header image with proper responsive styles for PDF containers.
 * Default is full bleed (0 margin, 0 padding, 100% width) to touch the top, left, and right edges of the page.
 */
export function getPdfHeaderHtml(imgSrc: string, styleExtra = ''): string {
  return `
    <div style="width: 100%; margin: 0; padding: 0; line-height: 0; overflow: hidden; display: block; ${styleExtra}">
      <img src="${imgSrc}" style="width: 100%; height: auto; display: block; margin: 0; padding: 0; border: none;" alt="AA2000 Security and Technology Solutions Inc." />
    </div>
  `;
}

// Pre-warm the cache in browser environments
if (typeof window !== 'undefined') {
  getHeaderDataUrl().catch(() => {});
}

export { aa2000HeaderImg };

