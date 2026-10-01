// Parses the markdown BOQ returned by POST /floor-plan-ai-analysis back into
// the FloorPlanEstimation object the studio renders.
//
// This is the exact inverse of the backend's estimationToMarkdown()
// (AA2000Backend_Server/services/Applications/ESTIMATION/floorPlan/markdown.js):
// sections are `## Heading` blocks, values live in GFM table cells or `- ` list
// items, cells escape `|` as `\|` and newlines as <br>, and money is 2-decimal.
// A human re-saving the markdown by hand degrades gracefully — unknown rows and
// missing sections fall back to empty arrays and the existing defaults.

import type { FloorPlanEstimation } from './geminiFloorPlanService';

type Row = string[];

interface Section {
  heading: string;
  lines: string[];
}

function unescapeCell(value: string): string {
  return value
    .replace(/\\\|/g, '|')
    .replace(/\\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function toNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const cleaned = String(value)
    .replace(/[₱$,]/g, '')
    .replace(/\s/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '—') return fallback;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: string | undefined, fallback = 0): number {
  return Math.round(toNumber(value, fallback));
}

/** The emitter writes 'N/A' for empty optional cells; read them back as ''. */
function optional(value: string | undefined): string {
  const text = (value ?? '').trim();
  return text === 'N/A' || text === '-' || text === '—' ? '' : text;
}

/** Splits a table row into cells, honoring `\|` escapes. */
function splitRow(line: string): Row {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '\\|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map(unescapeCell);
}

function isSeparatorRow(cells: Row): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/** Collects the data rows of the first table in a section. */
function parseTable(lines: string[]): Row[] {
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 2) return [];

  const headers = splitRow(tableLines[0]).map((header) => header.toLowerCase());
  const rows: Row[] = [];

  for (let index = 1; index < tableLines.length; index += 1) {
    const cells = splitRow(tableLines[index]);
    if (isSeparatorRow(cells)) continue;
    rows.push(cells);
  }

  // Attach headers so consumers can look a column up by name instead of index.
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, position) => {
      record[header] = row[position] ?? '';
    });
    return record as unknown as Row;
  });
}

/**
 * Indexes a two-column table as `label -> value`. Works for both shapes the
 * emitter uses: `Field | Value` (header, device summary) and `Item | Amount`
 * (cost breakdown).
 */
function fieldMap(lines: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of parseTable(lines)) {
    const record = row as unknown as Record<string, string>;
    const keys = Object.keys(record);
    if (keys.length !== 2) continue;
    const label = record[keys[0]]?.trim();
    if (!label) continue;
    map[label.toLowerCase()] = record[keys[1]] ?? '';
  }
  return map;
}

function splitSections(markdown: string): Map<string, Section> {
  const sections = new Map<string, Section>();
  let current: Section = { heading: '', lines: [] };

  for (const line of String(markdown || '').split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.*)$/);
    if (match) {
      if (current.heading || current.lines.length > 0) {
        sections.set(current.heading.trim().toLowerCase(), current);
      }
      current = { heading: match[1].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.heading || current.lines.length > 0) {
    sections.set(current.heading.trim().toLowerCase(), current);
  }

  return sections;
}

function bullets(lines: string[]): string[] {
  return lines
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => unescapeCell(match[1]));
}

function rowValue(row: Row, column: string): string {
  return (row as unknown as Record<string, string>)[column.toLowerCase()] ?? '';
}

/** Pulls the free-text body of a section (no tables, no bullets, no metadata). */
function prose(lines: string[]): string {
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith('|')) return false;
      if (/^[-*]\s+/.test(trimmed)) return false;
      if (/^_{1,2}.*_{1,2}$/.test(trimmed)) return false;
      // The emitter parks the confidence score at the end of the document, i.e.
      // inside the Observations section — it is metadata, not an observation.
      if (/^\*\*confidence score:\*\*/i.test(trimmed)) return false;
      return true;
    })
    .map((line) => line.replace(/\*\*/g, '').trim())
    .join('\n')
    .trim();
}

const DEFAULT_CONSTRAINTS = {
  physical: 'Standard site physical conditions.',
  electrical: '220V power supply available at main DB.',
  installation: 'Standard working hours installation access.',
};

