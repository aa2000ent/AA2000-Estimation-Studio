import { groupProposalSections, renderProposalSystem, renderProposalCosts, renderProposalTimeline, renderProposalTerms, renderProposalRemarks, proposalTemplateCss } from './estimationProposalSections';
import type { Project, User } from '../App';
import type {
  EstimationAdditionalFeeEntry,
  EstimationConsumableEntry,
  EstimationManpowerEntry,
} from '../types';
import type { ScopeOfWorkEntry, QuotationHeaderState } from '../components/estimation/QuotationModal';
import { computeEstimationStats, computeEstimationTotals, materialLineTotal, roundMoney, type EstimationTotals } from '../services/estimationStats';

interface ReportTotals {
  totalLabor: number;
  totalMaterials: number;
  totalFees: number;
}
export interface StandardEstimationReportInput {
  project: Project;
  user: User | null;
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks: ScopeOfWorkEntry[];
  constraints: { physical?: string; electrical?: string; installation?: string };
  technicianNotes: string;
  totals: ReportTotals | EstimationTotals;
  showPrices: boolean;
  headerBackgroundUrl: string;
  logoUrl: string;
  hasUnsavedChanges?: boolean;
  isDraft?: boolean;
  header?: Partial<QuotationHeaderState>;
}

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

// Measure real content before html2pdf captures it. Long tables continue on a
// new sheet with their title/column headers, while each sheet repeats the brand.
export function prepareEstimationReportLayout(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.logical-sheet').forEach(sheet => {
    if (sheet.dataset.paginated) return;
    sheet.dataset.paginated = 'true';
    const header = sheet.querySelector('.compact-page-header, .client-masthead');
    const blocks = Array.from(sheet.children).filter(child => child !== header) as HTMLElement[];
    let content = document.createElement('div');
    content.className = 'sheet-content';
    blocks.forEach(block => block.remove());
    sheet.appendChild(content);
    let current = sheet;
    const maxContentHeight = 1013 - (header?.getBoundingClientRect().height || 38);
    const fits = (): boolean => content.getBoundingClientRect().height <= maxContentHeight;
    const next = (): void => {
      const copy = sheet.cloneNode(false) as HTMLElement;
      copy.dataset.paginated = 'true';
      if (header) copy.appendChild(header.cloneNode(true));
      content = document.createElement('div');
      content.className = 'sheet-content';
      copy.appendChild(content);
      current.after(copy);
      current = copy;
    };
    blocks.forEach(block => {
      content.appendChild(block);
      if (fits()) return;
      block.remove();
      const sourceBody = block.querySelector('tbody');
      // A large table uses the remaining space instead of moving as one block.
      if (sourceBody) {
        content.appendChild(block);
        const fullHeight = block.getBoundingClientRect().height;
        block.remove();
        if (fullHeight > 450) {
          const rows = Array.from(sourceBody.children) as HTMLElement[];
          sourceBody.replaceChildren();
          content.appendChild(block);
          let fragment = block;
          let body = sourceBody;
          for (const row of rows) {
            body.appendChild(row);
            if (fits()) continue;
            row.remove();
            const carry: HTMLElement[] = [];
            if (row.classList.contains('group-subtotal') || body.lastElementChild?.classList.contains('brand-row') || body.lastElementChild?.classList.contains('cost-system') || body.lastElementChild?.classList.contains('timeline-group')) {
              const previous = body.lastElementChild as HTMLElement | null;
              if (previous) { carry.push(previous); previous.remove(); }
            }
            if (!body.children.length) fragment.remove();
            next();
            fragment = block.cloneNode(true) as HTMLElement;
            body = fragment.querySelector('tbody')!;
            body.replaceChildren(...carry, row);
            const title = fragment.querySelector('h2');
            if (title) title.textContent = `${block.querySelector('h2')?.textContent || ''} — CONTINUED`;
            content.appendChild(fragment);
          }
          return;
        }
      }
      if (content.children.length) next();
      content.appendChild(block);
    });
  });
  const sheets = Array.from(container.querySelectorAll('.logical-sheet'));
  container.querySelectorAll<HTMLElement>('[data-toc-target]').forEach(entry => {
    const target = Array.from(container.querySelectorAll<HTMLElement>('[data-report-anchor]')).find(node => node.dataset.reportAnchor === entry.dataset.tocTarget);
    const sheet = target?.closest('.logical-sheet');
    if (sheet) entry.textContent = String(sheets.indexOf(sheet) + 2);
  });
}

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
    group.subtotal = roundMoney(group.subtotal + materialLineTotal(item));
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


