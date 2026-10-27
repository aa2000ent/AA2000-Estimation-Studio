import type { Project, User } from '../App';
import type {
  EstimationAdditionalFeeEntry,
  EstimationConsumableEntry,
  EstimationManpowerEntry,
} from '../types';
import type { ScopeOfWorkEntry } from '../components/estimation/QuotationModal';

interface ReportTotals {
  totalLabor: number;
  totalMaterials: number;
  totalFees: number;
}
interface StandardEstimationReportInput {
  project: Project;
  user: User | null;
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks: ScopeOfWorkEntry[];
  constraints: { physical?: string; electrical?: string; installation?: string };
  technicianNotes: string;
  totals: ReportTotals;
  showPrices: boolean;
  headerBackgroundUrl: string;
  logoUrl: string;
}

const money = (value: number | undefined): string =>
  `PHP ${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const display = (value: unknown, fallback = 'Not specified'): string => {
  const text = String(value ?? '').trim();
  return escapeHtml(text || fallback);
};

const multiline = (value: unknown, fallback = 'None recorded'): string =>
  display(value, fallback).replace(/\r?\n/g, '<br>');

const normalizedSystem = (value: string): string => value
  .replace(/_/g, ' ')
  .replace(/\bFIRE ALARM\b/i, 'FDAS')
  .toUpperCase();

const isCableMaterial = (item: EstimationConsumableEntry): boolean =>
  /cable|wire|utp|rg\s*-?\s*(?:6|59)|fiber|fibre/i.test(`${item.category} ${item.name}`);

const isRoughingMaterial = (item: EstimationConsumableEntry): boolean =>
  /rough|conduit|pipe|pvc|mould|trunk|junction|utility box|mount|bracket|fastener|anchor|clamp|tape|connector|label|protective|covering/i
    .test(`${item.category} ${item.name}`);

const formatDate = (value?: string): string => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const tableEmpty = (columns: number, message: string): string => `
  <tr><td class="empty" colspan="${columns}">${escapeHtml(message)}</td></tr>`;

const renderMaterialRows = (
  items: EstimationConsumableEntry[],
  showPrices: boolean,
  startIndex = 0,
): string => {
  if (!items.length) return tableEmpty(showPrices ? 6 : 4, 'NONE');

  return items.map((item, index) => `
    <tr>
      <td class="center">${startIndex + index + 1}</td>
      <td class="center"><b>${display(item.productId || item.name, '-')}</b></td>
      <td><b>${display(item.name)}</b><span class="item-note">${display(item.category, '')}${item.notes ? ` — ${display(item.notes, '')}` : ''}</span></td>
      <td class="center">${display(item.quantity)} ${display(item.unit, 'pcs')}</td>
      ${showPrices ? `<td class="number">${money(item.unitPrice)}</td><td class="number line-total">${money(item.totalPrice)}</td>` : ''}
    </tr>`).join('');
};

const renderMaterialTable = (
  title: string,
  items: EstimationConsumableEntry[],
  showPrices: boolean,
): string => {
  const groups = items.reduce<Record<string, EstimationConsumableEntry[]>>((acc, item) => {
    const group = item.brand?.trim() || item.category?.trim() || 'GENERAL';
    (acc[group] ||= []).push(item);
    return acc;
  }, {});

  const chunks: string[] = [];
  const rowsPerChunk = 6;

  Object.entries(groups).forEach(([group, groupItems]) => {
      const groupTotal = groupItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
      for (let startIndex = 0; startIndex < groupItems.length; startIndex += rowsPerChunk) {
        const chunkItems = groupItems.slice(startIndex, startIndex + rowsPerChunk);
        const isContinuation = startIndex > 0;
        const isFinalChunk = startIndex + rowsPerChunk >= groupItems.length;
        chunks.push(`
        <div class="product-group product-chunk">
          <div class="system-bar">${escapeHtml(group)}${isContinuation ? '<span>Continued</span>' : ''}</div>
          <table class="quotation-table">
            <thead><tr>
              <th class="center item-col">Item</th>
              <th class="center model-col">Model</th>
              <th class="center">Description</th>
              <th class="center qty-col">Qty</th>
              ${showPrices ? '<th class="center price-col">Unit Price</th><th class="center price-col">Total Price</th>' : ''}
            </tr></thead>
            <tbody>${renderMaterialRows(chunkItems, showPrices, startIndex)}</tbody>
            ${showPrices && isFinalChunk ? `<tfoot><tr class="group-subtotal"><td colspan="5">Sub. Total (${escapeHtml(group)}):</td><td class="number">${money(groupTotal)}</td></tr></tfoot>` : ''}
          </table>
        </div>`);
      }
  });

  const firstBlock = chunks.length
    ? chunks[0]
    : `<table class="quotation-table"><tbody>${tableEmpty(showPrices ? 6 : 4, 'NONE')}</tbody></table>`;
  const remainingBlocks = chunks.slice(1).join('');

  return `
    <section class="report-section product-section">
      <div class="product-section-start">
        <h2>${escapeHtml(title)}</h2>
        ${firstBlock}
      </div>
      ${remainingBlocks}
    </section>`;
};

export function buildStandardEstimationReportHtml(input: StandardEstimationReportInput): string {
  const {
    project,
    user,
    manpower,
    consumables,
    fees,
    scopeOfWorks,
    constraints,
    technicianNotes,
    totals,
    showPrices,
    headerBackgroundUrl,
    logoUrl,
  } = input;

  const generatedAt = new Date();
  const dateLabel = generatedAt.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const projectKey = String(project.dbProjId || project.id || 'DRAFT')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-8)
    .toUpperCase() || 'DRAFT';
  const reference = `EST-${generatedAt.getFullYear()}-${projectKey}`;
  const systems = (project.systemTypes || []).map(normalizedSystem);
  const systemLabel = systems.length ? systems.join(', ') : 'Not specified';
  const preparedBy = project.technicianName || user?.fullName || 'Assigned Technician';

  const cableMaterials = consumables.filter(isCableMaterial);
  const roughingMaterials = consumables.filter(item => !isCableMaterial(item) && isRoughingMaterial(item));
  const activeComponents = consumables.filter(item => !isCableMaterial(item) && !isRoughingMaterial(item));

  const subtotal = totals.totalLabor + totals.totalMaterials + totals.totalFees;
  const vat = subtotal * 0.12;
  const grandTotal = subtotal + vat;

  const buildingDimensions = project.buildingLength && project.buildingWidth
    ? `${project.buildingLength} m x ${project.buildingWidth} m`
    : 'Not specified';

  const scopeRows = scopeOfWorks.length
    ? scopeOfWorks.map((item, index) => `
      <tr>
        <td class="center">${display(item.itemNumber || index + 1)}</td>
        <td>${multiline(item.description)}</td>
        <td class="center">${display(item.unit, '1 LOT')}</td>
        ${showPrices ? `<td class="number">${money(item.totalPrice)}</td>` : ''}
      </tr>`).join('')
    : tableEmpty(showPrices ? 4 : 3, 'No scope-of-work entries recorded.');

  const manpowerRows = manpower.length
    ? manpower.map((item, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${display(item.role)}</td>
        <td class="center">${display(item.headcount)}</td>
        <td class="center">${display(item.hours)}</td>
        <td class="center">${display(item.manDays)}</td>
        ${showPrices ? `<td class="number">${money(item.dayRate)}</td><td class="number">${money(item.totalCost)}</td>` : ''}
      </tr>`).join('')
    : tableEmpty(showPrices ? 7 : 5, 'No labor or manpower entries recorded.');

  const feeRows = fees.length
    ? fees.map((fee, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${display(fee.type)}</td>
        <td>${display(fee.description, '-')}</td>
        <td>${display(fee.notes, '-')}</td>
        ${showPrices ? `<td class="number">${money(fee.amount)}</td>` : ''}
      </tr>`).join('')
    : tableEmpty(showPrices ? 5 : 4, 'No additional project fees recorded.');

  const priceSummary = showPrices ? `
    <section class="report-section totals-section">
      <h2>H. Estimation Cost Summary</h2>
      <table class="totals-table">
        <tbody>
          <tr><td>Materials Subtotal:</td><td class="number">${money(totals.totalMaterials)}</td></tr>
          <tr><td>Labor / Manpower:</td><td class="number">${money(totals.totalLabor)}</td></tr>
          <tr><td>Additional Fees:</td><td class="number">${money(totals.totalFees)}</td></tr>
          <tr class="subtotal"><td>Sub. Total:</td><td class="number">${money(subtotal)}</td></tr>
          <tr class="vat-row"><td>Add 12% VAT:</td><td class="number">${money(vat)}</td></tr>
          <tr class="grand-total"><td><span>The price is 12% VAT inclusive</span>Total Amount:</td><td class="number">${money(grandTotal)}</td></tr>
        </tbody>
      </table>
    </section>` : `
    <div class="restricted-note">Commercial rates and totals are intentionally omitted for this user role.</div>`;

  return `
    <style>
      * { box-sizing: border-box; }
      .estimation-report { width: 794px; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 8px; line-height: 1.3; }
      .report-body { padding: 0 46px 28px; }
      .brand-header { height: 145px; padding: 7px 42px 7px 35px; display: flex; align-items: center; justify-content: space-between; background-color: #1d3a64; background-image: url('${escapeHtml(headerBackgroundUrl)}'); background-size: cover; background-position: 85% center; }
      .brand-logo { width: 285px; height: 130px; object-fit: contain; }
      .brand-contact { width: 290px; color: #fff; font-size: 7px; font-weight: 800; line-height: 1.55; text-align: left; }
      .brand-contact div { margin: 2px 0; }
      .proposal-meta { display: grid; grid-template-columns: 1fr 1.35fr 1fr; align-items: center; margin-bottom: 20px; padding: 6px 0; border-top: 1px solid #111; border-bottom: 1px solid #111; font-size: 8px; font-weight: 900; text-transform: uppercase; break-inside: avoid-page; page-break-inside: avoid; }
      .proposal-meta div:nth-child(2) { text-align: center; }
      .proposal-meta div:last-child { text-align: right; }
      .proposal-meta span { display: inline-block; min-width: 78px; margin-left: 4px; padding: 0 5px 2px; border-bottom: 1px solid #f3c332; text-align: center; }
      .client-box { margin: 0 0 18px; padding: 8px 10px; border: 1px solid #111; break-inside: avoid-page; page-break-inside: avoid; }
      .client-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 42px; row-gap: 5px; }
      .client-field { display: grid; grid-template-columns: 88px 1fr; align-items: end; gap: 6px; min-height: 17px; }
      .client-field b { font-size: 7px; font-weight: 900; text-transform: uppercase; }
      .client-field span { min-height: 14px; padding: 0 4px 2px; border-bottom: 1px solid #f3c332; font-weight: 700; }
      .proposal-intro { margin: 0 0 17px; color: #34465f; font-size: 7.5px; font-style: italic; font-weight: 800; text-transform: uppercase; }
      .report-section { margin-top: 12px; border: 1px solid #111; page-break-inside: auto; }
      .report-section h2 { margin: 0; padding: 5px 8px; color: #050505; background: #ffff00; border-bottom: 1px solid #111; font-size: 9px; text-align: center; text-transform: uppercase; letter-spacing: .25px; break-after: avoid-page; page-break-after: avoid; }
      .system-bar { display: flex; justify-content: space-between; padding: 5px 10px; color: #fff; background: #004a8d; border-bottom: 1px solid #111; font-size: 9px; font-weight: 900; letter-spacing: 1.4px; text-transform: uppercase; break-after: avoid-page; page-break-after: avoid; }
      .system-bar span { color: #dbeafe; font-size: 6.5px; letter-spacing: .8px; }
      .product-group + .product-group { border-top: 1px solid #111; }
      .product-section-start, .product-chunk, .empty-section, .compact-section, .totals-section, .summary-strip { break-inside: avoid-page; page-break-inside: avoid; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 5px 6px; border-right: 1px solid #111; border-bottom: 1px solid #aab1bb; vertical-align: top; overflow-wrap: anywhere; }
      th:last-child, td:last-child { border-right: 0; }
      tbody tr:last-child td { border-bottom: 0; }
      th { background: #d9dee5; color: #111; border-bottom: 1px solid #111; font-size: 7px; font-weight: 900; text-align: left; text-transform: uppercase; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      .label { width: 17%; color: #111; background: #eef1f4 !important; font-weight: 900; text-transform: uppercase; font-size: 7px; }
      .center { text-align: center; }
      .number { text-align: right; white-space: nowrap; }
      .small-col { width: 42px; }
      .item-col { width: 45px; }
      .model-col { width: 105px; }
      .qty-col { width: 62px; }
      .price-col { width: 92px; }
      .line-total { font-weight: 900; }
      .item-note { display: block; margin-top: 2px; color: #5b6472; font-size: 6.5px; font-weight: 400; }
      .group-subtotal td { background: #dbe3ec; border-top: 1px solid #111; font-weight: 900; text-align: right; text-transform: uppercase; }
      .empty { padding: 12px; color: #64748b; text-align: center; font-style: italic; font-weight: 800; }
      .summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 10px; border: 1px solid #111; }
      .summary-strip div { padding: 7px; border-right: 1px solid #111; }
      .summary-strip div:last-child { border-right: 0; }
      .summary-strip b { display: block; color: #475569; font-size: 6.5px; text-transform: uppercase; }
      .summary-strip span { display: block; margin-top: 2px; color: #004a8d; font-size: 9px; font-weight: 900; }
      .note-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .note-box { min-height: 58px; padding: 7px 8px; border: 1px solid #aeb9c9; background: #f8fafc; }
      .note-box b { display: block; margin-bottom: 3px; color: #17345f; text-transform: uppercase; font-size: 7.5px; }
      .totals-table { width: 100%; }
      .totals-table td:first-child { width: calc(100% - 140px); font-weight: 900; text-align: right; text-transform: uppercase; }
      .totals-table td:last-child { width: 140px; font-weight: 900; }
      .subtotal td { border-top: 2px solid #17418f; }
      .vat-row td { color: #174fc1; }
      .grand-total td { background: #dbe3ec !important; color: #111; border-top: 1px solid #111; font-size: 9px; font-weight: 900; }
      .grand-total td:first-child { display: flex; justify-content: space-between; gap: 10px; }
      .grand-total span { color: #ef172f; font-size: 7px; }
      .restricted-note { margin-top: 14px; padding: 9px; border: 1px solid #f0c36d; background: #fff8e6; color: #7c5310; font-weight: 700; text-align: center; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 24px; page-break-inside: avoid; }
      .signature-column > b { display: block; margin-bottom: 30px; text-transform: uppercase; }
      .signature { padding-top: 5px; border-bottom: 1px solid #111; text-align: center; }
      .signature strong { display: block; color: #172033; font-size: 12px; text-transform: uppercase; }
      .signature span { display: block; color: #475569; font-size: 8px; font-style: italic; }
      .signature-date { margin-top: 6px; text-align: center; font-weight: 700; }
      .confirmation { margin-top: 30px; border-top: 5px solid #004a8d; padding-top: 18px; text-align: center; page-break-inside: avoid; }
      .confirmation h2 { margin: 0; padding: 8px; color: #fff; background: #004a8d; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
      .confirmation p { margin: 8px 25px 0; color: #34465f; font-size: 7.5px; font-weight: 800; text-transform: uppercase; }
      @media print { .estimation-report { width: 100%; } }
    </style>
    <div class="estimation-report">
      <header class="brand-header">
        <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="AA2000 Security and Technology Solutions Inc.">
        <div class="brand-contact">
          <div>UNIT 2C NORKIS BUILDING 11 CALBAYOG ST. COR. LIBERTAD, HIGHWAY HILLS, MANDALUYONG CITY, PHILIPPINES 1550</div>
          <div>T: (02) 8571-56-93; 7155-7010</div>
          <div>M: 0917-155-7010</div>
          <div>E: INFO.AA2000@GMAIL.COM / AA2000ENT@GMAIL.COM</div>
          <div>WWW.AA2000PH.COM</div>
        </div>
      </header>

      <main class="report-body">
        <div class="proposal-meta">
          <div>Validity:<span>30 Days</span></div>
          <div>Ref:<span>${escapeHtml(reference)}</span></div>
          <div>Date:<span>${escapeHtml(dateLabel)}</span></div>
        </div>

        <div class="client-box">
          <div class="client-grid">
            <div class="client-field"><b>Attention To:</b><span>${display(project.clientContactName)}</span></div>
            <div class="client-field"><b>Position:</b><span>Not specified</span></div>
            <div class="client-field"><b>Company:</b><span>${display(project.clientName)}</span></div>
            <div class="client-field"><b>Tel./Mobile No.:</b><span>${display(project.clientPhone)}</span></div>
            <div class="client-field"><b>Email:</b><span>${display(project.clientEmail)}</span></div>
            <div class="client-field"><b>Address:</b><span>${display(project.location)}</span></div>
            <div class="client-field"><b>Project For:</b><span>${display(project.name)}</span></div>
            <div class="client-field"><b>Project Site:</b><span>${display(project.location)}</span></div>
          </div>
        </div>

        <p class="proposal-intro">We respectfully submit our project estimation proposal for your requirements. We look forward to the approval of our proposed project scope and cost, as follows:</p>

        <section class="report-section compact-section">
          <h2>Project / Site Survey Details</h2>
          <table><tbody>
            <tr><td class="label">System(s)</td><td>${escapeHtml(systemLabel)}</td><td class="label">Status</td><td>${display(project.status)}</td></tr>
            <tr><td class="label">Building Type</td><td>${display(project.buildingType)}</td><td class="label">New Building</td><td>${project.isNewBuilding === undefined ? 'Not specified' : project.isNewBuilding ? 'Yes' : 'No'}</td></tr>
            <tr><td class="label">Floors</td><td>${display(project.floors)}</td><td class="label">Rooms</td><td>${display(project.rooms)}</td></tr>
            <tr><td class="label">Floor Area</td><td>${project.totalFloorArea ? `${display(project.totalFloorArea)} sq.m.` : 'Not specified'}</td><td class="label">Dimensions</td><td>${escapeHtml(buildingDimensions)}</td></tr>
            <tr><td class="label">Floor Height</td><td>${project.floorHeight ? `${display(project.floorHeight)} m` : 'Not specified'}</td><td class="label">Survey / Start Date</td><td>${escapeHtml(formatDate(project.startDate || project.createdAt))}</td></tr>
            <tr><td class="label">Survey Scope</td><td colspan="3">${multiline(project.surveyScope)}</td></tr>
          </tbody></table>
        </section>

        <div class="summary-strip">
          <div><b>Systems</b><span>${systems.length || 0}</span></div>
          <div><b>Material Lines</b><span>${consumables.length}</span></div>
          <div><b>Total Headcount</b><span>${manpower.reduce((sum, item) => sum + Number(item.headcount || 0), 0)}</span></div>
          <div><b>Total Man-Days</b><span>${manpower.reduce((sum, item) => sum + Number(item.manDays || 0), 0)}</span></div>
        </div>

        <section class="report-section compact-section">
          <h2>A. General Requirements</h2>
          <table><tbody>
            <tr><td class="center small-col">1</td><td>Project coordination, site verification, mobilization, testing, commissioning, and documentation are subject to the recorded survey scope and site constraints.</td><td class="center qty-col">1 LOT</td></tr>
            <tr><td class="center">2</td><td>Final quantities shall be validated against approved plans and actual site conditions before implementation.</td><td class="center">1 LOT</td></tr>
          </tbody></table>
        </section>

        <section class="report-section${scopeOfWorks.length <= 6 ? ' compact-section' : ''}">
          <h2>B. Scope of Works</h2>
          <table>
            <thead><tr><th class="center small-col">No.</th><th>Description</th><th class="center qty-col">Unit</th>${showPrices ? '<th class="number price-col">Amount</th>' : ''}</tr></thead>
            <tbody>${scopeRows}</tbody>
          </table>
        </section>

        ${renderMaterialTable('C. Active Components', activeComponents, showPrices)}
        ${renderMaterialTable('D. Roughing-In Materials', roughingMaterials, showPrices)}
        ${renderMaterialTable('E. Cable / Wire Components', cableMaterials, showPrices)}

        <section class="report-section${manpower.length <= 8 ? ' compact-section' : ''}">
          <h2>F. Labor / Manpower</h2>
          <table>
            <thead><tr><th class="center small-col">No.</th><th>Role</th><th class="center">Headcount</th><th class="center">Hours</th><th class="center">Man-Days</th>${showPrices ? '<th class="number price-col">Day Rate</th><th class="number price-col">Amount</th>' : ''}</tr></thead>
            <tbody>${manpowerRows}</tbody>
          </table>
        </section>

        <section class="report-section${fees.length <= 6 ? ' compact-section' : ''}">
          <h2>G. Additional Project Fees</h2>
          <table>
            <thead><tr><th class="center small-col">No.</th><th>Fee Type</th><th>Description</th><th>Notes</th>${showPrices ? '<th class="number price-col">Amount</th>' : ''}</tr></thead>
            <tbody>${feeRows}</tbody>
          </table>
        </section>

        ${priceSummary}

        <section class="report-section compact-section">
          <h2>Note and Remarks: Recorded Site Survey Conditions</h2>
          <table class="remarks-table"><tbody>
            <tr><td class="center small-col"><b>1</b></td><td><b>Physical Constraints:</b> ${multiline(constraints.physical)}</td></tr>
            <tr><td class="center"><b>2</b></td><td><b>Electrical Constraints:</b> ${multiline(constraints.electrical)}</td></tr>
            <tr><td class="center"><b>3</b></td><td><b>Installation / Cabling Constraints:</b> ${multiline(constraints.installation)}</td></tr>
            <tr><td class="center"><b>4</b></td><td><b>Technician Notes:</b> ${multiline(technicianNotes)}</td></tr>
          </tbody></table>
        </section>

        <div class="signatures">
          <div class="signature-column">
            <b>Prepared by:</b>
            <div class="signature"><strong>${display(preparedBy)}</strong><span>Project Estimator</span></div>
          </div>
          <div class="signature-column">
            <b>&nbsp;</b>
            <div class="signature"><strong>${display(project.clientContactName, 'Client Name')}</strong><span>Client Conforme</span></div>
            <div class="signature-date">Date: ${escapeHtml(dateLabel)}</div>
          </div>
        </div>

        <div class="confirmation">
          <h2>Confirmation</h2>
          <p>This project estimation will be regarded as confirmation of the surveyed requirements upon approval. Kindly acknowledge with an authorized signature or approved project document.</p>
        </div>

      </main>
    </div>`;
}