function parseConsumables(section?: Section) {
  return parseTable(section?.lines ?? []).map((row) => {
    const unitPrice = toNumber(rowValue(row, 'unit price'));
    return {
      name: rowValue(row, 'description') || 'Equipment Item',
      category: rowValue(row, 'category') || 'Hardware',
      brand: optional(rowValue(row, 'brand')),
      catalogModel: optional(rowValue(row, 'model')),
      catalogCode: optional(rowValue(row, 'code')),
      quantity: toNumber(rowValue(row, 'qty'), 1),
      unit: rowValue(row, 'unit') || 'pcs',
      unitPrice,
      srp: toNumber(rowValue(row, 'srp'), unitPrice),
      contractorPrice: toNumber(rowValue(row, 'contractor'), unitPrice),
      dealerPrice: toNumber(rowValue(row, 'dealer'), unitPrice),
      totalPrice: toNumber(rowValue(row, 'total price'), unitPrice * toNumber(rowValue(row, 'qty'), 1)),
    };
  });
}

function parseManpower(section?: Section) {
  return parseTable(section?.lines ?? []).map((row) => {
    const ratePerDay = toNumber(rowValue(row, 'rate per day'), 1000);
    const manDays = toInt(rowValue(row, 'man-days'), 1);
    return {
      role: rowValue(row, 'role') || 'Installer',
      headcount: toInt(rowValue(row, 'headcount'), 1),
      hours: toNumber(rowValue(row, 'hours'), 8),
      manDays,
      ratePerDay,
      totalCost: toNumber(rowValue(row, 'total cost'), ratePerDay * manDays),
    };
  });
}

function parseGeneralRequirements(section?: Section) {
  return parseTable(section?.lines ?? []).map((row) => {
    const qty = toNumber(rowValue(row, 'qty'), 1);
    const unitPrice = toNumber(rowValue(row, 'unit price'));
    return {
      itemNumber: toInt(rowValue(row, 'item')),
      description: rowValue(row, 'description') || 'General Requirement Item',
      qty,
      unit: rowValue(row, 'unit') || 'LOT',
      unitPrice,
      totalPrice: toNumber(rowValue(row, 'total price'), unitPrice * qty),
    };
  });
}

function parseScopeOfWorks(section?: Section) {
  return parseTable(section?.lines ?? []).map((row) => ({
    itemNumber: toInt(rowValue(row, 'item')),
    description: rowValue(row, 'description') || 'Scope Item',
    unit: rowValue(row, 'unit') || '1 LOT',
    totalPrice: toNumber(rowValue(row, 'total price')),
  }));
}

function parseFees(section?: Section) {
  return parseTable(section?.lines ?? []).map((row) => ({
    type: rowValue(row, 'type') || 'Fee',
    amount: toNumber(rowValue(row, 'amount')),
    description: rowValue(row, 'description') || '',
  }));
}

function parseScheduleOfPayment(section?: Section) {
  return parseTable(section?.lines ?? []).map((row) => {
    const amount = toNumber(rowValue(row, 'amount'));
    return {
      itemCode: rowValue(row, 'code') || 'A',
      milestone: rowValue(row, 'milestone') || 'Project Milestone',
      qty: toNumber(rowValue(row, 'qty'), 1),
      unit: rowValue(row, 'unit') || 'LOT',
      unitPrice: amount,
      totalPrice: amount,
    };
  });
}

function parseCostBreakdown(section?: Section) {
  const map = fieldMap(section?.lines ?? []);
  return {
    itemATotal: toNumber(map['item a total']),
    itemBTotal: toNumber(map['item b total']),
    subTotal: toNumber(map.subtotal),
    discount: toNumber(map.discount),
    subTotalWithDiscount: toNumber(map['subtotal with discount']),
    vat12Percent: toNumber(map['vat (12%)']) || toNumber(Object.keys(map).find((key) => key.startsWith('vat')) ?? ''),
    grandTotalAmount: toNumber(map['grand total']),
  };
}

