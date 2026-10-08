import { useState } from 'react';
import {
  Check,
  StatBuilding,
  SysShield,
  Truck,
  ChartBar,
  NotifExclamation,
  RoleWrench,
  StatCheckCircle,
  StatClipboard,
  StatPin,
  RoleCalculator,
  Package,
  Users,
} from '../../utils/Icons';
import type {
  EstimationAnalyzeResult,
  FloorPlanAnalyzeResult,
  FloorPlanSection,
  FormConstraints,
  FormManpowerRow,
  FormMaterialItem,
  FormScopeRow,
  SectionRequirementEntry,
  SectionRequirementsResult,
} from '../../services/api/estimationFlow';
import { computeEstimationStats } from '../../services/estimationStats';

interface PanelProps {
  isDark?: boolean;
}

function formatMoney(value: number | undefined, currency = 'PHP'): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()}`;
  }
}

function formatNumber(value: number | undefined, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function cardStyle(dark?: boolean): React.CSSProperties {
  return {
    background: dark ? '#162032' : '#FFFFFF',
    border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
    borderRadius: '16px',
    padding: '14px',
  };
}

function muted(dark?: boolean): string {
  return dark ? '#94A3B8' : '#64748B';
}

function heading(dark?: boolean): string {
  return dark ? '#F8FAFC' : '#1E293B';
}

function accent(dark?: boolean): string {
  return dark ? '#60A5FA' : '#1D4ED8';
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1"
      style={{ background: color, color: '#fff' }}
    >
      {children}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  dark,
}: {
  label: string;
  value: string;
  sub?: string;
  dark?: boolean;
}) {
  return (
    <div style={cardStyle(dark)}>
      <p
        className="text-[9px] font-bold uppercase tracking-wider"
        style={{ color: muted(dark) }}
      >
        {label}
      </p>
      <p
        className="text-lg font-black mt-1 leading-tight"
        style={{ color: heading(dark) }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: muted(dark) }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function PanelHeading({
  icon,
  title,
  dark,
}: {
  icon: React.ReactNode;
  title: string;
  dark?: boolean;
}) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5"
      style={{ color: accent(dark) }}
    >
      {icon}
      {title}
    </p>
  );
}

const SYSTEM_KEY_LABELS: Record<string, string> = {
  cctv: 'CCTV',
  fdas: 'FDAS',
  accessControl: 'Access Control',
  environmental: 'Environmental',
  power: 'Power',
  cooling: 'Cooling',
  cabling: 'Cabling',
  civilWorks: 'Civil Works',
  burglarAlarm: 'Burglar Alarm',
  fireProtection: 'Fire Protection',
  other: 'Other',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#D97706',
  low: '#2563EB',
};

/** Category rollup rebuilt from the item rows so edits never go stale. */
function rebuildMaterialSummary(
  rows: FormMaterialItem[],
  currency: string
): SectionRequirementsResult['materialSummary'] {
  const categories = Object.values(
    rows.reduce((acc, row) => {
      const key = String(row.category || 'Materials');
      const entry =
        acc[key] || (acc[key] = { category: key, itemCount: 0, estimatedCost: 0 });
      entry.itemCount += 1;
      entry.estimatedCost += Number(row.totalPrice) || 0;
      return acc;
    }, {} as Record<string, { category: string; itemCount: number; estimatedCost: number }>)
  );
  return {
    categories,
    totalEstimatedCost: categories.reduce((sum, c) => sum + c.estimatedCost, 0),
    currency,
  };
}

/** Numbered work items — shown by both the API #2 and API #3 result panels. */
function ScopeOfWorksCard({
  rows,
  currency,
  dark,
  editable = false,
  onChange,
}: {
  rows: FormScopeRow[];
  currency: string;
  dark?: boolean;
  /** Shows description/unit/price inputs plus add & remove. */
  editable?: boolean;
  onChange?: (rows: FormScopeRow[]) => void;
}) {
  const editing = editable && typeof onChange === 'function';
  if (!rows.length && !editing) return null;

  const renumber = (list: FormScopeRow[]) =>
    list.map((row, i) => ({ ...row, itemNumber: i + 1 }));
  const update = (i: number, patch: Partial<FormScopeRow>) =>
    onChange?.(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) =>
    onChange?.(renumber(rows.filter((_, idx) => idx !== i)));
  const add = () =>
    onChange?.(renumber([...rows, { description: '', unit: '1 LOT', totalPrice: 0 }]));

  const cellCls = 'w-full px-2 py-1 rounded-lg text-xs font-semibold outline-none';

  return (
    <div style={cardStyle(dark)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: accent(dark) }}
        >
          <StatClipboard className="w-4 h-4 inline mr-1.5" />
          SCOPE OF WORKS
        </p>
        {editing && (
          <button
            type="button"
            onClick={add}
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
            style={{ background: 'rgba(37,99,235,0.12)', color: dark ? '#93C5FD' : '#1D4ED8' }}
          >
            + Add item
          </button>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.itemNumber ?? i}
            className="flex items-start justify-between gap-3 text-xs"
            style={{ borderTop: i > 0 ? `1px solid ${dark ? '#1E293B' : '#F1F5F9'}` : undefined }}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Badge color="#3B82F6">#{row.itemNumber ?? i + 1}</Badge>
              {editing ? (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={row.description || ''}
                    onChange={e => update(i, { description: e.target.value })}
                    placeholder="Work item description"
                    className={cellCls}
                    style={{
                      background: dark ? '#0F172A' : '#FFFFFF',
                      border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
                      color: heading(dark),
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.unit || ''}
                      onChange={e => update(i, { unit: e.target.value })}
                      placeholder="Unit"
                      className={`${cellCls} w-24`}
                      style={{
                        background: dark ? '#0F172A' : '#FFFFFF',
                        border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
                        color: heading(dark),
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      value={row.totalPrice ?? 0}
                      onChange={e => update(i, { totalPrice: Number(e.target.value) || 0 })}
                      placeholder="Total price"
                      className={`${cellCls} w-32`}
                      style={{
                        background: dark ? '#0F172A' : '#FFFFFF',
                        border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
                        color: heading(dark),
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: heading(dark) }}>{row.description}</p>
                  <p className="text-[10px]" style={{ color: muted(dark) }}>{row.unit || '1 LOT'}</p>
                </div>
              )}
            </div>
            {editing ? (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove item"
                className="shrink-0 w-6 h-6 rounded-full text-[10px] font-black cursor-pointer"
                style={{ background: dark ? '#0F172A' : '#F1F5F9', color: '#DC2626' }}
              >
                ✕
              </button>
            ) : (
              <p className="font-black shrink-0" style={{ color: accent(dark) }}>
                {row.totalPrice ? formatMoney(row.totalPrice, currency) : '—'}
              </p>
            )}
          </div>
        ))}
        {editing && rows.length === 0 && (
          <p className="text-[10px]" style={{ color: muted(dark) }}>
            No work items yet — add the first one.
          </p>
        )}
      </div>
    </div>
  );
}

/** Physical / electrical / installation notes — shown by both result panels. */
function ConstraintsCard({
  constraints,
  dark,
  editable = false,
  onChange,
}: {
  constraints?: FormConstraints;
  dark?: boolean;
  /** Shows a textarea per constraint, including the empty ones. */
  editable?: boolean;
  onChange?: (next: FormConstraints) => void;
}) {
  const editing = editable && typeof onChange === 'function';
  const blocks: [string, keyof FormConstraints][] = [
    ['Physical', 'physical'],
    ['Electrical', 'electrical'],
    ['Installation', 'installation'],
  ];
  const shown = editing
    ? blocks
    : blocks.filter(([, key]) => constraints?.[key] && String(constraints[key]).trim());
  if (!shown.length) return null;

  return (
    <div style={cardStyle(dark)}>
      <PanelHeading icon={<StatPin className="w-4 h-4 inline mr-1.5" />} title="SITE CONSTRAINTS" dark={dark} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {shown.map(([label, key]) => (
          <div
            key={key}
            className="p-3 rounded-xl"
            style={{
              background: dark ? '#0F172A' : '#F8FAFC',
              border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
            }}
          >
            <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: muted(dark) }}>
              {label}
            </p>
            {editing ? (
              <textarea
                rows={3}
                value={constraints?.[key] ?? ''}
                onChange={e => onChange?.({ ...constraints, [key]: e.target.value })}
                placeholder={`${label} constraints…`}
                className="w-full text-xs rounded-lg px-2 py-1.5 outline-none resize-y"
                style={{
                  background: dark ? '#0F172A' : '#FFFFFF',
                  border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
                  color: heading(dark),
                }}
              />
            ) : (
              <p className="text-xs" style={{ color: heading(dark) }}>{constraints?.[key]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API #3 — Estimation Analysis results (manual flow "extract requirements")
// ---------------------------------------------------------------------------

export function EstimationAnalysisResultPanel({
  result,
  isDark,
}: PanelProps & { result: EstimationAnalyzeResult }) {
  const summary = result.summary;
  const currency = summary?.currency || 'PHP';
  const breakdown = summary?.breakdown;
  const manpower = result.manpower || [];
  const labor = result.labor || [];
  const materials = result.materials || [];
  const phases = summary?.timeline?.phases || [];
  const risks = result.risks || [];
  const assumptions = result.assumptions || [];
  const fees = result.fees || [];
  const scopeOfWorks = result.scopeOfWorks || [];
  const constraints = result.constraints;

  // Same helper the Cost Estimation page uses for its stat cards and BOQ
  // totals: what the panel shows is exactly what the page computes for the
  // rows it applies — never the AI's narrative summary alone.
  const flatMaterials = materials.flatMap(cat => cat.items ?? []);
  const stats = computeEstimationStats(manpower, flatMaterials, fees);
  const appliedLabor = stats.totalLabor;
  const appliedMaterials = stats.totalMaterials;
  const appliedFees = stats.totalFees;
  const appliedTotal = stats.subtotal;
  const summaryTotal = summary?.totalEstimatedCost;
  const summaryDiffers =
    appliedTotal > 0 && summaryTotal !== undefined && Math.abs(summaryTotal - appliedTotal) > 1;
  const contingencyRatio =
    typeof breakdown?.contingency === 'number' &&
    breakdown.contingency >= 0 &&
    breakdown.contingency <= 1
      ? breakdown.contingency
      : undefined;

  return (
    <div className="space-y-5">
      <div>
        <PanelHeading icon={<ChartBar className="w-4 h-4 inline mr-1.5" />} title="ESTIMATION SUMMARY" dark={isDark} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Total Estimate"
            value={formatMoney(appliedTotal > 0 ? appliedTotal : summaryTotal, currency)}
            sub={summaryDiffers ? `AI summary: ${formatMoney(summaryTotal, currency)}` : currency}
            dark={isDark}
          />
          <StatTile
            label="Confidence"
            value={result.confidenceScore !== undefined ? `${result.confidenceScore}%` : '—'}
            dark={isDark}
          />
          <StatTile
            label="Timeline"
            value={summary?.timeline?.totalDays !== undefined ? `${summary.timeline.totalDays} days` : '—'}
            sub={`${phases.length} phases`}
            dark={isDark}
          />
          <StatTile
            label="Manpower"
            value={formatNumber(manpower.reduce((sum, m) => sum + (m.headcount || 0), 0))}
            sub={`${manpower.length} roles`}
            dark={isDark}
          />
        </div>
        {/* Mirrors the Cost Estimation page's four summary cards (shared helper). */}
        {(manpower.length > 0 || flatMaterials.length > 0) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatTile label="Total Headcount" value={`${formatNumber(stats.totalHeadcount)} pax`} dark={isDark} />
            <StatTile label="Total Man-Days" value={`${formatNumber(stats.totalManDays)} days`} dark={isDark} />
            <StatTile label="Material Lines" value={`${formatNumber(stats.totalMaterialLines)} items`} dark={isDark} />
            <StatTile
              label="Cable Estimate"
              value={stats.cableTotal > 0 ? `~${formatNumber(stats.cableTotal)} m` : '—'}
              dark={isDark}
            />
          </div>
        )}
      </div>

      {summary && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<StatBuilding className="w-4 h-4 inline mr-1.5" />} title="COST BREAKDOWN (APPLIED ROWS)" dark={isDark} />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile label="Materials" value={formatMoney(appliedMaterials, currency)} dark={isDark} />
            <StatTile label="Labor" value={formatMoney(appliedLabor, currency)} dark={isDark} />
            <StatTile label="Fees" value={formatMoney(appliedFees, currency)} dark={isDark} />
            <StatTile
              label="Contingency"
              value={contingencyRatio !== undefined ? `${Math.round(contingencyRatio * 100)}%` : '—'}
              sub="not added to total"
              dark={isDark}
            />
            <StatTile
              label="AI Summary"
              value={formatMoney(summaryTotal, currency)}
              sub={summaryDiffers ? 'differs from rows' : 'in sync with rows'}
              dark={isDark}
            />
          </div>
          {phases.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {phases.map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                  style={{
                    background: isDark ? 'rgba(37,99,235,0.2)' : 'rgba(30,58,138,0.06)',
                    color: isDark ? '#93C5FD' : '#1E3A8A',
                    border: `1px solid ${isDark ? 'rgba(37,99,235,0.4)' : 'rgba(30,58,138,0.1)'}`,
                  }}
                >
                  {p.phase} · {p.days}d
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {manpower.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<Users className="w-4 h-4 inline mr-1.5" />} title="MANPOWER" dark={isDark} />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider" style={{ color: muted(isDark) }}>
                  <th className="pb-2 pr-3 font-bold">Role</th>
                  <th className="pb-2 pr-3 font-bold">Headcount</th>
                  <th className="pb-2 pr-3 font-bold">Hrs/Person</th>
                  <th className="pb-2 pr-3 font-bold">Man-Days</th>
                  <th className="pb-2 pr-3 font-bold">Day Rate</th>
                  <th className="pb-2 pr-3 font-bold">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {manpower.map((m, i) => (
                  <tr key={i} className="text-xs" style={{ color: heading(isDark), borderTop: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}` }}>
                    <td className="py-2 pr-3 font-bold">{m.role}</td>
                    <td className="py-2 pr-3">{m.headcount}</td>
                    <td className="py-2 pr-3">{formatNumber(m.hours)}</td>
                    <td className="py-2 pr-3">{formatNumber(m.manDays)}</td>
                    <td className="py-2 pr-3">{formatMoney(m.dayRate, currency)}</td>
                    <td className="py-2 pr-3 font-bold">{formatMoney(m.totalCost, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {labor.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<RoleWrench className="w-4 h-4 inline mr-1.5" />} title="LABOR ACTIVITIES" dark={isDark} />
          <div className="space-y-2">
            {labor.slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold" style={{ color: heading(isDark) }}>{l.activity}</p>
                  <p className="text-[10px]" style={{ color: muted(isDark) }}>
                    {l.systemTypes?.join(' · ')} — {formatNumber(l.estimatedHours)} {l.unit || 'man-hours'}
                  </p>
                </div>
                <p className="font-black shrink-0" style={{ color: accent(isDark) }}>
                  {formatMoney(l.totalCost, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {materials.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<Truck className="w-4 h-4 inline mr-1.5" />} title="MATERIALS" dark={isDark} />
          <div className="space-y-2">
            {materials.slice(0, 8).map((cat, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold" style={{ color: heading(isDark) }}>{cat.category}</p>
                  <p className="text-[10px]" style={{ color: muted(isDark) }}>{cat.items?.length || 0} items</p>
                </div>
                <p className="font-black shrink-0" style={{ color: accent(isDark) }}>
                  {formatMoney(cat.subtotal, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {fees.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<RoleCalculator className="w-4 h-4 inline mr-1.5" />} title="ADDITIONAL FEES" dark={isDark} />
          <div className="space-y-2">
            {fees.map((fee, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 text-xs"
                style={{ borderTop: i > 0 ? `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}` : undefined }}
              >
                <div className="min-w-0">
                  <p className="font-bold" style={{ color: heading(isDark) }}>{fee.type}</p>
                  {fee.description && (
                    <p className="text-[10px]" style={{ color: muted(isDark) }}>{fee.description}</p>
                  )}
                </div>
                <p className="font-black shrink-0" style={{ color: accent(isDark) }}>
                  {formatMoney(fee.amount, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScopeOfWorksCard rows={scopeOfWorks} currency={currency} dark={isDark} />

      <ConstraintsCard constraints={constraints} dark={isDark} />

      {risks.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<NotifExclamation className="w-4 h-4 inline mr-1.5" />} title="RISKS" dark={isDark} />
          <div className="space-y-2">
            {risks.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge color={PRIORITY_COLORS[(r.probability || 'low').toLowerCase()] || '#2563EB'}>
                  {r.probability || 'low'}
                </Badge>
                <div>
                  <p className="font-bold" style={{ color: heading(isDark) }}>{r.risk}</p>
                  <p className="text-[10px]" style={{ color: muted(isDark) }}>
                    Impact: {r.impact} — {r.mitigation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assumptions.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<StatCheckCircle className="w-4 h-4 inline mr-1.5" />} title="ASSUMPTIONS" dark={isDark} />
          <ul className="space-y-1.5">
            {assumptions.slice(0, 8).map((a, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: muted(isDark) }}>
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API #1 — Floor Plan Analysis results (sections list)
// ---------------------------------------------------------------------------

export function FloorPlanAnalysisPanel({
  result,
  isDark,
  selectedSectionId,
  onSelectSection,
}: PanelProps & {
  result: FloorPlanAnalyzeResult;
  selectedSectionId?: string | null;
  onSelectSection?: (section: FloorPlanSection) => void;
}) {
  const summary = result.summary;
  const pages = result.pages || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Confidence"
          value={result.confidenceScore !== undefined ? `${result.confidenceScore}%` : '—'}
          dark={isDark}
        />
        <StatTile label="Rooms" value={formatNumber(summary?.totalRooms)} dark={isDark} />
        <StatTile label="Corridors" value={formatNumber(summary?.totalCorridors)} dark={isDark} />
        <StatTile
          label="Total Area"
          value={formatNumber(summary?.totalArea, 1)}
          sub={summary?.unit || 'sqm'}
          dark={isDark}
        />
      </div>

      {pages.map((page, pageIndex) => {
        const buckets: { title: string; items: FloorPlanSection[] | undefined }[] = [
          { title: 'Rooms / Sections', items: page.sections },
          { title: 'Corridors', items: page.corridors },
          { title: 'Vertical Circulation', items: page.verticalCirculation },
          { title: 'Utility Areas', items: page.utilityAreas },
        ];
        const hasAny = buckets.some(b => b.items && b.items.length > 0);

        return (
          <div key={pageIndex} style={cardStyle(isDark)}>
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5"
              style={{ color: accent(isDark) }}
            >
              <StatBuilding className="w-4 h-4" />
              PAGE {page.pageNumber}
              {page.floorNumber !== undefined ? ` · FLOOR ${page.floorNumber}` : ''}
              {page.dimensions?.width
                ? ` · ${page.dimensions.width} × ${page.dimensions.height} ${page.dimensions.unit || ''}`
                : ''}
            </p>

            {!hasAny && (
              <p className="text-xs" style={{ color: muted(isDark) }}>
                No sections detected on this page.
              </p>
            )}

            {buckets.map(bucket =>
              (bucket.items || []).length > 0 ? (
                <div key={bucket.title} className="mb-3 last:mb-0">
                  <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: muted(isDark) }}>
                    {bucket.title} ({bucket.items!.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {bucket.items!.map((section, sectionIndex) => (
                      <SectionCard
                        key={`${section.sectionId}-${pageIndex}-${bucket.title}-${sectionIndex}`}
                        section={section}
                        dark={isDark}
                        selected={section.sectionId === selectedSectionId}
                        onClick={onSelectSection ? () => onSelectSection(section) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SectionCard({
  section,
  dark,
  selected,
  onClick,
}: {
  section: FloorPlanSection;
  dark?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const confidence =
    section.confidence !== undefined
      ? section.confidence <= 1
        ? Math.round(section.confidence * 100)
        : Math.round(section.confidence)
      : undefined;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="w-full text-left p-3 rounded-xl border-2 transition-all"
      style={{
        borderColor: selected
          ? '#3B82F6'
          : dark
            ? '#1E293B'
            : '#E2E8F0',
        background: selected
          ? dark
            ? 'rgba(37,99,235,0.2)'
            : 'rgba(59,130,246,0.08)'
          : dark
            ? '#0F172A'
            : '#FAFAFA',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black truncate" style={{ color: heading(dark) }}>
            {section.label || section.sectionId}
          </p>
          <p className="text-[10px] font-semibold" style={{ color: muted(dark) }}>
            {section.type}
            {section.subType ? ` / ${section.subType}` : ''}
            {section.area !== undefined
              ? ` · ${formatNumber(section.area, 1)} ${section.unit || 'sqm'}`
              : ''}
          </p>
        </div>
        {confidence !== undefined && (
          <Badge color={confidence >= 80 ? '#059669' : confidence >= 60 ? '#D97706' : '#DC2626'}>
            {confidence}%
          </Badge>
        )}
      </div>
      {Array.isArray(section.annotations) && section.annotations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {section.annotations.slice(0, 4).map((ann, i) => (
            <span
              key={i}
              className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: dark ? 'rgba(148,163,184,0.15)' : '#F1F5F9',
                color: muted(dark),
              }}
            >
              {ann}
            </span>
          ))}
        </div>
      )}
      {selected && (
        <div className="mt-1.5">
          <Badge color="#3B82F6">
            <Check className="w-2.5 h-2.5" /> SELECTED
          </Badge>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API #2 — Section Requirements Extraction results
// ---------------------------------------------------------------------------

export function SectionRequirementsPanel({
  result,
  isDark,
  editable = false,
  onChange,
}: PanelProps & {
  result: SectionRequirementsResult;
  /** Adds an Edit/Done toggle so the SYSTEM REQUIREMENTS block becomes inputs. */
  editable?: boolean;
  /** Receives the updated result on every edit — the caller stores it. */
  onChange?: (next: SectionRequirementsResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const requirements = result.requirements || {};
  const canEdit = editable && typeof onChange === 'function';
  const updateEntry = (key: string, patch: Partial<SectionRequirementEntry>) => {
    onChange?.({
      ...result,
      requirements: { ...requirements, [key]: { ...requirements[key], ...patch } },
    });
  };
  const reqEntries = Object.entries(requirements).filter(
    ([, value]) => value && typeof value === 'object'
  );
  const labor = result.laborEstimates;
  const materials = result.materialSummary;
  const compliance = result.compliance;
  const recommendations = result.recommendations || [];
  const manpower = result.manpower || [];
  const materialItems = result.materials || [];
  const scopeOfWorks = result.scopeOfWorks || [];
  const constraints = result.constraints;
  const currency = materials?.currency || 'PHP';
  const activeEdit = canEdit && editing;
  const displayTotalHours = manpower.length
    ? manpower.reduce(
        (sum, row) => sum + (Number(row.hours) || 0) * (Number(row.headcount) || 0),
        0
      )
    : labor?.totalHours;

  const cellInputCls = 'w-full px-2 py-1 rounded-lg text-[10px] font-semibold outline-none';
  const cellInputStyle = {
    background: isDark ? '#0F172A' : '#FFFFFF',
    border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
    color: heading(isDark),
  };

  // Form-row editors — active only while the Edit toggle is on.
  const emit = (patch: Partial<SectionRequirementsResult>) => {
    onChange?.({ ...result, ...patch });
  };

  const updateManpowerRow = (i: number, patch: Partial<FormManpowerRow>) => {
    emit({
      manpower: manpower.map((row, idx) => {
        if (idx !== i) return row;
        const merged = { ...row, ...patch };
        return {
          ...merged,
          totalCost: (Number(merged.dayRate) || 0) * (Number(merged.manDays) || 0),
        };
      }),
    });
  };
  const removeManpowerRow = (i: number) =>
    emit({ manpower: manpower.filter((_, idx) => idx !== i) });
  const addManpowerRow = () =>
    emit({
      manpower: [
        ...manpower,
        {
          role: 'Technician',
          headcount: 1,
          hours: 8,
          manDays: 1,
          dayRate: 1200,
          totalCost: 1200,
          responsibilities: '',
        },
      ],
    });

  const setCrewCount = (role: string, count: number) =>
    emit({
      laborEstimates: { ...labor, crewMix: { ...(labor?.crewMix || {}), [role]: count } },
    });
  const renameCrewRole = (from: string, to: string) => {
    const crewMix: Record<string, number> = {};
    Object.entries(labor?.crewMix || {}).forEach(([role, count]) => {
      crewMix[role === from ? to : role] = count;
    });
    emit({ laborEstimates: { ...labor, crewMix } });
  };
  const removeCrewRole = (role: string) => {
    const crewMix = { ...(labor?.crewMix || {}) };
    delete crewMix[role];
    emit({ laborEstimates: { ...labor, crewMix } });
  };
  const addCrewRole = () =>
    emit({
      laborEstimates: { ...labor, crewMix: { ...(labor?.crewMix || {}), 'New Role': 1 } },
    });

  const materialPatch = (rows: FormMaterialItem[]) => ({
    materials: rows,
    materialSummary: rebuildMaterialSummary(rows, currency),
  });
  const updateMaterialRow = (i: number, patch: Partial<FormMaterialItem>) => {
    const next = materialItems.map((row, idx) => {
      if (idx !== i) return row;
      const merged = { ...row, ...patch };
      const price = Number(merged.unitPrice ?? merged.srp) || 0;
      const qty = Number(merged.quantity) || 0;
      return {
        ...merged,
        srp: price,
        unitPrice: price,
        contractorPrice: Math.round(price * 0.85),
        dealerPrice: Math.round(price * 0.75),
        totalPrice: Math.round(price * qty),
      };
    });
    emit(materialPatch(next));
  };
  const removeMaterialRow = (i: number) =>
    emit(materialPatch(materialItems.filter((_, idx) => idx !== i)));
  const addMaterialRow = () =>
    emit(
      materialPatch([
        ...materialItems,
        {
          name: '',
          category: 'Hardware',
          brand: '',
          quantity: 1,
          unit: 'pcs',
          srp: 0,
          unitPrice: 0,
          contractorPrice: 0,
          dealerPrice: 0,
          totalPrice: 0,
          source: 'market',
        },
      ])
    );

  const updateRecommendation = (
    i: number,
    patch: { priority?: string; system?: string; action?: string; estimatedCost?: number }
  ) =>
    emit({
      recommendations: recommendations.map((rec, idx) =>
        idx === i ? { ...rec, ...patch } : rec
      ),
    });
  const removeRecommendation = (i: number) =>
    emit({ recommendations: recommendations.filter((_, idx) => idx !== i) });
  const addRecommendation = () =>
    emit({
      recommendations: [
        ...recommendations,
        { priority: 'medium', system: 'general', action: '', estimatedCost: 0 },
      ],
    });

  const updateGap = (
    i: number,
    patch: { system?: string; requirement?: string; status?: string; recommendation?: string }
  ) => {
    const base = result.compliance || {};
    emit({
      compliance: {
        ...base,
        gaps: (base.gaps || []).map((gap, idx) => (idx === i ? { ...gap, ...patch } : gap)),
      },
    });
  };
  const removeGap = (i: number) => {
    const base = result.compliance || {};
    emit({
      compliance: { ...base, gaps: (base.gaps || []).filter((_, idx) => idx !== i) },
    });
  };
  const setOverallCompliance = (raw: string) => {
    const base = result.compliance || {};
    emit({
      compliance: { ...base, overallCompliance: Math.max(0, Math.min(100, Number(raw) || 0)) },
    });
  };

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold" style={{ color: muted(isDark) }}>
            {editing
              ? 'Editing — the changes are stored with the estimate.'
              : 'Materials, labor, scope, constraints and recommendations are editable.'}
          </p>
          <button
            type="button"
            onClick={() => setEditing(v => !v)}
            className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: editing ? 'rgba(5,150,105,0.12)' : 'rgba(37,99,235,0.12)',
              color: editing ? '#059669' : isDark ? '#93C5FD' : '#1D4ED8',
            }}
          >
            {editing ? 'Done' : 'Edit requirements'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Confidence"
          value={result.confidenceScore !== undefined ? `${result.confidenceScore}%` : '—'}
          dark={isDark}
        />
        <StatTile
          label="Section"
          value={result.sectionType || '—'}
          sub={result.sectionLabel}
          dark={isDark}
        />
        <StatTile
          label="Labor Hours"
          value={formatNumber(displayTotalHours)}
          sub="total"
          dark={isDark}
        />
        <StatTile
          label="Materials"
          value={formatMoney(materials?.totalEstimatedCost, currency)}
          sub={currency}
          dark={isDark}
        />
      </div>

      {reqEntries.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<SysShield className="w-4 h-4 inline mr-1.5" />} title="SYSTEM REQUIREMENTS" dark={isDark} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reqEntries.map(([key, value]) => {
              const standards = Array.isArray(value.standards) ? value.standards : [];
              const codeRefs = Array.isArray(value.codeReferences) ? value.codeReferences : [];
              const specs =
                typeof value.coverage === 'string' ? value.coverage : undefined;
              return (
                <div
                  key={key}
                  className="p-3 rounded-xl"
                  style={{
                    background: isDark ? '#0F172A' : '#F8FAFC',
                    border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-black" style={{ color: heading(isDark) }}>
                      {SYSTEM_KEY_LABELS[key] || key}
                    </p>
                    {editing ? (
                      <button
                        type="button"
                        onClick={() => updateEntry(key, { required: value.required === false })}
                        className="cursor-pointer"
                        title="Toggle required / optional"
                      >
                        <Badge color={value.required === false ? '#64748B' : '#059669'}>
                          {value.required === false ? 'optional' : 'required'}
                        </Badge>
                      </button>
                    ) : (
                      <Badge color={value.required === false ? '#64748B' : '#059669'}>
                        {value.required === false ? 'optional' : 'required'}
                      </Badge>
                    )}
                  </div>

                  {editing ? (
                    <div className="space-y-1.5 mb-1">
                      <input
                        type="text"
                        value={typeof value.coverage === 'string' ? value.coverage : ''}
                        onChange={e => updateEntry(key, { coverage: e.target.value })}
                        placeholder="Coverage / specification"
                        className="w-full px-2 py-1.5 rounded-lg text-[10px] font-semibold outline-none"
                        style={{
                          background: isDark ? '#0F172A' : '#FFFFFF',
                          border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                          color: heading(isDark),
                        }}
                      />
                      {value.cameraCount !== undefined && (
                        <label className="flex items-center gap-2 text-[10px]" style={{ color: muted(isDark) }}>
                          Cameras
                          <input
                            type="number"
                            min={0}
                            value={Number(value.cameraCount) || 0}
                            onChange={e =>
                              updateEntry(key, { cameraCount: Math.max(0, Number(e.target.value) || 0) })
                            }
                            className="w-20 px-2 py-1 rounded-lg text-[10px] font-semibold outline-none"
                            style={{
                              background: isDark ? '#0F172A' : '#FFFFFF',
                              border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                              color: heading(isDark),
                            }}
                          />
                        </label>
                      )}
                      {standards.length > 0 && (
                        <input
                          type="text"
                          value={standards.join(', ')}
                          onChange={e =>
                            updateEntry(key, {
                              standards: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Standards, comma-separated"
                          className="w-full px-2 py-1.5 rounded-lg text-[10px] outline-none"
                          style={{
                            background: isDark ? '#0F172A' : '#FFFFFF',
                            border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                            color: heading(isDark),
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      {specs && (
                        <p className="text-[10px] mb-1" style={{ color: muted(isDark) }}>
                          {specs}
                          {value.cameraCount !== undefined ? ` · ${value.cameraCount} cameras` : ''}
                        </p>
                      )}
                      {standards.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {standards.slice(0, 4).map((s, i) => (
                            <span
                              key={i}
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(37,99,235,0.12)', color: isDark ? '#93C5FD' : '#1D4ED8' }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {codeRefs.length > 0 && (
                    <p className="text-[9px] mt-1 font-semibold" style={{ color: muted(isDark) }}>
                      Codes: {codeRefs.slice(0, 3).join(', ')}
                      {codeRefs.length > 3 ? ` +${codeRefs.length - 3}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {manpower.length > 0 && (
        <div style={cardStyle(isDark)}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: accent(isDark) }}
            >
              <Users className="w-4 h-4 inline mr-1.5" />
              MANPOWER (FORM ROWS)
            </p>
            {activeEdit && (
              <button
                type="button"
                onClick={addManpowerRow}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                style={{ background: 'rgba(37,99,235,0.12)', color: isDark ? '#93C5FD' : '#1D4ED8' }}
              >
                + Add row
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider" style={{ color: muted(isDark) }}>
                  <th className="pb-2 pr-3 font-bold">Role</th>
                  <th className="pb-2 pr-3 font-bold">Headcount</th>
                  <th className="pb-2 pr-3 font-bold">Hrs/Person</th>
                  <th className="pb-2 pr-3 font-bold">Man-Days</th>
                  <th className="pb-2 pr-3 font-bold">Day Rate</th>
                  <th className="pb-2 pr-3 font-bold">Total Cost</th>
                  {activeEdit && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody>
                {manpower.map((m, i) => (
                  <tr key={i} className="text-xs" style={{ color: heading(isDark), borderTop: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}` }}>
                    {activeEdit ? (
                      <>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={m.role || ''}
                            onChange={e => updateManpowerRow(i, { role: e.target.value })}
                            className={cellInputCls}
                            style={cellInputStyle}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            value={m.headcount ?? 0}
                            onChange={e => updateManpowerRow(i, { headcount: Number(e.target.value) || 0 })}
                            className={cellInputCls}
                            style={cellInputStyle}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            value={m.hours ?? 0}
                            onChange={e => updateManpowerRow(i, { hours: Number(e.target.value) || 0 })}
                            className={cellInputCls}
                            style={cellInputStyle}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            value={m.manDays ?? 0}
                            onChange={e => updateManpowerRow(i, { manDays: Number(e.target.value) || 0 })}
                            className={cellInputCls}
                            style={cellInputStyle}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            value={m.dayRate ?? 0}
                            onChange={e => updateManpowerRow(i, { dayRate: Number(e.target.value) || 0 })}
                            className={cellInputCls}
                            style={cellInputStyle}
                          />
                        </td>
                        <td className="py-2 pr-3 font-black">
                          {formatMoney(m.totalCost, currency)}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeManpowerRow(i)}
                            aria-label="Remove manpower row"
                            className="w-6 h-6 rounded-full text-[10px] font-black cursor-pointer"
                            style={{ background: isDark ? '#1E293B' : '#FFFFFF', color: '#DC2626' }}
                          >
                            ✕
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-3 font-bold">{m.role || 'Technician'}</td>
                        <td className="py-2 pr-3">{m.headcount}</td>
                        <td className="py-2 pr-3">{formatNumber(m.hours)}</td>
                        <td className="py-2 pr-3">{formatNumber(m.manDays)}</td>
                        <td className="py-2 pr-3">{m.dayRate ? formatMoney(m.dayRate, currency) : '—'}</td>
                        <td className="py-2 pr-3 font-bold">{m.totalCost ? formatMoney(m.totalCost, currency) : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {labor && manpower.length === 0 && (labor.totalHours !== undefined || Object.keys(labor.crewMix || {}).length > 0) && (
        <div style={cardStyle(isDark)}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: accent(isDark) }}
            >
              <RoleWrench className="w-4 h-4 inline mr-1.5" />
              LABOR ESTIMATES
            </p>
            {activeEdit && (
              <button
                type="button"
                onClick={addCrewRole}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                style={{ background: 'rgba(37,99,235,0.12)', color: isDark ? '#93C5FD' : '#1D4ED8' }}
              >
                + Add crew
              </button>
            )}
          </div>
          {activeEdit ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold" style={{ color: muted(isDark) }}>
                Total hours
                <input
                  type="number"
                  min={0}
                  value={labor.totalHours ?? 0}
                  onChange={e =>
                    emit({ laborEstimates: { ...labor, totalHours: Number(e.target.value) || 0 } })
                  }
                  className={`${cellInputCls} w-24`}
                  style={cellInputStyle}
                />
              </label>
              {Object.entries(labor.crewMix || {}).map(([role, count], idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={role}
                    onChange={e => renameCrewRole(role, e.target.value)}
                    className={`${cellInputCls} w-40`}
                    style={cellInputStyle}
                  />
                  <input
                    type="number"
                    min={0}
                    value={count}
                    onChange={e => setCrewCount(role, Number(e.target.value) || 0)}
                    className={`${cellInputCls} w-20`}
                    style={cellInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => removeCrewRole(role)}
                    aria-label="Remove crew role"
                    className="shrink-0 w-6 h-6 rounded-full text-[10px] font-black cursor-pointer"
                    style={{ background: isDark ? '#1E293B' : '#FFFFFF', color: '#DC2626' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(labor.crewMix || {}).map(([role, count]) => (
                <span
                  key={role}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                  style={{
                    background: isDark ? 'rgba(37,99,235,0.2)' : 'rgba(30,58,138,0.06)',
                    color: isDark ? '#93C5FD' : '#1E3A8A',
                    border: `1px solid ${isDark ? 'rgba(37,99,235,0.4)' : 'rgba(30,58,138,0.1)'}`,
                  }}
                >
                  {role} × {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(materialItems.length > 0 || activeEdit) && (
        <div style={cardStyle(isDark)}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: accent(isDark) }}
            >
              <Package className="w-4 h-4 inline mr-1.5" />
              MATERIAL ITEMS
            </p>
            {activeEdit && (
              <button
                type="button"
                onClick={addMaterialRow}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                style={{ background: 'rgba(37,99,235,0.12)', color: isDark ? '#93C5FD' : '#1D4ED8' }}
              >
                + Add material
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(activeEdit ? materialItems : materialItems.slice(0, 12)).map((item, i) =>
              activeEdit ? (
                <div
                  key={i}
                  className="p-2 rounded-xl space-y-1.5"
                  style={{
                    background: isDark ? '#0F172A' : '#F8FAFC',
                    border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name || item.description || ''}
                      onChange={e => updateMaterialRow(i, { name: e.target.value })}
                      placeholder="Item name"
                      className={`${cellInputCls} flex-1`}
                      style={cellInputStyle}
                    />
                    <input
                      type="text"
                      value={item.brand || ''}
                      onChange={e => updateMaterialRow(i, { brand: e.target.value })}
                      placeholder="Brand"
                      className={`${cellInputCls} w-28`}
                      style={cellInputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeMaterialRow(i)}
                      aria-label="Remove material"
                      className="shrink-0 w-6 h-6 rounded-full text-[10px] font-black cursor-pointer"
                      style={{ background: isDark ? '#1E293B' : '#FFFFFF', color: '#DC2626' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: muted(isDark) }}>
                    <input
                      type="number"
                      min={0}
                      value={item.quantity ?? 0}
                      onChange={e => updateMaterialRow(i, { quantity: Number(e.target.value) || 0 })}
                      title="Quantity"
                      className={`${cellInputCls} w-20`}
                      style={cellInputStyle}
                    />
                    <input
                      type="text"
                      value={item.unit || ''}
                      onChange={e => updateMaterialRow(i, { unit: e.target.value })}
                      title="Unit"
                      className={`${cellInputCls} w-16`}
                      style={cellInputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice ?? item.srp ?? 0}
                      onChange={e => updateMaterialRow(i, { unitPrice: Number(e.target.value) || 0 })}
                      title="Unit price"
                      className={`${cellInputCls} w-28`}
                      style={cellInputStyle}
                    />
                    <span className="font-black ml-auto shrink-0" style={{ color: accent(isDark) }}>
                      {formatMoney(item.totalPrice, currency)}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 text-xs"
                  style={{ borderTop: i > 0 ? `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}` : undefined }}
                >
                  <div className="min-w-0">
                    <p className="font-bold" style={{ color: heading(isDark) }}>
                      {item.name || item.description || 'Material'}
                      {item.brand ? ` · ${item.brand}` : ''}
                    </p>
                    <p className="text-[10px]" style={{ color: muted(isDark) }}>
                      {formatNumber(item.quantity)} {item.unit || 'unit'} @ {formatMoney(item.unitPrice || item.srp, currency)}
                      {' · '}
                      <span style={{ color: isDark ? '#93C5FD' : '#1D4ED8' }}>
                        Contractor {formatMoney(item.contractorPrice, currency)} · Dealer {formatMoney(item.dealerPrice, currency)}
                      </span>
                    </p>
                  </div>
                  <p className="font-black shrink-0" style={{ color: accent(isDark) }}>
                    {formatMoney(item.totalPrice, currency)}
                  </p>
                </div>
              )
            )}
            {!activeEdit && materialItems.length > 12 && (
              <p className="text-[10px]" style={{ color: muted(isDark) }}>
                +{materialItems.length - 12} more items applied to the form
              </p>
            )}
            {activeEdit && materialItems.length === 0 && (
              <p className="text-[10px]" style={{ color: muted(isDark) }}>
                No materials yet — add the first one.
              </p>
            )}
          </div>
        </div>
      )}

      {materials && materials.categories && materials.categories.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<Truck className="w-4 h-4 inline mr-1.5" />} title="MATERIAL SUMMARY" dark={isDark} />
          <div className="space-y-2">
            {materials.categories.map((cat, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold" style={{ color: heading(isDark) }}>{cat.category}</p>
                  <p className="text-[10px]" style={{ color: muted(isDark) }}>{cat.itemCount} items</p>
                </div>
                <p className="font-black shrink-0" style={{ color: accent(isDark) }}>
                  {formatMoney(cat.estimatedCost, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {compliance && (compliance.overallCompliance !== undefined || (compliance.gaps || []).length > 0 || activeEdit) && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<NotifExclamation className="w-4 h-4 inline mr-1.5" />} title="COMPLIANCE" dark={isDark} />
          {(compliance.overallCompliance !== undefined || activeEdit) && (
            <div className="mb-3 flex items-center gap-2">
              <Badge color={compliance.overallCompliance !== undefined && compliance.overallCompliance >= 80 ? '#059669' : compliance.overallCompliance !== undefined && compliance.overallCompliance >= 60 ? '#D97706' : '#DC2626'}>
                {compliance.overallCompliance !== undefined ? compliance.overallCompliance : 0}% compliant
              </Badge>
              {activeEdit && (
                <label className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: muted(isDark) }}>
                  Overall
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={compliance.overallCompliance ?? 0}
                    onChange={e => setOverallCompliance(e.target.value)}
                    className={`${cellInputCls} w-20`}
                    style={cellInputStyle}
                  />
                </label>
              )}
            </div>
          )}
          <div className="space-y-2">
            {(activeEdit ? compliance.gaps || [] : (compliance.gaps || []).slice(0, 6)).map((gap, i) =>
              activeEdit ? (
                <div
                  key={i}
                  className="p-2 rounded-xl space-y-1.5 text-xs"
                  style={{
                    background: isDark ? '#0F172A' : '#F8FAFC',
                    border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={gap.system || ''}
                      onChange={e => updateGap(i, { system: e.target.value })}
                      placeholder="System"
                      className={`${cellInputCls} w-32`}
                      style={cellInputStyle}
                    />
                    <select
                      value={gap.status || 'missing'}
                      onChange={e => updateGap(i, { status: e.target.value })}
                      className={`${cellInputCls} w-28`}
                      style={cellInputStyle}
                    >
                      <option value="missing">missing</option>
                      <option value="partial">partial</option>
                      <option value="compliant">compliant</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeGap(i)}
                      aria-label="Remove compliance gap"
                      className="shrink-0 w-6 h-6 rounded-full text-[10px] font-black cursor-pointer"
                      style={{ background: isDark ? '#1E293B' : '#FFFFFF', color: '#DC2626' }}
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={gap.requirement || ''}
                    onChange={e => updateGap(i, { requirement: e.target.value })}
                    placeholder="Requirement"
                    className={cellInputCls}
                    style={cellInputStyle}
                  />
                  <input
                    type="text"
                    value={gap.recommendation || ''}
                    onChange={e => updateGap(i, { recommendation: e.target.value })}
                    placeholder="Recommendation"
                    className={cellInputCls}
                    style={cellInputStyle}
                  />
                </div>
              ) : (
                <div key={i} className="text-xs">
                  <p className="font-bold" style={{ color: heading(isDark) }}>
                    {SYSTEM_KEY_LABELS[gap.system || ''] || gap.system} — {gap.requirement}
                  </p>
                  <p className="text-[10px]" style={{ color: muted(isDark) }}>
                    {gap.status}: {gap.recommendation}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {(recommendations.length > 0 || activeEdit) && (
        <div style={cardStyle(isDark)}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: accent(isDark) }}
            >
              <StatCheckCircle className="w-4 h-4 inline mr-1.5" />
              RECOMMENDATIONS
            </p>
            {activeEdit && (
              <button
                type="button"
                onClick={addRecommendation}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                style={{ background: 'rgba(37,99,235,0.12)', color: isDark ? '#93C5FD' : '#1D4ED8' }}
              >
                + Add recommendation
              </button>
            )}
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, i) =>
              activeEdit ? (
                <div
                  key={i}
                  className="p-2 rounded-xl space-y-1.5 text-xs"
                  style={{
                    background: isDark ? '#0F172A' : '#F8FAFC',
                    border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={(rec.priority || 'medium').toLowerCase()}
                      onChange={e => updateRecommendation(i, { priority: e.target.value })}
                      className={`${cellInputCls} w-28`}
                      style={cellInputStyle}
                    >
                      <option value="critical">critical</option>
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                    <input
                      type="text"
                      value={rec.system || ''}
                      onChange={e => updateRecommendation(i, { system: e.target.value })}
                      placeholder="System"
                      className={`${cellInputCls} w-32`}
                      style={cellInputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      value={rec.estimatedCost ?? 0}
                      onChange={e => updateRecommendation(i, { estimatedCost: Number(e.target.value) || 0 })}
                      title="Estimated cost"
                      className={`${cellInputCls} w-28`}
                      style={cellInputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeRecommendation(i)}
                      aria-label="Remove recommendation"
                      className="shrink-0 w-6 h-6 rounded-full text-[10px] font-black cursor-pointer"
                      style={{ background: isDark ? '#1E293B' : '#FFFFFF', color: '#DC2626' }}
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rec.action || ''}
                    onChange={e => updateRecommendation(i, { action: e.target.value })}
                    placeholder="Recommended action"
                    className={cellInputCls}
                    style={cellInputStyle}
                  />
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge color={PRIORITY_COLORS[(rec.priority || 'low').toLowerCase()] || '#2563EB'}>
                    {rec.priority || 'low'}
                  </Badge>
                  <div>
                    <p className="font-bold" style={{ color: heading(isDark) }}>{rec.action}</p>
                    <p className="text-[10px]" style={{ color: muted(isDark) }}>
                      {SYSTEM_KEY_LABELS[rec.system || ''] || rec.system}
                      {rec.estimatedCost !== undefined ? ` · ${formatMoney(rec.estimatedCost, currency)}` : ''}
                    </p>
                  </div>
                </div>
              )
            )}
            {activeEdit && recommendations.length === 0 && (
              <p className="text-[10px]" style={{ color: muted(isDark) }}>
                No recommendations yet — add the first one.
              </p>
            )}
          </div>
        </div>
      )}

      <ScopeOfWorksCard
        rows={scopeOfWorks}
        currency={currency}
        dark={isDark}
        editable={activeEdit}
        onChange={rows => emit({ scopeOfWorks: rows })}
      />

      <ConstraintsCard
        constraints={constraints}
        dark={isDark}
        editable={activeEdit}
        onChange={next => emit({ constraints: next })}
      />
    </div>
  );
}
