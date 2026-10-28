import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Project } from '../App';
import type {
  EstimationAdditionalFeeEntry,
  EstimationConsumableEntry,
  EstimationManpowerEntry,
} from '../types';
import { computeEstimationTotals } from '../services/estimationStats';
import {
  assertMaterialsReconcile,
  buildStandardEstimationReportHtml,
  groupConsumablesBySystem,
} from './standardEstimationReport';

const item = (
  name: string,
  quantity: number,
  unitPrice: number,
  extra: Partial<EstimationConsumableEntry> = {},
): EstimationConsumableEntry => ({
  id: `${name}-${extra.surveyId ?? 'none'}`,
  name,
  category: 'Hardware',
  quantity,
  unit: 'pcs',
  unitPrice,
  totalPrice: unitPrice * quantity,
  ...extra,
});

const cctv1 = { systemType: 'CCTV', surveyId: 'survey-1', systemLabel: 'CCTV 1', brand: 'Hikvision' };
const cctv2 = { systemType: 'CCTV', surveyId: 'survey-2', systemLabel: 'CCTV 2', brand: 'Hikvision' };
const fdas = { systemType: 'FIRE_ALARM', surveyId: 'survey-3', systemLabel: 'FDAS', brand: 'Asenware' };

const consumables: EstimationConsumableEntry[] = [
  item('Hikvision 2MP Dome Camera', 4, 4500, cctv1),
  item('Cat6 UTP Cable', 180, 65, { ...cctv1, category: 'Wires & Cables', unit: 'meters' }),
  item('Hikvision 5MP Bullet Camera', 6, 5200, cctv2),
  item('PVC Conduit Pipe 20mm', 20, 240, { ...cctv2, category: 'Roughing-ins', unit: 'lengths' }),
  item('Optical Smoke Detector with Base', 10, 1850, fdas),
  item('Addressable Fire Alarm Control Panel 4-Loop', 1, 145000, fdas),
];

const manpower: EstimationManpowerEntry[] = [
  { id: 'm1', role: 'Lead Security Engineer', headcount: 1, hours: 80, manDays: 10, dayRate: 1000, totalCost: 10000 },
  { id: 'm2', role: 'Systems Installer', headcount: 3, hours: 240, manDays: 30, dayRate: 1000, totalCost: 30000 },
];

const fees: EstimationAdditionalFeeEntry[] = [
  { id: 'f1', type: 'Travel Fee', amount: 12500, description: 'Mobilization' },
];

const project = (systemTypes: string[]): Project => ({
  id: 'proj-1',
  name: 'Warehouse <Security> Upgrade',
  clientName: 'Acme Logistics',
  location: 'Pasig City',
  systemTypes,
  status: 'In Progress',
  assignedTechnicians: [],
  createdAt: '2026-10-01T00:00:00.000Z',
});

const build = (overrides: Partial<Parameters<typeof buildStandardEstimationReportHtml>[0]> = {}) => {
  const rows = overrides.consumables ?? consumables;
  const labor = overrides.manpower ?? manpower;
  const extraFees = overrides.fees ?? fees;
  return buildStandardEstimationReportHtml({
    project: project(['CCTV', 'FIRE_ALARM']),
    user: null,
    manpower: labor,
    consumables: rows,
    fees: extraFees,
    scopeOfWorks: [],
    constraints: {},
    technicianNotes: '',
    totals: computeEstimationTotals(labor, rows, extraFees),
    showPrices: true,
    headerBackgroundUrl: 'header.png',
    logoUrl: 'logo.png',
    ...overrides,
  });
};

test('totals follow the submission rules (12% VAT, rounded to centavos)', () => {
  const totals = computeEstimationTotals(manpower, consumables, fees);
  const materials = 18000 + 11700 + 31200 + 4800 + 18500 + 145000;
  assert.equal(totals.materialsTotal, materials);
  assert.equal(totals.laborTotal, 40000);
  assert.equal(totals.feesTotal, 12500);
  assert.equal(totals.subtotal, materials + 52500);
  assert.equal(totals.vat, +((materials + 52500) * 0.12).toFixed(2));
  assert.equal(totals.grandTotal, +((materials + 52500) * 1.12).toFixed(2));
});

test('each CCTV survey and FDAS gets its own group and subtotal', () => {
  const groups = groupConsumablesBySystem(consumables, ['CCTV', 'FIRE_ALARM']);
  assert.deepEqual(groups.map(g => g.label), ['CCTV 1', 'CCTV 2', 'FDAS']);
  assert.deepEqual(groups.map(g => g.subtotal), [29700, 36000, 163500]);
  assertMaterialsReconcile(groups, computeEstimationTotals([], consumables).materialsTotal);
});

