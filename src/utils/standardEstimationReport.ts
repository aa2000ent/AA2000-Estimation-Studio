// Estimation report in the AA2000 commercial quotation format (Sales Quotation
// "full report"): A. General Requirements, B. Scope of Works, C. Active
// Components, D. Roughing-ins, E. Cable Components, F. Breakdown of Cost.
// The same HTML feeds the on-screen preview and the downloaded PDF.
import type { Project, User } from '../App';
import type {
  EstimationAdditionalFeeEntry,
  EstimationConsumableEntry,
  EstimationManpowerEntry,
} from '../types';
import type { QuotationHeaderState, ScopeOfWorkEntry } from '../components/estimation/QuotationModal';
import type { EstimationTotals } from '../services/estimationStats';

export interface StandardEstimationReportInput {
  project: Project;
  user: User | null;
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks: ScopeOfWorkEntry[];
  constraints: { physical?: string; electrical?: string; installation?: string };
  technicianNotes: string;
  /** From computeEstimationTotals — the same numbers saved to the database. */
  totals: EstimationTotals;
  showPrices: boolean;
  /** Marks a report exported from unsaved edits. */
  isDraft?: boolean;
  /** Client/reference details edited in the quotation preview; blanks fall back to the project. */
  header?: Partial<QuotationHeaderState>;
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

const display = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return escapeHtml(text || fallback);
};

const multiline = (value: unknown, fallback = ''): string =>
  display(value, fallback).replace(/\r?\n/g, '<br>');

const firstText = (...values: unknown[]): string =>
  values.map(v => String(v ?? '').trim()).find(Boolean) || '';

const normalizedSystem = (value: string): string => value
  .replace(/_/g, ' ')
  .replace(/\bFIRE ALARM\b/i, 'FDAS')
  .toUpperCase();

const isCableMaterial = (item: EstimationConsumableEntry): boolean =>
  /cable|wire|utp|rg\s*-?\s*(?:6|59)|fiber|fibre/i.test(`${item.category} ${item.name}`);

const isRoughingMaterial = (item: EstimationConsumableEntry): boolean =>
  /rough|conduit|pipe|pvc|mould|trunk|junction|utility box|mount|bracket|fastener|anchor|clamp|tape|connector|label|protective|covering/i
    .test(`${item.category} ${item.name}`);

const sumBy = <T,>(rows: T[], pick: (row: T) => number | undefined): number =>
  rows.reduce((sum, row) => sum + Number(pick(row) || 0), 0);

export interface ReportSystemGroup {
  key: string;
  label: string;
  items: EstimationConsumableEntry[];
  subtotal: number;
}

const SHARED_GROUP_LABEL = 'Shared / Unassigned Materials';

/**
 * Splits material rows into one group per surveyed system (e.g. "CCTV 1",
 * "CCTV 2", "FDAS"). Rows without a source survey belong to the project's
 * only system when it has exactly one; otherwise they are listed separately
 * rather than guessed into a system.
 */
export function groupConsumablesBySystem(
  consumables: EstimationConsumableEntry[],
  projectSystemTypes: string[] = [],
): ReportSystemGroup[] {
  const fallbackLabel = projectSystemTypes.length === 1 ? normalizedSystem(projectSystemTypes[0]) : SHARED_GROUP_LABEL;
  const groups = new Map<string, ReportSystemGroup>();

  consumables.forEach(item => {
    const tagged = item.surveyId || item.systemLabel || item.systemType;
    const label = tagged ? normalizedSystem(item.systemLabel || item.systemType || 'Other') : fallbackLabel;
    const key = tagged ? `survey:${item.surveyId || label}` : `label:${label}`;
    const group = groups.get(key) || { key, label, items: [], subtotal: 0 };
    group.items.push(item);
    group.subtotal += Number(item.totalPrice || 0);
    groups.set(key, group);
  });

  // Untagged rows in a single-system project share that system's label; merge them in.
  const merged = new Map<string, ReportSystemGroup>();
  groups.forEach(group => {
    const existing = group.key.startsWith('label:')
      ? Array.from(merged.values()).find(g => g.label === group.label)
      : undefined;
    if (existing) {
      existing.items.push(...group.items);
      existing.subtotal += group.subtotal;
    } else {
      merged.set(group.key, group);
    }
  });

  return Array.from(merged.values()).sort((a, b) =>
    Number(a.label === SHARED_GROUP_LABEL) - Number(b.label === SHARED_GROUP_LABEL));
}

