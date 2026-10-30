import { computeEstimationStats, laborLineTotal, materialLineTotal } from '../services/estimationStats';
import type { EstimationManpowerEntry, EstimationConsumableEntry, EstimationAdditionalFeeEntry } from '../types';

const esc = (value: unknown): string => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const money = (value: number): string => `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const proposalTemplateCss = `
  .estimation-report { font-size:9px;line-height:1.25;color:#050505 }
  .estimation-report .report-body {padding:0}
  .estimation-report .proposal-cover {page-break-after:auto}
  .estimation-report .logical-sheet {width:794px;min-height:1048px;page-break-before:always;background:#fff}
  .estimation-report .compact-page-header {height:38px;background:#103861;color:#fff;padding:0 48px;display:flex;align-items:center;justify-content:space-between;gap:18px;font-size:8px}
  .estimation-report .compact-page-header b {max-width:62%;font-size:8px}
  .estimation-report .compact-page-header span {max-width:36%;font-size:7px;overflow-wrap:anywhere;text-align:right}
  .estimation-report .sheet-content {padding:14px 52px 0;display:flow-root}
  .estimation-report .logical-sheet tr,.estimation-report .logical-sheet .compact-section,.estimation-report .logical-sheet .signatures,.estimation-report .logical-sheet .confirmation,.estimation-report .logical-sheet .summary-strip {page-break-inside:auto;break-inside:auto}
  .estimation-report .sheet-content>div,.estimation-report .sheet-content>section,.estimation-report .sheet-content>p {margin-top:0;margin-bottom:12px}
  .estimation-report .report-section {border:0;margin:0 0 12px}
  .estimation-report h2 {margin:0;padding:6px 5px;background:#ffff00;border:1px solid #111;text-align:center;text-transform:uppercase;font-size:10px;font-weight:700;letter-spacing:0}
  .estimation-report h3 {margin:0 0 6px;font-size:10px;color:#103861}
  .estimation-report table {font-size:9px;table-layout:fixed}
  .estimation-report th,.estimation-report td {border:1px solid #333;padding:5px 7px;vertical-align:middle}
  .estimation-report th {background:#e1e7ee;text-align:center;font-size:8px;font-weight:700}
  .estimation-report th:last-child,.estimation-report td:last-child,.estimation-report tbody tr:last-child td {border:1px solid #333}
  .estimation-report .proposal-table h2+table,.estimation-report .terms-table h2+table {margin-top:-1px}
  .estimation-report .number {font-size:8px;white-space:nowrap}
  .estimation-report .strong {font-weight:700}
  .estimation-report small {display:block;margin-top:3px;font-size:7px;color:#50657d}
  .estimation-report .brand-row td {background:#105592;color:#fff;font-weight:700;padding:5px 10px}
  .estimation-report .group-subtotal td {background:#e1e7ee;text-align:right;font-weight:700}
  .estimation-report .section-heading {padding:7px;text-align:center;color:#fff;font-weight:700;font-size:10px}
  .estimation-report .layout-block h3 {font-size:9px;color:#050505;text-transform:uppercase}
  .estimation-report .plan-grid {height:175px;border:1px dashed #8d9cb0;background-color:#f6f8fc;background-image:linear-gradient(#dfe7f0 1px,transparent 1px),linear-gradient(90deg,#dfe7f0 1px,transparent 1px);background-size:24px 24px;display:flex;align-items:center;justify-content:center;text-align:center;color:#6e819b;font-size:9px;padding:25px}
  .estimation-report .layout-block small {font-style:italic}
  .estimation-report .section-total {background:#e1e7ee;border:1px solid #333;padding:8px;display:flex;justify-content:space-between;font-size:9px}
  .estimation-report .cost-system td {color:#fff;font-weight:700;padding:7px 10px}
  .estimation-report .summary-row td:first-child {text-align:right;font-weight:700}
  .estimation-report .discount {color:#f01430}
  .estimation-report .vat {color:#004bff}
  .estimation-report .total {background:#e1e7ee}
  .estimation-report .template-remarks {border:1px solid #333}
  .estimation-report .template-remarks h2 {border:0;border-bottom:1px solid #333;font-size:9px}
  .estimation-report .template-remarks ol {margin:0;padding:4px 14px 4px 43px;font-size:8px;font-weight:700;text-transform:uppercase}
  .estimation-report .template-remarks li {padding:5px 3px}
  .estimation-report .terms-table h2 {background:#cbd6e2}
  .estimation-report .terms-table td {padding:4px 7px;font-size:8px}
  .estimation-report .commercial-terms {border:1px solid #333;font-size:8px;font-weight:700}
  .estimation-report .commercial-terms>div {padding:7px;border-bottom:1px solid #333}
  .estimation-report .commercial-terms>div:last-child {border-bottom:0}
  .estimation-report .commercial-terms p {margin:2px 0 0 30px;line-height:1.4}
  .estimation-report .commercial-terms em {font-style:normal;color:#f01430}
  .estimation-report .template-signatures {display:grid;grid-template-columns:1fr 1fr;gap:52px;padding-top:10px;text-align:left;font-size:9px}
  .estimation-report .signature-space {height:35px}
  .estimation-report .signature-line {display:block;border-bottom:1px solid #333;text-align:center;padding-bottom:3px}
  .estimation-report .template-signatures small {text-align:center;font-style:italic}
  .estimation-report .client-signature {text-align:center;padding-top:13px}
  .estimation-report .client-signature b,.estimation-report .client-signature span {display:block;margin-top:4px;font-size:8px}
  .estimation-report .template-confirmation {padding-top:10px;border:0;text-align:center}
  .estimation-report .template-confirmation h2 {background:#103861;color:#fff;border-color:#103861;padding:10px;letter-spacing:0}
  .estimation-report .template-confirmation p {font-size:8px;color:#103861;font-weight:700;margin:9px 22px}
  .estimation-report h2.navy-heading {background:#173b67;color:#fff;border-color:#173b67}
  .estimation-report .gantt th {background:#173b67;color:#fff;font-size:8px}
  .estimation-report .gantt td {border-color:#c6d3e3;font-size:8px;height:24px;padding:4px 8px}
  .estimation-report .gantt tbody tr:nth-child(odd) {background:#f5f7fa}
  .estimation-report .gantt .timeline-group td {background:#e1e7ee;color:#173b67;font-weight:700;height:22px}
  .estimation-report .gantt td.week-cell {padding:4px 0}
  .estimation-report .gantt-bar {display:block;height:13px;border-radius:2px;margin:0 1px}
  .estimation-report .milestone {display:block;width:9px;height:9px;margin:auto;transform:rotate(45deg)}
  .estimation-report .legend {display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#173b67;font-size:7px}
  .estimation-report .footnote {font-size:7px;color:#50657d}
  .estimation-report .milestones td {font-size:8px}
  .estimation-report .scope-notes {padding:6px 10px;border:1px solid #333}
  .estimation-report .scope-notes p {margin:4px 0}
  .estimation-report .contents-list li {display:flex;gap:8px}
  .estimation-report .toc-page {margin-left:auto}
  .estimation-report .client-masthead {height:146px;background-color:#fff;background-size:100% 100%;background-position:center;display:flex;align-items:center;justify-content:space-between;padding:8px 38px}
  .estimation-report .client-masthead img {display:block;width:260px;height:auto;flex-shrink:0}
  .estimation-report .client-masthead>div {width:300px;color:#fff;font-size:8px;line-height:1.6}
  .estimation-report .client-details-sheet .draft-notice {border:1px solid #f01430;padding:8px 10px;text-align:center;color:#e60012;font-size:8px;font-weight:700;text-transform:uppercase}
  .estimation-report .client-details-sheet .proposal-meta {display:flex;justify-content:space-between;margin-bottom:10px;padding:6px 0;font-size:9px}
  .estimation-report .client-details-sheet .proposal-meta span {border:0;min-width:0;margin-left:3px;padding:0}
  .estimation-report .client-details-sheet .client-box {padding:8px;margin-bottom:12px}
  .estimation-report .client-details-sheet .client-grid {column-gap:8px;row-gap:7px}
  .estimation-report .client-details-sheet .client-field {grid-template-columns:86px 1fr;gap:4px;min-height:16px}
  .estimation-report .client-details-sheet .client-field b {font-size:7px;color:#8a5700}
  .estimation-report .client-details-sheet .client-field span {border-bottom:1px solid #a6bad5;font-size:9px;padding:0 2px 2px;font-weight:400}
  .estimation-report .client-details-sheet .proposal-intro {font-size:8px;margin:10px 0 14px;color:#103861;line-height:1.35}
  .estimation-report .template-contents h2 {background:#103861;border-color:#103861;color:#fff;padding:5px;font-size:10px}
  .estimation-report .template-contents .contents-list {margin:4px 0 0}
  .estimation-report .template-contents li {align-items:baseline;padding:10px 7px;border:0;gap:5px;font-size:10px;font-weight:700}
  .estimation-report .template-contents li span {max-width:91%}
  .estimation-report .template-contents li i {flex:1;border-bottom:1px dotted #173b67;min-width:12px}
  .estimation-report .template-contents li.toc-subitem {padding-left:28px;font-size:8px;font-weight:400}
  .estimation-report .timeline-example-notice {padding:8px 10px;border:1px solid #8d9cb0;background:#f2f5f9;color:#173b67;font-size:9px}
  .estimation-report .template-overview td {padding:5px 7px;font-size:9px}
  .estimation-report .overview-label {background:#e1e7ee;font-weight:700}
  .estimation-report .template-overview small {display:inline;font-size:8px;margin-left:8px;color:#111}
  .estimation-report .selected-system {color:#d33e13;white-space:nowrap}
  .estimation-report .overview-plan {height:430px;margin:8px 0 4px;position:relative}
  .estimation-report .overview-plan:before {content:'';position:absolute;inset:50px;border:1px solid #b2c4dd;pointer-events:none}
  .estimation-report .overview-plan>div {position:relative}
  .estimation-report .overview-floor-plan>small {font-size:7px;font-style:italic}
`;
export const sectionColor = (name: string): string => name === 'FDAS' ? '#db5018' : name === 'Shared Project Items' ? '#687a90' : '#216eb1';
const cable = (item: EstimationConsumableEntry): boolean => /cable|wire|utp|fiber|fibre/i.test(`${item.category} ${item.name}`) && !/cable tray|cable tie|cable clip/i.test(item.name);
const rough = (item: EstimationConsumableEntry): boolean => /rough|conduit|pipe|pvc|trunk|junction|mount|bracket|fastener|anchor|clamp|tape|connector|label|cable tray|cable tie/i.test(`${item.category} ${item.name}`);
export interface ProposalSection { name: string; manpower: EstimationManpowerEntry[]; materials: EstimationConsumableEntry[]; fees: EstimationAdditionalFeeEntry[] }

export function groupProposalSections(systems: string[], manpower: EstimationManpowerEntry[], materials: EstimationConsumableEntry[], fees: EstimationAdditionalFeeEntry[]): ProposalSection[] {
  const normalize = (value: string): string => value.replace(/_/g, ' ').toUpperCase().replace(/FIRE ALARM/g, 'FDAS');
  const tagged = materials.some(row => row.surveyId || row.systemLabel || row.systemType);
  const names = [...new Set(materials.filter(row => row.surveyId || row.systemLabel || row.systemType).map(row => normalize(row.systemLabel || row.systemType || 'Other')))];
  systems.forEach(name => { if (!names.some(label => label === name || label.startsWith(`${name} `))) names.push(name); });
  const sections = (names.length ? names : ['Project Requirements']).map(name => ({ name, manpower: [] as EstimationManpowerEntry[], materials: [] as EstimationConsumableEntry[], fees: [] as EstimationAdditionalFeeEntry[] }));
  const shared: ProposalSection = { name: 'Shared Project Items', manpower: [], materials: [], fees: [] };
  const patterns: Record<string, RegExp> = { CCTV: /\bCCTV\b|camera|\bNVR\b|\bDVR\b/i, FDAS: /\bFDAS\b|fire alarm|smoke detector|heat detector|horn.?strobe|manual (call|pull)|\bFACP\b/i, 'ACCESS CONTROL': /access control|biometric|RFID|electromagnetic lock|exit button/i, 'BURGLAR ALARM': /burglar|intrusion|\bPIR\b|glass.?break/i, 'FIRE PROTECTION': /suppression|FM.?200|extinguisher/i };
  const target = (text: string): ProposalSection => {
    if (sections.length === 1) return sections[0];
    const matches = sections.filter(section => patterns[section.name]?.test(text));
    return matches.length === 1 ? matches[0] : shared;
  };
  manpower.forEach(row => target(row.role).manpower.push(row));
  materials.forEach(row => {
    const label = row.systemLabel || row.systemType;
    const destination = row.surveyId || label
      ? sections.find(section => section.name === normalize(label || 'Other')) || shared
      : tagged && sections.length > 1 ? shared : target(`${row.name} ${row.category} ${row.notes || ''}`);
    destination.materials.push(row);
  });
  fees.forEach(row => target(`${row.type} ${row.description} ${row.notes || ''}`).fees.push(row));
  if (shared.manpower.length || shared.materials.length || shared.fees.length) sections.push(shared);
  return sections;
}

const cols = (priced: boolean, model: boolean): string => `<colgroup><col style="width:6%">${model ? '<col style="width:18%"><col>' : '<col>'}<col style="width:9%">${model ? '' : '<col style="width:11%">'}${priced ? '<col style="width:15%"><col style="width:15%">' : ''}</colgroup>`;
const table = (title: string, headers: string[], rows: string, priced: boolean, model = false): string => `<section class="report-section proposal-table"><h2>${esc(title)}</h2><table>${cols(priced, model)}<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td class="empty" colspan="${headers.length}">NONE</td></tr>`}</tbody></table></section>`;
const headers = (priced: boolean, model = false): string[] => ['ITEM', ...(model ? ['MODEL'] : []), 'DESCRIPTION', 'QTY.', ...(model ? [] : ['UNIT']), ...(priced ? ['UNIT PRICE', 'TOTAL PRICE'] : [])];
const subtotal = (label: string, value: number, priced: boolean): string => priced ? `<tr class="group-subtotal"><td colspan="5">SUB. TOTAL (${esc(label)}):</td><td class="number">${money(value)}</td></tr>` : '';
const materialsTotal = (items: EstimationConsumableEntry[]): number => computeEstimationStats([], items).totalMaterials;
export const sectionAmounts = (section: ProposalSection): number[] => [computeEstimationStats([], [], section.fees).totalFees, computeEstimationStats(section.manpower, []).totalLabor, materialsTotal(section.materials.filter(item => !cable(item) && !rough(item))), materialsTotal(section.materials.filter(item => !cable(item) && rough(item))), materialsTotal(section.materials.filter(cable))];

export function renderProposalSystem(section: ProposalSection, index: number, priced: boolean): string {
  const materialTable = (title: string, items: EstimationConsumableEntry[]): string => {
    const groups = new Map<string, EstimationConsumableEntry[]>();
    items.forEach(item => { const key = item.brand || (title.startsWith('C.') ? 'DEVICES & EQUIPMENT' : ''); groups.set(key, [...(groups.get(key) || []), item]); });
    let count = 0;
    const rows = [...groups].map(([brand, entries]) => `${brand ? `<tr class="brand-row"><td colspan="${priced ? 6 : 4}">${esc(brand)}</td></tr>` : ''}${entries.map(item => `<tr><td class="center">${++count}</td><td class="center">${esc(item.productId || '—')}</td><td>${esc(item.name)}${item.notes ? `<small>${esc(item.notes)}</small>` : ''}</td><td class="center">${item.quantity} ${esc(item.unit || 'pcs')}</td>${priced ? `<td class="number">${item.unitPrice == null ? 'Not priced' : money(item.unitPrice)}</td><td class="number strong">${money(materialLineTotal(item))}</td>` : ''}</tr>`).join('')}${subtotal(brand || title.slice(3), materialsTotal(entries), priced)}`).join('');
    return table(title, headers(priced, true), rows, priced, true);
  };
  const totals = computeEstimationStats(section.manpower, section.materials, section.fees);
  const feeRows = section.fees.map((fee, i) => `<tr><td class="center">${i + 1}</td><td>${esc(fee.description || fee.type)}${fee.notes ? `<small>${esc(fee.notes)}</small>` : ''}</td><td class="center">1</td><td class="center">LOT</td>${priced ? `<td class="number">${money(fee.amount || 0)}</td><td class="number strong">${money(fee.amount || 0)}</td>` : ''}</tr>`).join('');
  const laborRows = section.manpower.map((row, i) => `<tr><td class="center">${i + 1}</td><td><b>${esc(row.role)}</b><small>${row.headcount} pax · ${row.hours} hrs</small></td><td class="center">${row.manDays}</td><td class="center">MAN-DAY</td>${priced ? `<td class="number">${row.dayRate == null ? 'Not recorded' : money(row.dayRate)}</td><td class="number strong">${money(laborLineTotal(row))}</td>` : ''}</tr>`).join('');
  return `<div class="section-heading" style="background:${sectionColor(section.name)}" data-report-anchor="system-${index}">SECTION ${index + 1} — ${esc(section.name === 'FDAS' ? 'FDAS (FIRE DETECTION & ALARM SYSTEM)' : section.name)}</div>
    ${section.name === 'Shared Project Items' ? '<p class="compact-note">Project-wide items are counted once; no per-system allocation is recorded.</p>' : `<div class="layout-block"><h3>${index + 1}.1 ${esc(section.name)} DEVICE LAYOUT</h3><div class="plan-grid"><div><b>CLIENT FLOOR PLAN — ${esc(section.name)} LAYOUT</b><br>Original plan and verified device positions are not embedded in this report.<br>Refer to the source project attachments.</div></div><small>Device positions require an approved client plan before installation.</small></div>`}
    ${table('A. General Requirements', headers(priced), feeRows + (feeRows ? subtotal('GENERAL REQUIREMENTS', totals.totalFees, priced) : ''), priced)}
    ${table('B. Scope of Works (Installation Labor)', headers(priced), laborRows + (laborRows ? subtotal(`INSTALLATION LABOR — ${section.name}`, totals.totalLabor, priced) : ''), priced)}
    ${materialTable('C. Active Components', section.materials.filter(item => !cable(item) && !rough(item)))}
    ${materialTable('D. Roughing-Ins Materials', section.materials.filter(item => !cable(item) && rough(item)))}
    ${materialTable('E. Cable Components', section.materials.filter(cable))}
    ${priced ? `<div class="section-total"><b>TOTAL — ${esc(section.name)} SECTION (VAT EXCLUSIVE)</b><b>${money(totals.subtotal)}</b></div>` : ''}`;
}

export function renderProposalCosts(sections: ProposalSection[], priced: boolean): string {
  if (!priced) return '<p class="restricted-note">Commercial rates and totals are intentionally omitted for this user role.</p>';
  const totals = computeEstimationStats(sections.flatMap(s => s.manpower), sections.flatMap(s => s.materials), sections.flatMap(s => s.fees));
  const rows = sections.map((section, index) => {
    const values = sectionAmounts(section);
    return `<tr class="cost-system" style="background:${sectionColor(section.name)}"><td colspan="6">SECTION ${index + 1} — ${esc(section.name)}</td></tr>${['GENERAL REQUIREMENTS', 'SCOPE OF WORKS (INSTALLATION LABOR)', 'ACTIVE COMPONENTS', 'ROUGHING INS MATERIAL', 'CABLE COMPONENT'].map((name, i) => `<tr><td class="center">${'ABCDE'[i]}</td><td class="strong">${name}</td><td class="center">${values[i] ? 1 : '—'}</td><td class="center">${values[i] ? 'LOT' : '—'}</td><td class="number">${values[i] ? money(values[i]) : '—'}</td><td class="number strong">${money(values[i])}</td></tr>`).join('')}`;
  }).join('');
  return table('F. Breakdown of Cost', headers(true), `${rows}<tr class="summary-row"><td colspan="5">SUB. TOTAL:</td><td class="number strong">${money(totals.subtotal)}</td></tr><tr class="summary-row discount"><td colspan="5">LESS DISCOUNT:</td><td class="number">${money(0)}</td></tr><tr class="summary-row vat"><td colspan="5">ADD 12% VAT:</td><td class="number">${money(totals.vat)}</td></tr><tr class="summary-row total"><td colspan="5">TOTAL AMOUNT:</td><td class="number strong">${money(totals.grandTotal)}</td></tr>`, true);
}

export function renderProposalTimeline(systems: string[]): string {
  const rows: string[] = [];
  const group = (name: string): void => { rows.push(`<tr class="timeline-group"><td colspan="9">${esc(name)}</td></tr>`); };
  const phase = (name: string, start: number, end: number, color: string, milestone = false): void => {
    rows.push(`<tr><td>${esc(name)}</td>${Array.from({ length: 8 }, (_, i) => `<td class="week-cell">${i + 1 >= start && i + 1 <= end ? `<span class="${milestone ? 'milestone' : 'gantt-bar'}" style="background:${color}"></span>` : ''}</td>`).join('')}</tr>`);
  };
  group('PROJECT-WIDE');
  phase('Site survey & floor plan verification', 1, 1, '#173b67');
  phase('Final design & BOQ confirmation', 1, 1, '#173b67');
  phase('Procurement / delivery of devices', 2, 3, '#718097');
  systems.forEach((name, i) => {
    group(`${i + 1} — ${name}`);
    phase('Roughing-ins & conduit works', 3, 4, sectionColor(name));
    phase('Cable pulling & termination', 4, 5, sectionColor(name));
    phase(name === 'FDAS' ? 'Panel, detectors & devices installation' : 'Device mounting & system configuration', 5, 6, sectionColor(name));
    if (name === 'FDAS') phase('Permits / inspection (if required)', 7, 7, sectionColor(name));
  });
  group('PROJECT CLOSE-OUT');
  phase('Testing & commissioning', 7, 7, '#173b67');
  phase('Client training & documentation', 8, 8, '#173b67');
  phase('Turnover & client acceptance', 8, 8, '#e11d48', true);
  return `<div class="timeline-intro"><h2 class="navy-heading">Project Timeline — Illustrative Only</h2><p class="timeline-example-notice"><b>Template example only: this eight-week chart is not calculated from this project's quantities, manpower or confirmed availability.</b> Actual phase durations, delivery dates and turnover targets must be prepared and approved for the project. The chart below shows the proposed sequence of work only.</p></div>
    <section class="report-section timeline-block"><table class="gantt"><colgroup><col style="width:39%">${'<col style="width:7.625%">'.repeat(8)}</colgroup><thead><tr><th>PHASE / ACTIVITY</th>${Array.from({ length: 8 }, (_, i) => `<th>WK ${i + 1}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></section>
    <div class="legend"><span>■ Project-wide</span><span style="color:#718097">■ Procurement</span>${systems.map(name => `<span style="color:${sectionColor(name)}">■ ${esc(name)}</span>`).join('')}<span style="color:#e11d48">◆ Milestone</span></div>
    <section class="report-section milestones" data-report-anchor="milestones"><h3>Key milestones &amp; payment schedule</h3><table><colgroup><col style="width:46%"><col style="width:14%"><col></colgroup><thead><tr><th>MILESTONE</th><th>EXAMPLE*</th><th>PAYMENT TRIGGER</th></tr></thead><tbody><tr><td>Proposal accepted — P.O. &amp; down payment received</td><td class="center">Week 0</td><td>50% down payment (devices and labor)</td></tr><tr><td>Devices delivered / picked up</td><td class="center">Week 2–3</td><td>50% balance of devices</td></tr><tr><td>Installation, testing &amp; turnover complete</td><td class="center">Week 8</td><td>50% balance of labor</td></tr></tbody></table></section><p class="footnote">*Illustrative weeks only; actual dates are to be confirmed. Template availability: 2–4 working days for stock items, 12–16 weeks for pre-orders, subject to supplier confirmation.</p>`;
}

export function renderProposalTerms(estimator: string): string {
  const terms = [
    'Unless specified, above given prices are VAT EXCLUDED. The cost breakdown total includes 12% VAT.',
    'Prices are based on cost and conditions existing on date of quotation and are SUBJECT TO CHANGE BY THE SELLER UPON FINAL ACCEPTANCE.',
    'Others: Any other materials/equipment/permits/installation/bonds works not stated herein shall be considered as ADDITIONAL COST.',
    'Warehouse Charges/Penalties: There will be a 500 pesos penalty per day, if devices are not picked up upon notice of availability.',
    'A penalty charge of 40% of the total contract price will be imposed for cancellation of Purchase Order.',
    'LATE PAYMENT PENALTY CHARGE: Any payments not made within the specified period of time will incur an interest charge at the rate of 1% of the total contract/P.O. price.',
    'Delivery: For client charge or Pick up by Client. (For Supply Only)',
  ];
  return `<section class="report-section terms-table"><h2>Terms and Conditions</h2><table><colgroup><col style="width:6%"><col></colgroup><tbody>${terms.map((text, i) => `<tr><td class="center">${i + 1}</td><td>${esc(text)}</td></tr>`).join('')}</tbody></table></section>
    <section class="commercial-terms"><div><b>PAYMENT TERMS:</b><p>SUPPLY OF DEVICES: &nbsp; 50% DOWNPAYMENT; 50% UPON PICK UP/DELIVERY OF THE ITEMS.<br>SUPPLY OF LABOR: &nbsp; &nbsp; 50% DOWNPAYMENT; 50% UPON COMPLETION.</p></div><div><b>PAYMENT DETAILS:</b><p>BANK DEPOSIT PAYMENT (BDO ACCOUNT NUMBER: 006930089663)<br>CHECK PAYMENT MUST BE NAMED UNDER AA2000 SECURITY AND TECHNOLOGY SOLUTION INC.</p></div><div><b>WARRANTY PERIOD:</b><p>• PRODUCT WARRANTY: 1 YEAR<br>• 7 DAYS REPLACEMENT AGAINST FACTORY DEFECTS.</p></div><div><b>AVAILABILITY:</b><p>2–4 WORKING DAYS IF ON STOCK UPON RECEIPT OF P.O. AND DOWNPAYMENT.<br>12–16 WEEKS IF NO STOCK/PRE-ORDER BASIS.<br><em>NOTE:</em> STOCKS OF GOODS ARE SUBJECT FOR CONFIRMATION UPON ORDER.</p></div></section>
    <div class="signatures template-signatures"><div><b>PREPARED BY:</b><div class="signature-space"></div><strong class="signature-line">${esc(estimator)}</strong><small>Project Estimator</small></div><div class="client-signature"><strong class="signature-line">CLIENT REPRESENTATIVE</strong><b>CLIENT CONFORME</b><small>Signature over Printed Name</small><span>Date: ______________</span></div></div>
    <section class="confirmation template-confirmation"><h2>Confirmation</h2><p>THIS PROPOSAL WILL BE REGARDED AS AN ORDER CONFIRMATION UPON ACCEPTANCE. KINDLY ACKNOWLEDGE WITH YOUR SIGNATURE ACCOMPANIED BY A PURCHASE ORDER AND/OR COMPANY STAMP. THANK YOU FOR YOUR TRUST AND CONFIDENCE.</p></section>`;
}

export function renderProposalRemarks(): string {
  const remarks = ['Any additional services and materials that are not included in this quotation.', 'Any additional civil and engineering works; signed and sealed by professional engineer.', 'Insurance policy or bonds.', 'Scaffolding rental, delivery and pullout — if required.', 'Professional project assistance (safety officer) — when not included above.', 'COVID-19 related requirements, if applicable.'];
  return `<section class="report-section template-remarks" data-report-anchor="remarks"><h2>Note and Remarks: All Indicated Below Shall Be Billed Separately</h2><ol>${remarks.map(text => `<li>${esc(text)}</li>`).join('')}</ol></section>`;
}