export function buildStandardEstimationReportHtml(input: StandardEstimationReportInput): string {
  const header = input.header;
  if (header) {
    input = { ...input, project: { ...input.project,
      name: header.projectTitle?.trim() || input.project.name,
      clientName: header.company?.trim() || input.project.clientName,
      clientContactName: header.attentionTo?.trim() || input.project.clientContactName,
      clientEmail: header.emailAdd?.trim() || input.project.clientEmail,
      clientPhone: header.contactNo?.trim() || input.project.clientPhone,
      location: header.projectSite?.trim() || input.project.location,
    } };
  }
  const {
    project,
    user,
    manpower,
    consumables,
    fees,
    scopeOfWorks,
    constraints,
    technicianNotes,
    showPrices,
    headerBackgroundUrl,
    logoUrl,
  } = input;

  const generatedAt = new Date();
  const dateLabel = header?.quoteDate?.trim() || generatedAt.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila',
  });
  const projectKey = String(project.dbProjId || project.id || 'DRAFT')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-8)
    .toUpperCase() || 'DRAFT';
  const reference = header?.referenceCode?.trim() || `EST-${generatedAt.getFullYear()}-${projectKey}`;
  const scopeSystems = scopeOfWorks.flatMap(item => {
    const match = item.description.match(/^\s*Systems?\s*:\s*(.+)$/im);
    return match ? match[1].split(/[,;|]/).map(value => value.trim()).filter(Boolean) : [];
  });
  const systems = [...new Set((project.systemTypes?.length ? project.systemTypes : scopeSystems).map(normalizedSystem))];
  const systemLabel = systems.length ? systems.join(', ') : 'Not specified';
  const proposalSections = groupProposalSections(systems, manpower, consumables, fees);
  if ('materialsTotal' in input.totals) {
    const actual = computeEstimationTotals(manpower, consumables, fees);
    for (const key of Object.keys(actual) as (keyof EstimationTotals)[]) {
      if (Math.abs(actual[key] - input.totals[key]) > 0.005) throw new Error('Report amounts do not match the estimation total.');
    }
  }
  const pageHeader = `<header class="compact-page-header"><b>AA2000 SECURITY AND TECHNOLOGY SOLUTIONS INC. &nbsp;|&nbsp; PROJECT PROPOSAL</b><span>REF: ${escapeHtml(reference)} &nbsp; | &nbsp; ${display(project.name)}</span></header>`;
  const preparedBy = project.technicianName || user?.fullName || 'Assigned Technician';

  const recordedScope = scopeOfWorks.map(row => row.description).join('\n');
  const floorArea = project.totalFloorArea ?? recordedScope.match(/([\d,.]+)\s*(?:sq\.?\s*m\.?|sqm|m²)/i)?.[1];
  const rooms = project.rooms ?? recordedScope.match(/(\d+)\s*rooms?\b/i)?.[1];
  const projectSummary = project.surveyScope || scopeOfWorks.find(row => /^\s*Scope\s*:/i.test(row.description))?.description.replace(/^\s*Scope\s*:\s*/i, '') || project.name;
  const sectionAmountsHtml = proposalSections.map((section, index) => {
    const amount = computeEstimationStats(section.manpower, section.materials, section.fees).subtotal;
    return `Section ${index + 1} — ${escapeHtml(section.name)}${showPrices ? `: <b>PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>` : ''}`;
  }).join(' &nbsp; | &nbsp; ');
  const siteConditions = [
    ['Physical Constraints', constraints.physical],
    ['Electrical Constraints', constraints.electrical],
    ['Installation / Cabling Constraints', constraints.installation],
    ['Technician Notes', technicianNotes],
  ].filter(([, value]) => value?.trim());

  return `
    <style>
      .estimation-report, .estimation-report * { box-sizing: border-box; }
      .proposal-cover { height: 1050px; padding: 70px 52px 44px; position: relative; overflow: hidden; page-break-after: always; background: #fff; }
      .cover-brand { display: flex; align-items: center; gap: 16px; height: 60px; color: #00529b; font-size: 10px; font-weight: bold; line-height: 1.35; position: relative; }
      .cover-logo { display: block; width: 104px; height: 46px; overflow: hidden; flex-shrink: 0; }
      .cover-logo img { display: block; width: 104px; height: auto; }
      .cover-wave { position: absolute; right: -110px; top: -160px; width: 480px; height: 390px; border: 35px double #9bc5ed; border-radius: 50%; transform: rotate(30deg); }
      .proposal-cover h1 { margin: 170px 0 24px; font-size: 72px; line-height: 1.05; letter-spacing: 7px; color: #050505; }
      .cover-title { color: #0068c9; font-size: 23px; letter-spacing: 2px; text-transform: uppercase; overflow-wrap: anywhere; }
      .cover-subtitle { margin-top: 12px; color: #64748b; font-size: 12px; }
      .cover-author { position: absolute; bottom: 44px; left: 46px; right: 46px; padding: 30px; border-radius: 20px; background: linear-gradient(110deg, #e7f1fb, #0060bc); color: #fff; text-align: right; font-size: 12px; line-height: 1.8; }
      .proposal-page { page-break-before: auto; }
      .contents-list { margin: 14px 0 0; padding: 0; list-style: none; }
      .contents-list li { padding: 12px 8px; border-bottom: 1px dotted #94a3b8; font-size: 11px; }
      .plan-placeholder { margin: 10px; padding: 12px; border: 1px dashed #94a3b8; background: #f8fafc; color: #64748b; text-align: center; font-size: 10px; }
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
      .pdf-keep, .empty-section, .totals-section, .summary-strip { break-inside: avoid-page; page-break-inside: avoid; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 5px 6px; border-right: 1px solid #111; border-bottom: 1px solid #aab1bb; vertical-align: top; overflow-wrap: anywhere; }
      th:last-child, td:last-child { border-right: 0; }
      tbody tr:last-child td { border-bottom: 0; }
      th { background: #d9dee5; color: #111; border-bottom: 1px solid #111; font-size: 7px; font-weight: 900; text-align: left; text-transform: uppercase; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      .label { width: 17%; color: #111; background: #eef1f4 !important; font-weight: 900; text-transform: uppercase; font-size: 7px; }
      .center { text-align: center; }
      .number { text-align: right; white-space: nowrap; font-size: 7px; }
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
      ${proposalTemplateCss}
    </style>
    <div class="estimation-report">
      <div class="proposal-cover">
        <div class="cover-wave"></div>
        <div class="cover-brand"><div class="cover-logo"><img src="${escapeHtml(logoUrl)}" alt="AA2000"></div><span>SECURITY AND TECHNOLOGY<br>SOLUTIONS INC.</span></div>
        <h1>Project<br>Proposal</h1>
        <div class="cover-title">${display(project.name)}</div>
        <div class="cover-subtitle">Estimation Report | ${escapeHtml(systemLabel)} | Prepared for ${display(project.clientName)}</div>
        <div class="cover-author"><b>${display(preparedBy)}</b><br>Project Estimator, AA2000<br>REF: ${escapeHtml(reference)} | ${escapeHtml(dateLabel)}</div>
      </div>
      <main class="report-body">
        <div class="logical-sheet client-details-sheet">
        <header class="client-masthead" style="background-image:url('${escapeHtml(headerBackgroundUrl)}')">
          <img src="${escapeHtml(logoUrl)}" alt="AA2000 Security and Technology Solutions Inc.">
          <div><b>AA2000 SECURITY AND TECHNOLOGY SOLUTIONS INC.</b><br>Unit 2-C Norkis Building, Mandaluyong City<br>T: (02) 8571-5693</div>
        </header>
        ${input.hasUnsavedChanges || input.isDraft ? '<p class="draft-notice draft-banner">DRAFT — Contains unsaved changes; figures may differ from the saved estimation.</p>' : ''}
        <div class="proposal-meta">
          <div>Validity:<span>${display(header?.validityPeriod, '30 Days')}</span></div>
          <div>Ref:<span>${escapeHtml(reference)}</span></div>
          <div>Date:<span>${escapeHtml(dateLabel)}</span></div>
        </div>

        <div class="client-box">
          <div class="client-grid">
            <div class="client-field"><b>Attention To:</b><span>${display(project.clientContactName)}</span></div>
            <div class="client-field"><b>Position:</b><span>${display(header?.thru)}</span></div>
            <div class="client-field"><b>Company:</b><span>${display(project.clientName)}</span></div>
            <div class="client-field"><b>Tel./Mobile No.:</b><span>${display(project.clientPhone)}</span></div>
            <div class="client-field"><b>Email:</b><span>${display(project.clientEmail)}</span></div>
            <div class="client-field"><b>Site Address:</b><span>${display(header?.address, project.location)}</span></div>
            <div class="client-field"><b>Project For:</b><span>${display(project.name)}</span></div>
            <div class="client-field"><b>Project Site:</b><span>${display(project.location)}</span></div>
          </div>
        </div>

        <p class="proposal-intro">We respectfully submit our project estimation proposal for your requirements. We look forward to the approval of our proposed project scope and cost, as follows:</p>

        <section class="report-section compact-section template-contents">
          <h2>Table of Contents</h2>
          <ol class="contents-list">
            <li><span>Project Overview &amp; Client Floor Plan</span><i></i><b class="toc-page" data-toc-target="overview"></b></li>
            ${proposalSections.map((section, index) => `<li><span>Section ${index + 1} — ${escapeHtml(section.name === 'FDAS' ? 'FDAS (FIRE DETECTION & ALARM SYSTEM)' : section.name)}</span><i></i><b class="toc-page" data-toc-target="system-${index}"></b></li>`).join('')}
            <li><span>Project Timeline (Illustrative)</span><i></i><b class="toc-page" data-toc-target="timeline"></b></li>
            <li class="toc-subitem"><span>Key Milestones &amp; Payment Schedule</span><i></i><b class="toc-page" data-toc-target="milestones"></b></li>
            ${showPrices ? '<li><span>F. Breakdown of Cost</span><i></i><b class="toc-page" data-toc-target="cost"></b></li>' : ''}
            <li class="toc-subitem"><span>Notes and Remarks</span><i></i><b class="toc-page" data-toc-target="remarks"></b></li>
            <li><span>Terms &amp; Conditions, Payment, Warranty and Signatures</span><i></i><b class="toc-page" data-toc-target="terms"></b></li>
          </ol>
        </section>

        </div><div class="logical-sheet" data-report-anchor="overview">${pageHeader}
        <section class="report-section template-overview">
          <h2>Project Overview</h2>
          <table><colgroup><col style="width:20%"><col></colgroup><tbody>
            <tr><td class="overview-label">Project summary</td><td>${multiline(projectSummary)}</td></tr>
            <tr><td class="overview-label">Systems covered</td><td>${systems.map(system => `<b class="selected-system">[x] ${escapeHtml(system)}</b>`).join(' &nbsp; ')} <small>Selected systems are included in this proposal.</small></td></tr>
            <tr><td class="overview-label">Floor area / levels</td><td>${display(floorArea)}${floorArea != null ? ' sq.m.' : ''} &nbsp; | &nbsp; ${display(project.floors)} floor(s) &nbsp; | &nbsp; ${display(rooms)} rooms / areas</td></tr>
            <tr><td class="overview-label">Estimated duration</td><td>To be confirmed from approved scope, manpower and availability. See illustrative Project Timeline.</td></tr>
            <tr><td class="overview-label">Sections &amp; amounts</td><td>${sectionAmountsHtml}${showPrices ? ' &nbsp; | &nbsp; VAT exclusive; see Breakdown of Cost.' : ''}</td></tr>
          </tbody></table>
        </section>
        <section class="report-section overview-floor-plan">
          <h2>Client Floor Plan (As Submitted)</h2>
          <div class="plan-grid overview-plan"><div><b>CLIENT FLOOR PLAN — AS RECEIVED</b><br>Original client plan is not embedded in this report.<br>Refer to the source project attachments.</div></div>
          <small>Device layouts require a verified client plan. No device positions are assumed.</small>
        </section>
        ${siteConditions.length ? `<section class="report-section overview-site-conditions"><h2>Site Conditions &amp; Technician Notes</h2><table><colgroup><col style="width:28%"><col></colgroup><tbody>${siteConditions.map(([label, value]) => `<tr><td class="overview-label">${escapeHtml(label)}</td><td>${multiline(value)}</td></tr>`).join('')}</tbody></table></section>` : ''}

        </div>
        ${proposalSections.map((section, index) => `<div class="logical-sheet">${pageHeader}${renderProposalSystem(section, index, showPrices)}</div>`).join('')}
        <div class="logical-sheet" data-report-anchor="timeline">${pageHeader}${renderProposalTimeline(systems.length ? systems : ['Project Requirements'])}</div>
        <div class="logical-sheet" data-report-anchor="cost">${pageHeader}${renderProposalCosts(proposalSections, showPrices)}${renderProposalRemarks()}
        </div><div class="logical-sheet" data-report-anchor="terms">${pageHeader}${renderProposalTerms(preparedBy)}</div>
      </main>
    </div>`;
}
