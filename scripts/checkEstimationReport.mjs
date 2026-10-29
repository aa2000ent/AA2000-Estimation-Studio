import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({
  stdin: { contents: `export * from './src/services/estimationStats'; export * from './src/utils/standardEstimationReport'; export * from './src/utils/estimationProposalSections';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const manpower = [{ id: 'labor', role: 'Installer', headcount: 2, hours: 8, manDays: 2, dayRate: 1000, totalCost: 999 }];
const consumables = [{ id: 'camera', name: 'Camera', category: 'Hardware', quantity: 3, unitPrice: 100.125, totalPrice: 1 }];
const stats = api.computeEstimationStats(manpower, consumables, [{ amount: 50 }]);
assert.equal(stats.totalLabor, 2000, 'Do not multiply headcount twice or use stale labor totals');
assert.equal(stats.totalMaterials, 300.38, 'Recompute and round material line totals');
assert.equal(stats.subtotal, 2350.38);
assert.equal(stats.vat, 282.05);
assert.equal(stats.grandTotal, 2632.43);
assert.equal(api.laborLineTotal({ dayRate: 0, manDays: 3, totalCost: 3000 }), 0);
assert.equal(api.materialLineTotal({ quantity: 3, unitPrice: 0, totalPrice: 100 }), 0);
assert.equal(api.laborLineTotal({ totalCost: 800 }), 800, 'Preserve legacy total-only rows');
assert.equal(api.materialLineTotal({ totalPrice: 125 }), 125);
assert.equal(api.materialLineTotal({ quantity: 1, unitPrice: NaN, totalPrice: Infinity }), 0);
const input = {
  project: { id: 'test', name: 'Parking <Structure>', clientName: 'Client & Co.', location: 'Manila', status: 'Draft', createdAt: '2026-10-29' },
  user: null, manpower, consumables, fees: [{ id: 'fee', type: 'Other', amount: 50, description: 'Delivery' }],
  scopeOfWorks: [{ id: 'scope', itemNumber: 1, description: 'Systems: CCTV', unit: '1 LOT', totalPrice: 0 }],
  constraints: {}, technicianNotes: '', totals: { totalLabor: 99999, totalMaterials: 99999, totalFees: 99999 },
  showPrices: true, headerBackgroundUrl: '', logoUrl: '',
};
const html = api.buildStandardEstimationReportHtml(input);
assert.match(html, /SECTION 1 — CCTV/);
assert.match(html, /PHP 2,632.43/);
assert.doesNotMatch(html, /PHP 99,999/);
assert.match(html, /Parking &lt;Structure&gt;/);
assert.match(html, /Sections &amp; amounts/);
assert.match(html, /overview-plan/);
assert.doesNotMatch(html, /Recorded Scope of Works|summary-strip">|Note and Remarks: Recorded Site Survey Conditions/);
const withConditions = api.buildStandardEstimationReportHtml({ ...input, constraints: { physical: 'Keep fire exits clear.' }, technicianNotes: 'Coordinate with building manager.' });
assert.match(withConditions, /Site Conditions &amp; Technician Notes/);
assert.match(withConditions, /Keep fire exits clear/);
assert.equal((withConditions.match(/template-remarks"/g) || []).length, 1);
assert.doesNotMatch(api.buildStandardEstimationReportHtml({ ...input, showPrices: false }), /PHP [\d,]+\.\d{2}/);
assert.match(html, /compact-page-header/);
assert.match(html, /BDO ACCOUNT NUMBER: 006930089663/);
assert.match(html, /gantt-bar/);
assert.match(html, /Template example only/);
assert.match(html, /not calculated from this project's quantities/);
assert.match(html, /client-masthead/);
assert.match(html, /data-toc-target="milestones"/);
const multi = api.groupProposalSections(['CCTV', 'FDAS'],
  [{ ...manpower[0], role: 'CCTV Installer' }, { ...manpower[0], id: 'shared', role: 'Installer' }],
  [...consumables, { ...consumables[0], id: 'smoke', name: 'Smoke detector' }, { ...consumables[0], id: 'pipe', name: 'EMT conduit', category: 'Roughing-ins' }], []);
assert.equal(multi.length, 3);
assert.equal(multi[0].materials.length, 1);
assert.equal(multi[1].materials.length, 1);
assert.equal(multi[2].materials.length, 1);
assert.equal(multi[2].manpower.length, 1);
assert.equal(multi.reduce((sum, section) => sum + api.sectionAmounts(section).reduce((a, b) => a + b, 0), 0), 4901.14, 'Every line is counted exactly once across system categories');
if (process.argv.includes('--preview')) {
  const fs = await import('node:fs');
  const preview = { ...input, project: { ...input.project, name: 'CCTV & FDAS Installation', systemTypes: ['CCTV', 'FIRE_ALARM'], technicianName: 'Project Estimator' },
    headerBackgroundUrl: `data:image/png;base64,${fs.readFileSync('src/assets/pdf/PDF_header.png').toString('base64')}`,
    logoUrl: `data:image/png;base64,${fs.readFileSync('src/assets/pdf/aa2000_logo.png').toString('base64')}`,
    manpower: [{ ...manpower[0], role: 'CCTV Installer' }, { ...manpower[0], role: 'FDAS Technician', id: 'fdas-labor', dayRate: 1500, manDays: 3 }],
    consumables: [{ ...consumables[0], name: 'IP Camera', brand: 'HIKVISION', productId: 'HWI-B121H', quantity: 2, unitPrice: 1620 }, { ...consumables[0], id: 'smoke', name: 'Photoelectric smoke detector with base', brand: 'FDAS DEVICES', quantity: 6, unitPrice: 650 }], fees: [], scopeOfWorks: [],
  };
  fs.writeFileSync('../estimation-template-preview.html', api.buildStandardEstimationReportHtml(preview));
  fs.writeFileSync('../estimation-template-runtime.js', compiled.outputFiles[0].text);
}
console.log('Estimation arithmetic and report regression checks passed.');