/** Throws when the system subtotals do not add up to the authoritative materials total. */
export function assertMaterialsReconcile(groups: ReportSystemGroup[], materialsTotal: number): void {
  const sum = groups.reduce((total, group) => total + group.subtotal, 0);
  if (Math.abs(sum - materialsTotal) > 0.005) {
    throw new Error(`Report materials (${sum.toFixed(2)}) do not match the estimation total (${materialsTotal.toFixed(2)}).`);
  }
}

const ROWS_PER_CHUNK = 8;

const noneRow = (columns: number): string =>
  `<tr><td class="none" colspan="${columns}">NONE</td></tr>`;

/** Product tables in the quotation style: one blue bar per system/brand with its own subtotal. */
const renderProductSection = (
  title: string,
  groups: ReportSystemGroup[],
  matches: (item: EstimationConsumableEntry) => boolean,
  showPrices: boolean,
): { html: string; total: number } => {
  const head = `<thead><tr>
      <th class="item-col">Item</th><th class="model-col">Model</th><th>Description</th><th class="qty-col">Qty</th>
      ${showPrices ? '<th class="price-col">Unit Price</th><th class="price-col">Total Price</th>' : ''}
    </tr></thead>`;
  const showSystem = groups.length > 1;
  const blocks: string[] = [];
  let sectionTotal = 0;

  groups.forEach(group => {
    const byBrand = group.items.filter(matches).reduce<Record<string, EstimationConsumableEntry[]>>((acc, item) => {
      const brand = (item.brand?.trim() || 'Other').toUpperCase();
      (acc[brand] ||= []).push(item);
      return acc;
    }, {});

    Object.entries(byBrand).forEach(([brand, items]) => {
      const brandTotal = sumBy(items, i => i.totalPrice);
      sectionTotal += brandTotal;
      const bar = showSystem ? `${escapeHtml(group.label)} &middot; ${escapeHtml(brand)}` : escapeHtml(brand);

      for (let start = 0; start < items.length; start += ROWS_PER_CHUNK) {
        const chunk = items.slice(start, start + ROWS_PER_CHUNK);
        const last = start + ROWS_PER_CHUNK >= items.length;
        const rows = chunk.map((item, index) => `
          <tr>
            <td class="center bold">${start + index + 1}</td>
            <td class="center bold">${display(item.productId, '-')}</td>
            <td><b>${display(item.name)}</b>${item.notes ? `<span class="sub-note">${display(item.notes)}</span>` : ''}</td>
            <td class="center bold">${display(item.quantity)}${item.unit && item.unit !== 'pcs' ? ` ${display(item.unit)}` : ''}</td>
            ${showPrices ? `<td class="number bold">${money(item.unitPrice)}</td><td class="number bold">${money(item.totalPrice)}</td>` : ''}
          </tr>`).join('');
        blocks.push(`
          <div class="keep">
            <div class="brand-bar">${bar}${start > 0 ? '<span>Continued</span>' : ''}</div>
            <table>${head}<tbody>${rows}</tbody>
              ${showPrices && last ? `<tfoot><tr class="subtotal-row"><td colspan="5">Sub. Total (${escapeHtml(brand)}):</td><td class="number">${money(brandTotal)}</td></tr></tfoot>` : ''}
            </table>
          </div>`);
      }
    });
  });

  const titleBar = `<div class="yellow-bar">${escapeHtml(title)}</div>`;
  return {
    total: sectionTotal,
    html: blocks.length
      ? `<section class="box">${titleBar}${blocks.join('')}</section>`
      : `<section class="box keep">${titleBar}<table>${head}<tbody>${noneRow(showPrices ? 6 : 4)}</tbody></table></section>`,
  };
};

