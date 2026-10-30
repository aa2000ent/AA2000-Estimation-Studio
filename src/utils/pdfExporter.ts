/**
 * Utility to export BOQ and Estimation results as downloadable PDFs using html2pdf.js
 */
import { getHeaderDataUrl, getPdfHeaderHtml } from './pdfHeaderImage';

export interface BOQPdfData {
  title: string;
  projectName?: string;
  clientName?: string;
  systems?: string[];
  confidenceScore?: number;
  observations?: string;
  manpower: { role: string; headcount: number; hours: number; manDays: number; ratePerDay?: number; totalCost?: number }[];
  scopeOfWorks?: { itemNumber: number; description: string; unit: string; totalPrice?: number }[];
  consumables: { name: string; category: string; quantity: number; unit?: string; unitPrice?: number; totalPrice?: number }[];
  fees?: { type: string; description?: string; amount: number }[];
  constraints?: { physical?: string; electrical?: string; installation?: string };
}

export async function exportBOQPdf(data: BOQPdfData): Promise<void> {
  if (!(window as any).html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF export library'));
      document.head.appendChild(script);
    });
  }

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalLaborCost = data.manpower.reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const totalMaterialsCost = data.consumables.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
  const totalFeesCost = (data.fees || []).reduce((sum, f) => sum + (f.amount || 0), 0);
  const subtotal = totalLaborCost + totalMaterialsCost + totalFeesCost;
  const vat = subtotal * 0.12;
  const grandTotal = subtotal * 1.12;
  const hasPricing = subtotal > 0;

  const outer = document.createElement('div');
  outer.style.position = 'fixed';
  outer.style.top = '0';
  outer.style.left = '0';
  outer.style.width = '816px';
  outer.style.height = '1px';
  outer.style.overflow = 'hidden';
  outer.style.zIndex = '99999';
  outer.style.pointerEvents = 'none';

  const container = document.createElement('div');
  container.style.width = '816px';
  container.style.padding = '0';
  container.style.boxSizing = 'border-box';
  container.style.background = '#FFFFFF';
  container.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
  container.style.color = '#1E293B';

  const headerImg = await getHeaderDataUrl();
  const headerHtml = getPdfHeaderHtml(headerImg);

  const footerHtml = `
    <div style="position: absolute; bottom: 25px; left: 35px; right: 35px; border-top: 1px dashed #CBD5E1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; color: #64748B; font-size: 8px;">
      <div>AA2000 Security &amp; Technology Solutions Inc. &nbsp;|&nbsp; Official BOQ Report</div>
      <div style="font-weight: 700; color: #475569;">Generated on ${formattedDate}</div>
    </div>
  `;

  const manpowerRows = data.manpower.map((m, i) => {
    const rate = m.ratePerDay || 0;
    const cost = m.totalCost || rate * m.manDays;
    return `
    <tr style="background: ${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;">${m.role}</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: center;">${m.headcount}</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: center;">${m.hours}h</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: center; font-weight: 700; color: #1E3A8A;">${m.manDays}</td>
      ${hasPricing ? `<td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: right;">₱${rate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>` : ''}
      ${hasPricing ? `<td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: right; font-weight: 600;">₱${cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>` : ''}
    </tr>
  `;
  }).join('');

  const consumablesRows = data.consumables.map((c, i) => `
    <tr style="background: ${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;">${c.name}</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #64748B; font-size: 9px;">${c.category}</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: center; font-weight: 700;">${c.quantity} ${c.unit || ''}</td>
      ${hasPricing ? `<td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: right;">₱${(c.unitPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>` : ''}
      ${hasPricing ? `<td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: right; font-weight: 600;">₱${(c.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>` : ''}
    </tr>
  `).join('');

  const feesRows = (data.fees || []).filter(f => f.amount > 0).map((f, i) => `
    <tr style="background: ${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;">${f.type}</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #64748B; font-size: 9px;">${f.description || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: right; font-weight: 600;">₱${f.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div style="box-sizing: border-box; width: 100%; min-height: 1045px; position: relative; background: #FFFFFF; margin: 0; padding: 0;">
      ${headerHtml}

      <div style="padding: 20px 35px 60px 35px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1E3A8A; padding-bottom: 8px;">
        <div>
          <h1 style="color: #1E3A8A; font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase;">${data.title}</h1>
          ${data.projectName ? `<p style="font-size: 11px; color: #475569; font-weight: 700; margin: 3px 0 0 0;">Project: ${data.projectName}</p>` : ''}
          ${data.systems?.length ? `<p style="font-size: 10px; color: #2563EB; font-weight: 700; margin: 2px 0 0 0;">Systems: ${data.systems.join(', ')}</p>` : ''}
        </div>
        <div style="font-size: 10px; color: #64748B; font-weight: 700;">Date: ${formattedDate}</div>
      </div>

      ${data.observations ? `
        <div style="margin-top: 15px; padding: 10px 12px; background: #EFF6FF; border-left: 3px solid #2563EB; border-radius: 4px;">
          <div style="font-size: 9px; font-weight: 900; color: #1E40AF; text-transform: uppercase;">AI Analysis Summary</div>
          <div style="font-size: 10px; color: #1E3A8A; margin-top: 3px; line-height: 1.4;">${data.observations}</div>
        </div>
      ` : ''}

      ${data.manpower.length > 0 ? `
        <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 18px 0 6px 0;">Labor &amp; Manpower Breakdown</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left;">
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700;">Role</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: center;">Headcount</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: center;">Hours</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: center;">Man-Days</th>
              ${hasPricing ? `<th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: right;">Day Rate</th>` : ''}
              ${hasPricing ? `<th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: right;">Total Cost</th>` : ''}
            </tr>
          </thead>
          <tbody>${manpowerRows}</tbody>
        </table>
      ` : ''}

      ${data.scopeOfWorks && data.scopeOfWorks.length > 0 ? `
        <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 18px 0 6px 0;">Scope of Works &amp; Procedural Activities</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left;">
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 40px; text-align: center;">#</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700;">Description &amp; Procedures</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 60px; text-align: center;">Unit</th>
              ${hasPricing ? `<th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; width: 80px; text-align: right;">Amount</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${data.scopeOfWorks.map((s, i) => `
              <tr style="background: ${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: center; font-weight: 700; color: #1E3A8A; vertical-align: top;">${s.itemNumber || i + 1}</td>
                <td style="padding: 6px 10px; border: 1px solid #E2E8F0; vertical-align: top; line-height: 1.45; white-space: pre-line;">${s.description}</td>
                <td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: center; vertical-align: top; color: #64748B;">${s.unit || '1 LOT'}</td>
                ${hasPricing ? `<td style="padding: 6px 10px; border: 1px solid #E2E8F0; text-align: right; vertical-align: top; font-weight: 600;">${(s.totalPrice || 0) > 0 ? '₱' + (s.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${data.consumables.length > 0 ? `
        <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 18px 0 6px 0;">Bill of Materials (BOM)</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left;">
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700;">Item Name</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700;">Category</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: center;">Qty</th>
              ${hasPricing ? `<th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: right;">Unit Price</th>` : ''}
              ${hasPricing ? `<th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: right;">Total</th>` : ''}
            </tr>
          </thead>
          <tbody>${consumablesRows}</tbody>
        </table>
      ` : ''}

      ${feesRows ? `
        <h2 style="font-size: 11px; font-weight: 900; color: #1E3A8A; text-transform: uppercase; margin: 18px 0 6px 0;">Additional Fees</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #F1F5F9; text-align: left;">
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700;">Fee Type</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700;">Description</th>
              <th style="padding: 6px 10px; border: 1px solid #E2E8F0; color: #475569; font-weight: 700; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>${feesRows}</tbody>
        </table>
      ` : ''}

      ${hasPricing ? `
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <div style="width: 280px; background: #F8FAFC; border: 1px solid #CBD5E1; padding: 10px 14px; border-radius: 4px; font-size: 10px;">
            <div style="display: flex; justify-content: space-between; padding: 3px 0;">
              <span>Subtotal:</span>
              <strong style="color: #1E293B;">₱${subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #64748B;">
              <span>VAT (12%):</span>
              <span>₱${vat.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0 2px 0; border-top: 1px solid #CBD5E1; color: #1E3A8A; font-weight: 900; font-size: 12px;">
              <span>Grand Total:</span>
              <span>₱${grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      ` : ''}

      ${data.constraints ? `
        <div style="margin-top: 20px; border: 1px solid #E2E8F0; border-radius: 4px; padding: 10px; background: #F8FAFC;">
          <div style="font-size: 9px; font-weight: 900; color: #475569; text-transform: uppercase;">Installation Constraints &amp; Notes</div>
          <div style="font-size: 9px; color: #334155; margin-top: 4px; line-height: 1.4;">
            ${data.constraints.physical ? `<div><strong>Physical:</strong> ${data.constraints.physical}</div>` : ''}
            ${data.constraints.electrical ? `<div><strong>Electrical:</strong> ${data.constraints.electrical}</div>` : ''}
            ${data.constraints.installation ? `<div><strong>Installation:</strong> ${data.constraints.installation}</div>` : ''}
          </div>
        </div>
      ` : ''}
      </div>

      ${footerHtml}
    </div>
  `;

  outer.appendChild(container);
  document.body.appendChild(outer);

  const filename = `${(data.projectName || data.title).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_boq.pdf`;

  const opt = {
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
  };

  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    await (window as any).html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(outer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit / Doc Reader PDF export
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditPdfData {
  title: string;
  torFileName?: string;
  proposalFileName?: string;
  confidenceScore: number;
  totalTechnicianCost: number;
  totalAiRecommendedCost: number;
  varianceAmount: number;
  variancePercent: number;
  overallAuditRationale: string;
  equipmentComparison: { name: string; technicianQty: number; aiQty: number; variance: number; rationale: string }[];
  manpowerComparison:  { role: string; technicianHours: number; aiHours: number; variance: number; rationale: string }[];
  consumablesComparison?: { name: string; technicianQty: number; aiQty: number; variance: number; rationale: string }[];
}

export async function exportAuditPdf(data: AuditPdfData): Promise<void> {
  if (!(window as any).html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF export library'));
      document.head.appendChild(script);
    });
  }

  const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const confScore = typeof data.confidenceScore === 'number' && !isNaN(data.confidenceScore) ? data.confidenceScore : 0;
  const techCost = typeof data.totalTechnicianCost === 'number' && !isNaN(data.totalTechnicianCost) ? data.totalTechnicianCost : 0;
  const aiCost = typeof data.totalAiRecommendedCost === 'number' && !isNaN(data.totalAiRecommendedCost) ? data.totalAiRecommendedCost : 0;
  const varianceAmt = typeof data.varianceAmount === 'number' && !isNaN(data.varianceAmount) ? data.varianceAmount : (aiCost - techCost);
  const variancePct = typeof data.variancePercent === 'number' && !isNaN(data.variancePercent) ? data.variancePercent : (techCost !== 0 ? (varianceAmt / techCost) * 100 : 0);
  const rationaleText = typeof data.overallAuditRationale === 'string'
    ? data.overallAuditRationale
    : typeof data.overallAuditRationale === 'object' && data.overallAuditRationale !== null
      ? Object.values(data.overallAuditRationale as Record<string, unknown>).filter(v => typeof v === 'string').join(' ')
      : String(data.overallAuditRationale ?? '');

  const confidenceColor =
    confScore >= 75 ? '#16A34A' :
    confScore >= 50 ? '#CA8A04' :
    confScore >= 25 ? '#EA580C' : '#DC2626';

  const confidenceLabel =
    confScore >= 75 ? 'High Confidence' :
    confScore >= 50 ? 'Medium Confidence' :
    confScore >= 25 ? 'Low Confidence' : 'Poor Quality';

  const varColor = varianceAmt > 0 ? '#DC2626' : varianceAmt < 0 ? '#CA8A04' : '#64748B';

  const buildTableRows = (
    rows: { col1: string; col2: string | number; col3: string | number; col4: string | number; col5: string }[],
    headers: string[]
  ) => `
    <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:12px;">
      <thead>
        <tr style="background:#F1F5F9;">
          ${headers.map(h => `<th style="padding:6px 8px;text-align:left;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
            <td style="padding:5px 8px;font-weight:600;color:#1E293B;border-bottom:1px solid #F1F5F9;">${r.col1}</td>
            <td style="padding:5px 8px;text-align:right;color:#475569;border-bottom:1px solid #F1F5F9;">${r.col2}</td>
            <td style="padding:5px 8px;text-align:right;font-weight:700;color:#1E293B;border-bottom:1px solid #F1F5F9;">${r.col3}</td>
            <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #F1F5F9;">
              <span style="padding:2px 6px;border-radius:4px;font-weight:700;font-size:8px;background:${Number(r.col4) > 0 ? '#FEE2E2' : Number(r.col4) < 0 ? '#FEF9C3' : '#F1F5F9'};color:${Number(r.col4) > 0 ? '#DC2626' : Number(r.col4) < 0 ? '#CA8A04' : '#64748B'};">
                ${Number(r.col4) > 0 ? '+' + r.col4 : r.col4 === 0 ? 'Match' : r.col4}
              </span>
            </td>
            <td style="padding:5px 8px;color:#475569;font-size:8px;border-bottom:1px solid #F1F5F9;">${r.col5}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  const equipRows = (data.equipmentComparison || []).map(e => ({ col1: e.name || '', col2: e.technicianQty ?? 0, col3: e.aiQty ?? 0, col4: e.variance ?? 0, col5: e.rationale || '' }));
  const manpowerRows = (data.manpowerComparison || []).map(m => ({ col1: m.role || '', col2: `${m.technicianHours ?? 0}h`, col3: `${m.aiHours ?? 0}h`, col4: m.variance ?? 0, col5: m.rationale || '' }));
  const consumableRows = (data.consumablesComparison || []).map(c => ({ col1: c.name || '', col2: c.technicianQty ?? 0, col3: c.aiQty ?? 0, col4: c.variance ?? 0, col5: c.rationale || '' }));

  const headerImg = await getHeaderDataUrl();
  const headerHtml = getPdfHeaderHtml(headerImg, 'margin-bottom: 0;');

  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;color:#1E293B;width:816px;background:#FFFFFF;box-sizing:border-box;">
      <!-- Header -->
      ${headerHtml}

      <!-- Title Bar -->
      <div style="background:#EFF6FF;border-bottom:2px solid #DBEAFE;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:14px;font-weight:900;color:#1E3A8A;">${data.title}</div>
          <div style="font-size:9px;color:#3B82F6;margin-top:2px;">Generated: ${formattedDate}</div>
          ${data.torFileName ? `<div style="font-size:8px;color:#64748B;margin-top:1px;">TOR: ${data.torFileName}</div>` : ''}
          ${data.proposalFileName ? `<div style="font-size:8px;color:#64748B;">Proposal: ${data.proposalFileName}</div>` : ''}
        </div>
        <!-- Confidence Meter -->
        <div style="text-align:right;">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:4px;">AI Confidence</div>
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
            <div style="width:100px;height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${confScore}%;background:${confidenceColor};border-radius:4px;"></div>
            </div>
            <span style="font-size:13px;font-weight:900;color:${confidenceColor};">${confScore}%</span>
          </div>
          <div style="font-size:8px;font-weight:700;color:${confidenceColor};margin-top:2px;">${confidenceLabel}</div>
        </div>
      </div>

      <div style="padding:20px 24px;">
        <!-- Cost Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
          <div style="padding:12px;border-radius:10px;border:1px solid #E2E8F0;background:#F8FAFC;">
            <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:4px;">Tech Proposed</div>
            <div style="font-size:16px;font-weight:900;color:#1E293B;">₱${techCost.toLocaleString()}</div>
          </div>
          <div style="padding:12px;border-radius:10px;border:1px solid #BFDBFE;background:#EFF6FF;">
            <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#1D4ED8;margin-bottom:4px;">Reconciled Value</div>
            <div style="font-size:16px;font-weight:900;color:#1D4ED8;">₱${aiCost.toLocaleString()}</div>
          </div>
          <div style="padding:12px;border-radius:10px;border:1px solid ${varColor}40;background:${varColor}0D;">
            <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:${varColor};margin-bottom:4px;">Variance</div>
            <div style="font-size:16px;font-weight:900;color:${varColor};">${varianceAmt > 0 ? '+' : ''}₱${varianceAmt.toLocaleString()}</div>
            <div style="font-size:8px;color:${varColor};font-weight:600;">${variancePct.toFixed(2)}%</div>
          </div>
        </div>

        <!-- Rationale -->
        <div style="padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#94A3B8;margin-bottom:6px;">AI Audit Findings</div>
          <p style="font-size:10px;color:#334155;line-height:1.6;margin:0;">${rationaleText}</p>
        </div>

        ${equipRows.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Equipment &amp; Materials</div>
          ${buildTableRows(equipRows, ['Item', 'Tech Qty', 'AI Qty', 'Variance', 'Rationale'])}
        </div>` : ''}

        ${manpowerRows.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Labor &amp; Manpower</div>
          ${buildTableRows(manpowerRows, ['Role', 'Tech Hours', 'AI Hours', 'Variance', 'Rationale'])}
        </div>` : ''}

        ${consumableRows.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Cabling &amp; Consumables</div>
          ${buildTableRows(consumableRows, ['Material', 'Tech Qty', 'AI Qty', 'Variance', 'Rationale'])}
        </div>` : ''}
      </div>

      <!-- Footer -->
      <div style="border-top:1px dashed #CBD5E1;margin:0 24px;padding:10px 0;display:flex;justify-content:space-between;color:#94A3B8;font-size:7.5px;">
        <span>AA2000 Security and Technology Solutions Inc. — AI Doc Reader Audit Report</span>
        <span>Generated ${formattedDate} · For internal use only</span>
      </div>
    </div>`;

  const outer = document.createElement('div');
  outer.style.position = 'fixed';
  outer.style.top = '0';
  outer.style.left = '0';
  outer.style.width = '816px';
  outer.style.height = '1px';
  outer.style.overflow = 'hidden';
  outer.style.zIndex = '99999';
  outer.style.pointerEvents = 'none';

  const container = document.createElement('div');
  container.innerHTML = html;
  outer.appendChild(container);
  document.body.appendChild(outer);

  const filename = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_audit.pdf`;
  const opt = {
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
  };

  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    await (window as any).html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(outer);
  }
}

