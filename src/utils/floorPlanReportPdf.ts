/**
 * PDF report for ONE analyzed floor plan (AI Estimation queue). Same approach as
 * pdfExporter.ts: build the page as HTML and let html2pdf.js turn it into a PDF.
 */
import type { FloorPlanAnalyzeResult, FloorPlanSection } from '../services/api/estimationFlow';

export interface FloorPlanReportData {
  /** The title the user gave the plan (e.g. "Ground Floor"); falls back to the file name. */
  title: string;
  fileName: string;
  result: FloorPlanAnalyzeResult;
  /** Systems picked before the analysis (labels). */
  systems?: string[];
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Every section of every page of a result, rooms first. */
export function sectionsOfResult(result: FloorPlanAnalyzeResult | undefined): FloorPlanSection[] {
  return (result?.pages ?? []).flatMap(page => [
    ...(page.sections ?? []),
    ...(page.corridors ?? []),
    ...(page.verticalCirculation ?? []),
    ...(page.utilityAreas ?? []),
  ]);
}

function detectedSystems(section: FloorPlanSection): string {
  const detected = section.systemsDetected ?? {};
  const names = Object.entries(detected)
    .filter(([, detail]) => {
      if (!detail) return false;
      if (typeof detail === 'object' && (detail as { required?: boolean }).required === false) return false;
      return true;
    })
    .map(([name]) => name.toUpperCase());
  return names.length > 0 ? names.join(', ') : '—';
}

export async function downloadFloorPlanReport(data: FloorPlanReportData): Promise<void> {
  if (!(window as any).html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF export library'));
      document.head.appendChild(script);
    });
  }

  const { result } = data;
  const sections = sectionsOfResult(result);
  const summary = result.summary ?? {};
  const unit = summary.unit || 'sqm';
  const title = data.title.trim() || data.fileName;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const rows = sections
    .map(
      (section, index) => `
        <tr style="background: ${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
          <td style="padding: 6px 8px; font-weight: 700;">${escapeHtml(section.label || section.sectionId)}</td>
          <td style="padding: 6px 8px;">${escapeHtml([section.type, section.subType].filter(Boolean).join(' / '))}</td>
          <td style="padding: 6px 8px; text-align: right;">${section.area !== undefined ? `${escapeHtml(section.area)} ${escapeHtml(section.unit || unit)}` : '—'}</td>
          <td style="padding: 6px 8px; text-align: right;">${typeof section.confidence === 'number' ? `${Math.round(section.confidence * 100)}%` : '—'}</td>
          <td style="padding: 6px 8px;">${escapeHtml(detectedSystems(section))}</td>
        </tr>`
    )
    .join('');

  const recommendations = (result.recommendations ?? [])
    .map(item => {
      const rec = (item && typeof item === 'object' ? item : { action: String(item) }) as {
        priority?: string;
        system?: string;
        action?: string;
      };
      const tag = [rec.priority, rec.system].filter(Boolean).join(' · ');
      return `<li style="margin-bottom: 4px;">${tag ? `<strong>${escapeHtml(tag)}</strong> — ` : ''}${escapeHtml(rec.action || '')}</li>`;
    })
    .join('');

  const outer = document.createElement('div');
  outer.style.cssText = 'position: fixed; top: 0; left: 0; width: 816px; height: 1px; overflow: hidden; z-index: 99999; pointer-events: none;';

  const container = document.createElement('div');
  container.style.cssText =
    "width: 816px; box-sizing: border-box; background: #FFFFFF; color: #1E293B; font-family: 'Inter', system-ui, -apple-system, sans-serif;";
  container.innerHTML = `
    <div style="background: #1E3A8A; color: #FFFFFF; padding: 18px 24px;">
      <div style="font-size: 24px; font-weight: 900; letter-spacing: 0.05em;">AA2000</div>
      <div style="font-size: 10px; font-weight: 600; opacity: 0.9; margin-top: 2px;">Security and Technology Solutions Inc.</div>
    </div>
    <div style="padding: 20px 24px;">
      <div style="font-size: 10px; font-weight: 800; color: #2563EB; text-transform: uppercase; letter-spacing: 0.08em;">Floor Plan Analysis Report</div>
      <div style="font-size: 22px; font-weight: 900; margin-top: 4px;">${escapeHtml(title)}</div>
      <div style="font-size: 10px; color: #64748B; margin-top: 4px;">
        File: ${escapeHtml(data.fileName)} &nbsp;|&nbsp; Generated: ${escapeHtml(date)}
        ${typeof result.confidenceScore === 'number' ? ` &nbsp;|&nbsp; Confidence: ${escapeHtml(result.confidenceScore)}%` : ''}
      </div>
      ${data.systems && data.systems.length > 0 ? `<div style="font-size: 10px; color: #64748B; margin-top: 2px;">Systems in scope: ${escapeHtml(data.systems.join(', '))}</div>` : ''}

      <div style="display: flex; gap: 10px; margin-top: 16px;">
        ${[
          ['Rooms', summary.totalRooms ?? 0],
          ['Corridors', summary.totalCorridors ?? 0],
          ['Total area', `${summary.totalArea ?? 0} ${unit}`],
          ['Sections', sections.length],
        ]
          .map(
            ([label, value]) => `
          <div style="flex: 1; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; background: #F8FAFC;">
            <div style="font-size: 8px; font-weight: 800; color: #64748B; text-transform: uppercase;">${escapeHtml(label)}</div>
            <div style="font-size: 15px; font-weight: 900; margin-top: 2px;">${escapeHtml(value)}</div>
          </div>`
          )
          .join('')}
      </div>

      <div style="font-size: 10px; font-weight: 900; color: #475569; text-transform: uppercase; margin-top: 20px; margin-bottom: 6px;">Sections found</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #E2E8F0;">
        <thead>
          <tr style="background: #1E3A8A; color: #FFFFFF; text-align: left;">
            <th style="padding: 6px 8px;">Section</th>
            <th style="padding: 6px 8px;">Type</th>
            <th style="padding: 6px 8px; text-align: right;">Area</th>
            <th style="padding: 6px 8px; text-align: right;">Confidence</th>
            <th style="padding: 6px 8px;">Systems detected</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding: 10px; color: #64748B;">No sections were detected in this floor plan.</td></tr>'}</tbody>
      </table>

      ${recommendations ? `
        <div style="font-size: 10px; font-weight: 900; color: #475569; text-transform: uppercase; margin-top: 20px; margin-bottom: 6px;">Recommendations</div>
        <ul style="font-size: 9px; color: #334155; padding-left: 16px; margin: 0; line-height: 1.5;">${recommendations}</ul>` : ''}

      <div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #E2E8F0; font-size: 8px; color: #94A3B8;">
        AI-generated from the uploaded drawing. Areas and detected systems are estimates and should be verified on site.
      </div>
    </div>
  `;

  outer.appendChild(container);
  document.body.appendChild(outer);

  const safeName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const opt = {
    margin: 0,
    filename: `${safeName || 'floor_plan'}_analysis.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
  };

  try {
    await (window as any).html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(outer);
  }
}