const STANDARD_REMARKS = [
  'Any additional services and materials that are not included in this quotation',
  'Any additional civil and engineering works. Signed and seale of professional engineer.',
  'Insurance policy or bonds',
  'Scaffolding rental, delivery and pullout - if required',
  'Professional project assistance (safety officer) – as required',
  'Covid-19 related requirements.',
];

const STANDARD_TERMS = [
  'Unless specified, above given prices are VAT EXCLUDED.',
  'Prices are based on cost and conditions existing on date of quotation and are SUBJECT TO CHANGE BY THE SELLER UPON FINAL ACCEPTANCE.',
  'Others: Any other materials/equipment/permits/installation/bonds works not stated herein shall be considered as ADDITIONAL COST.',
  'Warehouse Charges/Penalties: There will be a 500 pesos penalty per day, if devices are not picked up upon notice of availability',
  'A penalty charge of 40% of the total contract price will be imposed for cancellation of Purchase Order.',
  'LATE PAYMENT PENALTY CHARGE: Any payments not made within the specified period of time, it will incur an interest charge at the rate of 1% of the total contract/P.O. price.',
  'Delivery: For client charge or Pick up by Client. (For Supply Only)',
];

const REPORT_STYLES = `
  * { box-sizing: border-box; }
  .estimation-report { width: 794px; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 8px; line-height: 1.35; }
  .report-body { padding: 0 46px 28px; }
  .brand-header { height: 145px; padding: 7px 42px 7px 35px; display: flex; align-items: center; justify-content: space-between; background-color: #1d3a64; background-size: cover; background-position: 85% center; }
  .brand-logo { width: 285px; height: 130px; object-fit: contain; }
  .brand-contact { width: 290px; color: #fff; font-size: 7px; font-weight: 800; line-height: 1.55; }
  .brand-contact div { margin: 3px 0; }
  .brand-contact .addr { margin-bottom: 7px; }
  .meta { display: flex; justify-content: space-between; margin: 14px 0 20px; padding: 6px 0; border-top: 1px solid #111; border-bottom: 1px solid #111; font-size: 8px; font-weight: 900; text-transform: uppercase; }
  .client-box { margin-bottom: 18px; padding: 8px 10px; border: 1px solid #111; display: grid; grid-template-columns: 1fr 1fr; column-gap: 40px; row-gap: 3px; }
  .field { display: grid; grid-template-columns: 90px 1fr; align-items: end; gap: 6px; min-height: 18px; }
  .field b { color: #7a3d0a; font-size: 7px; font-weight: 900; text-transform: uppercase; }
  .field b.plain { color: #111; }
  .field span { min-height: 14px; padding: 0 2px 2px; border-bottom: 1px solid #d5d9df; font-weight: 700; overflow-wrap: anywhere; }
  .intro { margin: 0 0 16px; color: #34465f; font-size: 7.5px; font-style: italic; font-weight: 800; text-transform: uppercase; }
  .draft-banner { margin-top: 10px; padding: 6px; border: 1px solid #ef172f; color: #ef172f; font-size: 8px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: .6px; }
  .box { margin-top: 14px; border: 1px solid #111; }
  .yellow-bar { padding: 6px 8px; background: #ffff00; border-bottom: 1px solid #111; color: #050505; font-size: 9px; font-weight: 900; text-align: center; text-transform: uppercase; break-after: avoid-page; page-break-after: avoid; }
  .brand-bar { display: flex; justify-content: space-between; padding: 6px 12px; background: #004a8d; color: #fff; border-bottom: 1px solid #111; font-size: 9px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
  .brand-bar span { color: #dbeafe; font-size: 6.5px; letter-spacing: .8px; }
  .slate-bar { padding: 6px 8px; background: #c9d6e3; border-bottom: 1px solid #111; font-size: 9px; font-weight: 900; text-align: center; text-transform: uppercase; }
  .keep, .avoid { break-inside: avoid-page; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: inherit; }
  th, td { padding: 6px; border-right: 1px solid #111; border-bottom: 1px solid #e2e6ec; vertical-align: middle; overflow-wrap: anywhere; }
  th:last-child, td:last-child { border-right: 0; }
  th { background: #e2e8f0; border-bottom: 1px solid #111; font-size: 7px; font-weight: 900; text-align: center; text-transform: uppercase; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .center { text-align: center; }
  .number { text-align: right; white-space: nowrap; }
  .bold { font-weight: 900; }
  .item-col { width: 44px; } .model-col { width: 96px; } .qty-col { width: 52px; } .unit-col { width: 60px; } .price-col { width: 104px; }
  .sub-note { display: block; margin-top: 2px; color: #64748b; font-size: 6.5px; font-weight: 400; }
  .none { padding: 9px; color: #64748b; font-style: italic; font-weight: 900; text-align: center; letter-spacing: 1px; }
  .subtotal-row td { background: #e2e8f0; border-top: 1px solid #111; font-weight: 900; text-align: right; text-transform: uppercase; }
  .totals td { font-weight: 900; text-align: right; text-transform: uppercase; background: #f8fafc; border-top: 1px solid #111; }
  .totals .discount td { color: #dc2626; }
  .totals .vat td { color: #1d4ed8; }
  .totals .grand td { background: #e2e8f0; font-size: 9px; }
  .totals .grand .vat-note { color: #dc2626; text-align: center; font-size: 7.5px; }
  .list td { border-right: 0; border-bottom: 0; padding: 3px 10px; font-weight: 700; text-transform: uppercase; }
  .list td:first-child { width: 28px; text-align: center; }
  .terms td { font-weight: 400; text-transform: none; border-bottom: 1px solid #111; }
  .terms td:first-child { border-right: 1px solid #111; }
  .terms tr:last-child td { border-bottom: 0; }
  .info-box { margin-top: 14px; border: 1px solid #111; }
  .info-box > div { padding: 8px 10px; border-bottom: 1px solid #111; }
  .info-box > div:last-child { border-bottom: 0; }
  .info-box h4 { margin: 0 0 4px; font-size: 7.5px; font-weight: 900; text-transform: uppercase; }
  .info-row { display: grid; grid-template-columns: 140px 1fr; padding-left: 40px; font-weight: 700; text-transform: uppercase; margin: 2px 0; }
  .info-line { padding-left: 40px; font-weight: 700; text-transform: uppercase; margin: 2px 0; }
  .red { color: #dc2626; }
  .restricted-note { margin-top: 14px; padding: 9px; border: 1px solid #f0c36d; background: #fff8e6; color: #7c5310; font-weight: 700; text-align: center; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 26px; align-items: end; }
  .sig-label { margin-bottom: 34px; font-weight: 900; text-transform: uppercase; }
  .sig { border-bottom: 1px solid #111; padding-bottom: 3px; text-align: center; }
  .sig strong { display: block; font-size: 11px; }
  .sig-under { text-align: center; }
  .sig-under b { display: block; margin-top: 6px; font-size: 10px; text-transform: uppercase; }
  .sig-under i { display: block; color: #475569; }
  .sig-client { padding-top: 2px; border-top: 2px solid #111; }
  .sig-client-name { min-height: 15px; margin-bottom: 4px; text-align: center; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .confirmation { margin-top: 28px; border-top: 5px solid #004a8d; padding-top: 16px; text-align: center; }
  .confirmation h2 { margin: 0; padding: 8px; color: #fff; background: #0b3768; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
  .confirmation p { margin: 10px 25px 0; color: #34465f; font-size: 7.5px; font-weight: 800; text-transform: uppercase; }
`;

