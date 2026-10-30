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
  unitPrice?: number;
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
  vat: number;
  grandTotal: number;
}

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const finite = (value: number | undefined): number => Number.isFinite(value) ? value! : 0;

// Man-days already represent total person-days; do not multiply headcount again.
export const laborLineTotal = (row: StatManpowerRow): number => roundMoney(
  row.dayRate != null && Number.isFinite(row.dayRate)
    ? finite(row.dayRate) * finite(row.manDays)
    : finite(row.totalCost)
);
export const materialLineTotal = (row: StatConsumableRow): number => roundMoney(
  row.unitPrice != null && Number.isFinite(row.unitPrice)
    ? finite(row.quantity) * finite(row.unitPrice)
    : finite(row.totalPrice)
);

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
  const totalLabor = roundMoney(manpower.reduce((sum, m) => sum + laborLineTotal(m), 0));
  const totalMaterials = roundMoney(consumables.reduce((sum, c) => sum + materialLineTotal(c), 0));
  const totalFees = roundMoney(fees.reduce((sum, f) => sum + roundMoney(finite(f.amount)), 0));
  const subtotal = roundMoney(totalLabor + totalMaterials + totalFees);
  const vat = roundMoney(subtotal * 0.12);
  return {
    totalHeadcount,
    totalManDays,
    totalMaterialLines,
    cableTotal,
    totalLabor,
    totalMaterials,
    totalFees,
    subtotal,
    vat,
    grandTotal: roundMoney(subtotal + vat),
  };
}

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
  const stats = computeEstimationStats(manpower, consumables, fees);
  return {
    materialsTotal: stats.totalMaterials,
    laborTotal: stats.totalLabor,
    feesTotal: stats.totalFees,
    subtotal: stats.subtotal,
    vat: stats.vat,
    grandTotal: stats.grandTotal,
  };
}
