// src/services/estimationStats.ts
// Single source of truth for the summary numbers shared between the Cost
// Estimation page (stat cards + BOQ totals) and the AI result panels, so both
// screens always show identical values for the same rows.

type StatManpowerRow = {
  headcount?: number;
  manDays?: number;
  dayRate?: number;
  totalCost?: number;
};

type StatConsumableRow = {
  quantity?: number;
  unit?: string;
  category?: string;
  totalPrice?: number;
};

type StatFeeRow = {
  amount?: number;
};

export interface EstimationStats {
  totalHeadcount: number;
  totalManDays: number;
  totalMaterialLines: number;
  cableTotal: number;
  totalLabor: number;
  totalMaterials: number;
  totalFees: number;
  subtotal: number;
}

export function computeEstimationStats(
  manpower: readonly StatManpowerRow[],
  consumables: readonly StatConsumableRow[],
  fees: readonly StatFeeRow[] = []
): EstimationStats {
  const totalHeadcount = manpower.reduce((sum, m) => sum + (m.headcount || 0), 0);
  const totalManDays = manpower.reduce((sum, m) => sum + (m.manDays || 0), 0);
  const totalMaterialLines = consumables.length;
  const cableTotal = consumables
    .filter(c => {
      const unit = (c.unit || '').toLowerCase();
      return unit.includes('meter') || unit === 'm' || c.category === 'Wires & Cables';
    })
    .reduce((sum, c) => sum + (c.quantity || 0), 0);
  const totalLabor = manpower.reduce(
    (sum, m) => sum + (m.totalCost || ((m.dayRate || 1000) * (m.manDays || 0))),
    0
  );
  const totalMaterials = consumables.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
  const totalFees = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
  return {
    totalHeadcount,
    totalManDays,
    totalMaterialLines,
    cableTotal,
    totalLabor,
    totalMaterials,
    totalFees,
    subtotal: totalLabor + totalMaterials + totalFees,
  };
}

const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export const VAT_RATE = 0.12;

export interface EstimationTotals {
  materialsTotal: number;
  laborTotal: number;
  feesTotal: number;
  subtotal: number;
  vat: number;
  grandTotal: number;
}

/**
 * Totals written to the database on submission (`amount` = grandTotal).
 * The PDF report uses the same function so the document always reconciles
 * with the stored record.
 */
export function computeEstimationTotals(
  manpower: readonly StatManpowerRow[],
  consumables: readonly StatConsumableRow[],
  fees: readonly StatFeeRow[] = []
): EstimationTotals {
  const materialsTotal = consumables.reduce((s, c) => s + num(c.totalPrice), 0);
  const laborTotal = manpower.reduce((s, m) => s + num(m.totalCost), 0);
  const feesTotal = fees.reduce((s, f) => s + num(f.amount), 0);
  const subtotal = materialsTotal + laborTotal + feesTotal;
  return {
    materialsTotal,
    laborTotal,
    feesTotal,
    subtotal,
    vat: +(subtotal * VAT_RATE).toFixed(2),
    grandTotal: +(subtotal * (1 + VAT_RATE)).toFixed(2),
  };
}
