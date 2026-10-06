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
  FormScopeRow,
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

/** Numbered work items — shown by both the API #2 and API #3 result panels. */
function ScopeOfWorksCard({
  rows,
  currency,
  dark,
}: {
  rows: FormScopeRow[];
  currency: string;
  dark?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div style={cardStyle(dark)}>
      <PanelHeading icon={<StatClipboard className="w-4 h-4 inline mr-1.5" />} title="SCOPE OF WORKS" dark={dark} />
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.itemNumber ?? i}
            className="flex items-start justify-between gap-3 text-xs"
            style={{ borderTop: i > 0 ? `1px solid ${dark ? '#1E293B' : '#F1F5F9'}` : undefined }}
          >
            <div className="flex items-start gap-2 min-w-0">
              <Badge color="#3B82F6">#{row.itemNumber ?? i + 1}</Badge>
              <div className="min-w-0">
                <p className="font-semibold" style={{ color: heading(dark) }}>{row.description}</p>
                <p className="text-[10px]" style={{ color: muted(dark) }}>{row.unit || '1 LOT'}</p>
              </div>
            </div>
            <p className="font-black shrink-0" style={{ color: accent(dark) }}>
              {row.totalPrice ? formatMoney(row.totalPrice, currency) : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Physical / electrical / installation notes — shown by both result panels. */
function ConstraintsCard({
  constraints,
  dark,
}: {
  constraints?: FormConstraints;
  dark?: boolean;
}) {
  const blocks: [string, string | undefined][] = [
    ['Physical', constraints?.physical],
    ['Electrical', constraints?.electrical],
    ['Installation', constraints?.installation],
  ];
  const filled = blocks.filter(([, value]) => value && String(value).trim());
  if (!filled.length) return null;

  return (
    <div style={cardStyle(dark)}>
      <PanelHeading icon={<StatPin className="w-4 h-4 inline mr-1.5" />} title="SITE CONSTRAINTS" dark={dark} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filled.map(([label, value]) => (
          <div
            key={label}
            className="p-3 rounded-xl"
            style={{
              background: dark ? '#0F172A' : '#F8FAFC',
              border: `1px solid ${dark ? '#1E293B' : '#E2E8F0'}`,
            }}
          >
            <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: muted(dark) }}>
              {label}
            </p>
            <p className="text-xs" style={{ color: heading(dark) }}>{value}</p>
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
}: PanelProps & { result: SectionRequirementsResult }) {
  const requirements = result.requirements || {};
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

  return (
    <div className="space-y-5">
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
          value={formatNumber(labor?.totalHours)}
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
                    <Badge color={value.required === false ? '#64748B' : '#059669'}>
                      {value.required === false ? 'optional' : 'required'}
                    </Badge>
                  </div>
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
          <PanelHeading icon={<Users className="w-4 h-4 inline mr-1.5" />} title="MANPOWER (FORM ROWS)" dark={isDark} />
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
                    <td className="py-2 pr-3 font-bold">{m.role || 'Technician'}</td>
                    <td className="py-2 pr-3">{m.headcount}</td>
                    <td className="py-2 pr-3">{formatNumber(m.hours)}</td>
                    <td className="py-2 pr-3">{formatNumber(m.manDays)}</td>
                    <td className="py-2 pr-3">{m.dayRate ? formatMoney(m.dayRate, currency) : '—'}</td>
                    <td className="py-2 pr-3 font-bold">{m.totalCost ? formatMoney(m.totalCost, currency) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {labor && manpower.length === 0 && (labor.totalHours !== undefined || Object.keys(labor.crewMix || {}).length > 0) && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<RoleWrench className="w-4 h-4 inline mr-1.5" />} title="LABOR ESTIMATES" dark={isDark} />
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
        </div>
      )}

      {materialItems.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<Package className="w-4 h-4 inline mr-1.5" />} title="MATERIAL ITEMS" dark={isDark} />
          <div className="space-y-2">
            {materialItems.slice(0, 12).map((item, i) => (
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
            ))}
            {materialItems.length > 12 && (
              <p className="text-[10px]" style={{ color: muted(isDark) }}>
                +{materialItems.length - 12} more items applied to the form
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

      {compliance && (compliance.overallCompliance !== undefined || (compliance.gaps || []).length > 0) && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<NotifExclamation className="w-4 h-4 inline mr-1.5" />} title="COMPLIANCE" dark={isDark} />
          {compliance.overallCompliance !== undefined && (
            <div className="mb-3">
              <Badge color={compliance.overallCompliance >= 80 ? '#059669' : compliance.overallCompliance >= 60 ? '#D97706' : '#DC2626'}>
                {compliance.overallCompliance}% compliant
              </Badge>
            </div>
          )}
          <div className="space-y-2">
            {(compliance.gaps || []).slice(0, 6).map((gap, i) => (
              <div key={i} className="text-xs">
                <p className="font-bold" style={{ color: heading(isDark) }}>
                  {SYSTEM_KEY_LABELS[gap.system || ''] || gap.system} — {gap.requirement}
                </p>
                <p className="text-[10px]" style={{ color: muted(isDark) }}>
                  {gap.status}: {gap.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div style={cardStyle(isDark)}>
          <PanelHeading icon={<StatCheckCircle className="w-4 h-4 inline mr-1.5" />} title="RECOMMENDATIONS" dark={isDark} />
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
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
            ))}
          </div>
        </div>
      )}

      <ScopeOfWorksCard rows={scopeOfWorks} currency={currency} dark={isDark} />

      <ConstraintsCard constraints={constraints} dark={isDark} />
    </div>
  );
}