test('untagged rows join the only system, or a shared group when there are several', () => {
  const manual = item('Manually Added Bracket', 2, 300);
  const single = groupConsumablesBySystem([item('Dome Camera', 1, 4500, cctv1), manual], ['CCTV']);
  assert.equal(single.length, 2); // tagged survey group + untagged "CCTV" rows
  assert.ok(single.every(g => g.label.startsWith('CCTV')));

  const multi = groupConsumablesBySystem([...consumables, manual], ['CCTV', 'FIRE_ALARM']);
  assert.equal(multi[multi.length - 1].label, 'Shared / Unassigned Materials');
  assert.equal(multi[multi.length - 1].items.length, 1);
});

test('report follows the quotation layout with every system kept apart', () => {
  const html = build();
  for (const title of ['A. General Requirements', 'B. Scope of Works', 'C. Active Components',
    'D. Roughing-ins Materials', 'E. Cable Components', 'Materials by System', 'F. Breakdown of Cost:',
    'Note and Remarks', 'Terms and Conditions', 'Client Conforme', 'Confirmation']) {
    assert.ok(html.includes(title), `missing section: ${title}`);
  }
  // Brand bars carry the system when the project has several.
  assert.match(html, /CCTV 1 &middot; HIKVISION/);
  assert.match(html, /CCTV 2 &middot; HIKVISION/);
  assert.match(html, /FDAS &middot; ASENWARE/);
  assert.ok(html.includes('Sub. Total (FDAS):'));
  // Labor appears once, as section B.
  assert.equal(html.match(/SCOPE OF WORKS \(INSTALLATION LABOR\)/g)?.length, 1);

  const totals = computeEstimationTotals(manpower, consumables, fees);
  const fmt = (n: number) => `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  assert.ok(html.includes(fmt(totals.grandTotal)), 'grand total missing');
  assert.ok(html.includes(fmt(totals.vat)), 'VAT missing');
  assert.ok(html.includes(`Sub. Total (Installation Labor):</td><td class="number">${fmt(40000)}`));
});

test('FDAS is absent and empty sections show NONE when not applicable', () => {
  const cctvOnly = consumables.filter(c => c.surveyId === 'survey-1');
  const html = build({ consumables: cctvOnly, fees: [], project: project(['CCTV']) });
  assert.doesNotMatch(html, /FDAS/);
  assert.doesNotMatch(html, /Materials by System/);
  assert.doesNotMatch(html, /Sub\. Total \(General Requirements\)/);
  assert.match(html, /class="none"/);
  // Single system: brand bars show the brand only.
  assert.match(html, /<div class="brand-bar">HIKVISION<\/div>/);
});

test('long brand lists are split into page-safe chunks with continuation headers', () => {
  const many = Array.from({ length: 15 }, (_, i) => item(`Camera ${i + 1}`, 1, 1000, cctv1));
  const html = build({ consumables: many });
  assert.equal(html.match(/class="brand-bar"/g)?.length, 2);
  assert.equal(html.match(/<span>Continued<\/span>/g)?.length, 1);
  assert.match(html, /<td class="center bold">15<\/td>/);
});

test('mismatched totals are rejected instead of rendered', () => {
  const totals = computeEstimationTotals(manpower, consumables, fees);
  assert.throws(
    () => build({ totals: { ...totals, materialsTotal: totals.materialsTotal + 1 } }),
    /do not match the estimation total/,
  );
});

test('prices are hidden for restricted roles and user text is escaped', () => {
  const html = build({ showPrices: false });
  assert.doesNotMatch(html, /Total Amount:/);
  assert.doesNotMatch(html, /PHP \d/);
  assert.match(html, /intentionally omitted/);
  assert.ok(html.includes('Warehouse &lt;Security&gt; Upgrade'));
  assert.ok(!html.includes('Warehouse <Security>'));
});

test('client details edited in the preview override project defaults', () => {
  const html = build({ header: { attentionTo: 'Jabee', company: 'Jabee Inc.', referenceCode: 'PQ-CCTV-2026-10-123', quoteDate: 'OCTOBER 28, 2026' } });
  assert.ok(html.includes('Jabee Inc.'));
  assert.ok(html.includes('Ref: PQ-CCTV-2026-10-123'));
  assert.ok(html.includes('<div class="sig-client-name">Jabee</div>'));
  assert.doesNotMatch(html, /Acme Logistics/);
});

test('draft exports are labelled', () => {
  assert.match(build({ isDraft: true }), /class="draft-banner"/);
  assert.doesNotMatch(build(), /class="draft-banner"/);
});