function parseQuotationHeader(section?: Section) {
  const map = fieldMap(section?.lines ?? []);
  return {
    attentionTo: map['attention to'] || 'Client Representative',
    thru: map.thru || 'Project Manager',
    company: map.company || 'Project Client',
    emailAdd: map.email || 'client@company.com',
    contactNo: map['contact no.'] || 'N/A',
    address: map.address || 'Metro Manila',
    projectSite: map['project site'] || 'Metro Manila',
    projectTitle: map['project title'] || 'Security & Safety Systems Installation',
    quoteDate: map['quote date'] || 'N/A',
    validityPeriod: map['validity period'] || '30 days from date of quotation',
  };
}

function parseDeviceSummary(section?: Section) {
  const map = fieldMap(section?.lines ?? []);
  return {
    facpBrand: map['facp / equipment brand'] || 'Standard Carried Brand',
    systemType: map['system type'] || 'Security Systems',
    totalUnitsText: map['total units'] || 'Total Units: As Estimated',
    buildingProfile: map['building profile'] || 'Commercial / Office Facility',
    workingSchedule: map['working schedule'] || 'Regular Shift (8AM-5PM)',
    remarks: map.remarks || 'Subject to site verification',
  };
}

function parseConstraints(section?: Section): FloorPlanEstimation['constraints'] {
  const result = { ...DEFAULT_CONSTRAINTS };
  for (const line of bullets(section?.lines ?? [])) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === 'physical') result.physical = value;
    else if (key === 'electrical') result.electrical = value;
    else if (key === 'installation') result.installation = value;
  }
  return result;
}

function parseRejectedFiles(section?: Section) {
  return bullets(section?.lines ?? []).map((line) => {
    const match = line.match(/^(.+?)\s+—\s+(.*)$/);
    return {
      filename: match ? match[1].trim() : line,
      reason: match ? match[2].trim() : '',
    };
  });
}

function parseConfidence(markdown: string): number {
  const match = markdown.match(/\*\*Confidence Score:\*\*\s*(\d+)/i);
  return match ? Math.min(100, Math.max(0, Number(match[1]) || 0)) : 0;
}

function parseReferenceCode(sections: Map<string, Section>, markdown: string): string {
  const fromTable = fieldMap(sections.get('quotation header')?.lines ?? [])['quotation reference code'];
  if (fromTable && fromTable !== 'N/A') return fromTable;
  const fromTitle = markdown.match(/\*\*Reference:\*\*\s*([^\n*]+)/i);
  return fromTitle ? fromTitle[1].trim() : '';
}

/**
 * @param markdown the BOQ markdown returned by POST /floor-plan-ai-analysis
 * @returns a fully-populated FloorPlanEstimation, or null when the payload is
 *          not a recognizable BOQ document.
 */
export function parseFloorPlanMarkdown(markdown: string): FloorPlanEstimation | null {
  const text = String(markdown || '').trim();
  if (!text) return null;

  const sections = splitSections(text);
  const hasBoqSection = sections.has('consumables')
    || sections.has('cost breakdown')
    || sections.has('quotation header');
  if (!hasBoqSection) return null;

  const rejectedFiles = parseRejectedFiles(sections.get('skipped files'));

  const estimation: FloorPlanEstimation = {
    quotationReferenceCode: parseReferenceCode(sections, text),
    quotationHeader: parseQuotationHeader(sections.get('quotation header')),
    deviceSummary: parseDeviceSummary(sections.get('device summary')),
    generalRequirements: parseGeneralRequirements(sections.get('general requirements')),
    scopeOfWorks: parseScopeOfWorks(sections.get('scope of works')),
    consumables: parseConsumables(sections.get('consumables')),
    manpower: parseManpower(sections.get('manpower')),
    fees: parseFees(sections.get('fees')),
    costBreakdown: parseCostBreakdown(sections.get('cost breakdown')),
    scheduleOfPayment: parseScheduleOfPayment(sections.get('schedule of payment')),
    termsAndConditions: bullets(sections.get('terms and conditions')?.lines ?? []),
    constraints: parseConstraints(sections.get('constraints')),
    observations: prose(sections.get('observations')?.lines ?? []),
    confidenceScore: parseConfidence(text),
  };

  if (rejectedFiles.length > 0) {
    estimation.rejectedFiles = rejectedFiles;
  }

  return estimation;
}