export function buildStandardEstimationReportHtml(input: StandardEstimationReportInput): string {
  const {
    project, user, manpower, consumables, fees, scopeOfWorks, constraints, technicianNotes,
    totals, showPrices, isDraft = false, header = {}, headerBackgroundUrl, logoUrl,
  } = input;

  const systemGroups = groupConsumablesBySystem(consumables, project.systemTypes || []);
  assertMaterialsReconcile(systemGroups, totals.materialsTotal);

  const now = new Date();
  const projectKey = String(project.dbProjId || project.id || 'DRAFT').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() || 'DRAFT';
  const reference = firstText(header.referenceCode, `EST-${now.getFullYear()}-${projectKey}`);
  const dateLabel = firstText(header.quoteDate, now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })).toUpperCase();
  const validity = !header.validityPeriod || /^30 days/i.test(header.validityPeriod) ? '30 DAYS' : header.validityPeriod;
  const preparedBy = firstText(project.technicianName, user?.fullName, 'Assigned Technician');
  const clientName = firstText(header.attentionTo, project.clientContactName);
  const priceCols = showPrices ? 2 : 0;

  const tableHead = `<thead><tr>
      <th class="item-col">Item</th><th>Description</th><th class="qty-col">Qty.</th><th class="unit-col">Unit</th>
      ${showPrices ? '<th class="price-col">Unit Price</th><th class="price-col">Total Price</th>' : ''}
    </tr></thead>`;
  const subtotalFoot = (label: string, amount: number) => showPrices
    ? `<tfoot><tr class="subtotal-row"><td colspan="5">Sub. Total (${label}):</td><td class="number">${money(amount)}</td></tr></tfoot>`
    : '';

  // A. General Requirements — additional project fees, each one LOT.
  const generalRows = fees.map((fee, index) => `
      <tr>
        <td class="center bold">${index + 1}</td>
        <td class="bold">${display(firstText(fee.description, fee.type))}${fee.notes ? `<span class="sub-note">${display(fee.notes)}</span>` : ''}</td>
        <td class="center bold">1</td><td class="center bold">LOT</td>
        ${showPrices ? `<td class="number bold">${money(fee.amount)}</td><td class="number bold">${money(fee.amount)}</td>` : ''}
      </tr>`).join('');

  // B. Scope of Works — priced installation labor, then the descriptive scope items.
  const laborRows = manpower.map((m, index) => `
      <tr>
        <td class="center bold">${index + 1}</td>
        <td class="bold">${display(m.role)}<span class="sub-note">${display(m.headcount)} pax &middot; ${display(m.hours)} hrs</span></td>
        <td class="center bold">${display(m.manDays)}</td><td class="center bold">MAN-DAY</td>
        ${showPrices ? `<td class="number bold">${money(m.dayRate)}</td><td class="number bold">${money(m.totalCost)}</td>` : ''}
      </tr>`).join('');
  const scopeRows = scopeOfWorks.map((s, index) => `
      <tr>
        <td class="center bold">${manpower.length + index + 1}</td>
        <td>${multiline(s.description)}</td>
        <td class="center bold">1</td><td class="center bold">${display(s.unit, 'LOT')}</td>
        ${showPrices ? '<td class="center" colspan="2"><i>Included in installation labor</i></td>' : ''}
      </tr>`).join('');

  const sectionC = renderProductSection('C. Active Components', systemGroups, i => !isCableMaterial(i) && !isRoughingMaterial(i), showPrices);
  const sectionD = renderProductSection('D. Roughing-ins Materials', systemGroups, i => !isCableMaterial(i) && isRoughingMaterial(i), showPrices);
  const sectionE = renderProductSection('E. Cable Components', systemGroups, isCableMaterial, showPrices);

  const lotRow = (letter: string, label: string, amount: number, hasItems: boolean) => `
      <tr>
        <td class="center bold">${letter}.</td><td class="bold">${label}</td>
        <td class="center bold">${hasItems ? '1' : '-'}</td><td class="center bold">${hasItems ? 'LOT' : '-'}</td>
        <td class="number bold">${hasItems ? money(amount) : '-'}</td><td class="number bold">${money(amount)}</td>
      </tr>`;

  const systemSummary = showPrices && systemGroups.length > 1 ? `
    <section class="box avoid">
      <div class="yellow-bar">Materials by System (C &ndash; E)</div>
      <table><tbody>
        ${systemGroups.map(g => `<tr><td class="bold">Sub. Total (${escapeHtml(g.label)}):</td><td class="number bold price-col">${money(g.subtotal)}</td></tr>`).join('')}
        <tr class="subtotal-row"><td>Materials Total:</td><td class="number">${money(totals.materialsTotal)}</td></tr>
      </tbody></table>
    </section>` : '';

  const breakdown = showPrices ? `
    <section class="box avoid">
      <div class="yellow-bar">F. Breakdown of Cost:</div>
      <table>${tableHead}
        <tbody>
          ${lotRow('A', 'GENERAL REQUIREMENTS', totals.feesTotal, fees.length > 0)}
          ${lotRow('B', 'SCOPE OF WORKS (INSTALLATION LABOR)', totals.laborTotal, manpower.length > 0)}
          ${lotRow('C', 'ACTIVE COMPONENTS', sectionC.total, sectionC.total > 0)}
          ${lotRow('D', 'ROUGHING INS MATERIAL', sectionD.total, sectionD.total > 0)}
          ${lotRow('E', 'CABLE COMPONENT', sectionE.total, sectionE.total > 0)}
        </tbody>
        <tbody class="totals">
          <tr><td colspan="5">Sub. Total:</td><td class="number">${money(totals.subtotal)}</td></tr>
          <tr class="discount"><td colspan="5">Less Discount:</td><td class="number">${money(0)}</td></tr>
          <tr class="vat"><td colspan="5">Add 12% VAT:</td><td class="number">${money(totals.vat)}</td></tr>
          <tr class="grand"><td colspan="3" class="vat-note">The price is 12% VAT inclusive</td><td colspan="2">Total Amount:</td><td class="number">${money(totals.grandTotal)}</td></tr>
        </tbody>
      </table>
    </section>` : '<div class="restricted-note">Commercial rates and totals are intentionally omitted for this user role.</div>';

  const surveyNotes = [
    constraints.physical && `Physical constraints: ${constraints.physical}`,
    constraints.electrical && `Electrical constraints: ${constraints.electrical}`,
    constraints.installation && `Installation constraints: ${constraints.installation}`,
    technicianNotes && `Technician notes: ${technicianNotes}`,
  ].filter((n): n is string => Boolean(n && n.trim()));

  const field = (label: string, value: string, plain = false) =>
    `<div class="field"><b${plain ? ' class="plain"' : ''}>${label}</b><span>${display(value)}</span></div>`;

  return `
    <style>${REPORT_STYLES}</style>
    <div class="estimation-report">
      <header class="brand-header" style="background-image: url('${escapeHtml(headerBackgroundUrl)}')">
        <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="AA2000 Security and Technology Solutions Inc.">
        <div class="brand-contact">
          <div class="addr">UNIT 2C NORKIS BUILDING 11 CALBAYOG ST. COR. LIBERTAD, HIGHWAY HILLS, MANDALUYONG CITY, PHILIPPINES 1550</div>
          <div>(02) 8571-56-93; 7155-7010</div>
          <div>09171557010</div>
          <div>INFO.AA2000@GMAIL.COM / AA2000ENT@GMAIL.COM</div>
          <div>WWW.AA2000PH.COM</div>
        </div>
      </header>

      <main class="report-body">
        ${isDraft ? '<div class="draft-banner">Draft &mdash; contains unsaved changes; figures may differ from the saved estimation.</div>' : ''}
        <div class="meta avoid">
          <div>Validity: ${escapeHtml(validity)}</div>
          <div>Ref: ${escapeHtml(reference)}</div>
          <div>Date: ${escapeHtml(dateLabel)}</div>
        </div>

        <div class="client-box avoid">
          ${field('Attention To:', clientName)}
          ${field('Position:', header.thru && header.thru !== 'Building Manager' ? header.thru : '', true)}
          ${field('Company:', firstText(header.company, project.clientName))}
          ${field('Tel/Mobile No.:', firstText(header.contactNo, project.clientPhone))}
          ${field('Email:', firstText(header.emailAdd, project.clientEmail))}
          ${field('Address:', firstText(header.address, project.location))}
          ${field('Project For:', firstText(header.projectTitle, project.name), true)}
          ${field('Project Site:', firstText(header.projectSite, project.locationName, project.location), true)}
        </div>

        <p class="intro">We respectfully submit our proposal for your requirements. We look forward to the approval of our project estimation, as follows:</p>

        <section class="box${fees.length <= 8 ? ' keep' : ''}">
          <div class="yellow-bar">A. General Requirements</div>
          <table>${tableHead}<tbody>${generalRows || noneRow(4 + priceCols)}</tbody>${fees.length ? subtotalFoot('General Requirements', totals.feesTotal) : ''}</table>
        </section>

        <section class="box">
          <div class="yellow-bar">B. Scope of Works</div>
          <table>${tableHead}<tbody>${laborRows + scopeRows || noneRow(4 + priceCols)}</tbody>${manpower.length ? subtotalFoot('Installation Labor', totals.laborTotal) : ''}</table>
        </section>

        ${sectionC.html}
        ${sectionD.html}
        ${sectionE.html}
        ${systemSummary}
        ${breakdown}

        <section class="box avoid">
          <div class="yellow-bar">Note and Remarks: All indicated below shall be billed separately</div>
          <table class="list"><tbody>
            ${[...STANDARD_REMARKS, ...surveyNotes].map((text, i) => `<tr><td>${i + 1}</td><td>${multiline(text)}</td></tr>`).join('')}
          </tbody></table>
        </section>

        <section class="box avoid">
          <div class="slate-bar">Terms and Conditions</div>
          <table class="list terms"><tbody>
            ${STANDARD_TERMS.map((text, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(text)}</td></tr>`).join('')}
          </tbody></table>
        </section>

        <div class="info-box avoid">
          <div><h4>Payment Terms:</h4>
            <div class="info-row"><span>Supply of Devices:</span><span>50% Downpayment ; 50% upon pick up/delivery of the items.</span></div>
            <div class="info-row"><span>Supply of Labor:</span><span>50% Downpayment ; 50% upon completion.</span></div>
          </div>
          <div><h4>Payment Details:</h4>
            <div class="info-line">Bank deposit payment (<b>BDO account number: 006930089663</b>)</div>
            <div class="info-line">Check payment must be named under <b>AA2000 Security and Technology Solution Inc.</b></div>
          </div>
          <div><h4>Warranty Period:</h4>
            <div class="info-line">&bull; Product warranty: 1 year</div>
            <div class="info-line">&bull; 7 days replacement against factory defects.</div>
          </div>
          <div><h4>Availability:</h4>
            <div class="info-line">2-4 working days if on stock upon receipt of P.O and downpayment.</div>
            <div class="info-line">12-16 weeks if no stock/pre-order basis.</div>
            <div class="info-line"><span class="red">Note:</span> stocks of goods are subject for confirmation upon order.</div>
          </div>
        </div>

        <div class="signatures avoid">
          <div>
            <div class="sig-label">Prepared by:</div>
            <div class="sig"><strong>${display(preparedBy)}</strong></div>
            <div class="sig-under"><i>Project Estimator</i></div>
          </div>
          <div>
            <div class="sig-client-name">${display(clientName)}</div>
            <div class="sig-client"><div class="sig-under"><b>Client Conforme</b><i>Signature over Printed Name</i>Date: ____________</div></div>
          </div>
        </div>

        <div class="confirmation avoid">
          <h2>Confirmation</h2>
          <p>This proposal will be regarded as an order confirmation upon acceptance. Kindly acknowledge with your signature accompanied by a purchase order and/or company stamp. Thank you for your trust and confidence.</p>
        </div>
      </main>
    </div>`;
}
