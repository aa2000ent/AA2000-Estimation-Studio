import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project } from '../../App';
import { useToast } from '../utils/Toast';
import { exportBOQPdf } from '../../utils/pdfExporter';

export interface SavedEstimation {
  key: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  clientName?: string;
  location?: string;
  startDate?: string;
  createdAt?: string;
  dbProjId?: number;
  manpower: { role: string; headcount: number; hours: number; dayRate: number; totalCost: number; manDays: number }[];
  consumables: { name: string; category: string; quantity: number; unit?: string; unitPrice: number; totalPrice: number }[];
  fees: { type: string; amount: number; description: string }[];
  constraints: { physical: string; electrical: string; installation: string };
  priceTier: 'srp' | 'contractorPrice' | 'dealerPrice';
}

export type StatusCategory = 'pending' | 'approved' | 'finalized' | 'rejected' | 'other';

/**
 * Normalizes project status into one of the core categories:
 * - pending: Waiting for approval, in progress, open
 * - approved: Approved, finalized-approved, completed
 * - finalized: Finalized, TO-VALIDATE
 * - rejected: Finalized-rejected, rejected
 */
export function categorizeStatus(statusRaw: string): StatusCategory {
  const s = (statusRaw || '').trim().toLowerCase();
  if (s.includes('reject')) return 'rejected';
  if (s.includes('approved') || s === 'completed' || s === 'done') return 'approved';
  if (s === 'finalized' || s.includes('to-validate') || s.includes('validate')) return 'finalized';
  if (s.includes('pending') || s.includes('progress') || s === 'open') return 'pending';
  return 'other';
}

export const STATUS_THEMES: Record<
  StatusCategory,
  {
    label: string;
    cardBorder: string;
    leftStripe: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotBg: string;
    iconBg: string;
    iconColor: string;
    headerHighlight: string;
  }
> = {
  pending: {
    label: 'Pending',
    cardBorder: 'border-amber-200/90 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-600',
    leftStripe: 'border-l-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800/60',
    dotBg: 'bg-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    headerHighlight: 'bg-gradient-to-r from-amber-50/50 via-white to-white dark:from-amber-950/25 dark:via-[#131B2E] dark:to-[#131B2E]',
  },
  approved: {
    label: 'Approved',
    cardBorder: 'border-emerald-200/90 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-600',
    leftStripe: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    dotBg: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    headerHighlight: 'bg-gradient-to-r from-emerald-50/50 via-white to-white dark:from-emerald-950/25 dark:via-[#131B2E] dark:to-[#131B2E]',
  },
  finalized: {
    label: 'Finalized',
    cardBorder: 'border-indigo-200/90 dark:border-indigo-900/40 hover:border-indigo-400 dark:hover:border-indigo-600',
    leftStripe: 'border-l-indigo-500',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800/60',
    dotBg: 'bg-indigo-500',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    headerHighlight: 'bg-gradient-to-r from-indigo-50/50 via-white to-white dark:from-indigo-950/25 dark:via-[#131B2E] dark:to-[#131B2E]',
  },
  rejected: {
    label: 'Rejected',
    cardBorder: 'border-rose-200/90 dark:border-rose-900/40 hover:border-rose-400 dark:hover:border-rose-600',
    leftStripe: 'border-l-rose-500',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800/60',
    dotBg: 'bg-rose-500',
    iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    headerHighlight: 'bg-gradient-to-r from-rose-50/50 via-white to-white dark:from-rose-950/25 dark:via-[#131B2E] dark:to-[#131B2E]',
  },
  other: {
    label: 'Other',
    cardBorder: 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700',
    leftStripe: 'border-l-slate-400 dark:border-l-slate-600',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-700',
    dotBg: 'bg-slate-400',
    iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-400',
    headerHighlight: 'bg-white dark:bg-[#131B2E]',
  },
};

function loadEstimations(projects: Project[], statusFilter?: string[]): SavedEstimation[] {
  const out: SavedEstimation[] = [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const seenProjectIds = new Set<string>();

  // 1. Read stored estimations from localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('aa2000_estimation_')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const projectId = key.replace('aa2000_estimation_', '');
      seenProjectIds.add(projectId);
      const project = projectMap.get(projectId);
      const projectStatus = project?.status || data.projectStatus || 'Pending';
      if (statusFilter && !statusFilter.includes(projectStatus)) continue;
      out.push({
        key,
        projectId,
        projectName: project?.name || data.projectName || `Project ${projectId.slice(0, 8)}`,
        projectStatus,
        clientName: project?.clientName || data.clientName,
        location: project?.location || data.location,
        createdAt: project?.createdAt || data.createdAt,
        startDate: project?.startDate || data.startDate,
        dbProjId: project?.dbProjId,
        ...data,
      });
    } catch {
      /* skip corrupt */
    }
  }

  // 2. Also incorporate projects from projectList if they have a DB row or are tracked projects
  for (const p of projects) {
    if (seenProjectIds.has(p.id)) continue;
    if (p.buildingType === 'Other') continue;
    if (statusFilter && !statusFilter.includes(p.status)) continue;

    out.push({
      key: `aa2000_proj_hist_${p.id}`,
      projectId: p.id,
      projectName: p.name,
      projectStatus: p.status,
      clientName: p.clientName,
      location: p.location,
      createdAt: p.createdAt,
      startDate: p.startDate,
      dbProjId: p.dbProjId,
      manpower: [],
      consumables: [],
      fees: [],
      constraints: { physical: '', electrical: '', installation: '' },
      priceTier: 'srp',
    });
  }

  return out.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

const TIER_LABELS: Record<string, string> = {
  srp: 'SRP',
  contractorPrice: 'Contractor Price',
  dealerPrice: 'Dealer Price',
};

function totalManpower(est: SavedEstimation): number {
  return est.manpower?.reduce((s, m) => s + (m.totalCost || 0), 0) ?? 0;
}
function totalConsumables(est: SavedEstimation): number {
  return est.consumables?.reduce((s, c) => s + (c.totalPrice || 0), 0) ?? 0;
}
function totalFees(est: SavedEstimation): number {
  return est.fees?.reduce((s, f) => s + (f.amount || 0), 0) ?? 0;
}
function grandTotal(est: SavedEstimation): number {
  return totalManpower(est) + totalConsumables(est) + totalFees(est);
}

export default function SavedEstimationsView({
  projects,
  statusFilter,
  onDeleteProject,
}: {
  projects: Project[];
  statusFilter?: string[];
  onDeleteProject?: (projectId: string) => void;
}) {
  const { toast, confirm } = useToast();
  const [estimations, setEstimations] = useState<SavedEstimation[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'pending' | 'approved' | 'finalized' | 'rejected'>('all');
  const [sortOrder, setSortOrder] = useState<'A-Z' | 'Z-A' | 'Newest' | 'Highest Value'>('Newest');
  const [reuseKey, setReuseKey] = useState<string | null>(null);
  const [reuseProjectId, setReuseProjectId] = useState<string>('');

  const refresh = useCallback(
    () => setEstimations(loadEstimations(projects, statusFilter)),
    [projects, statusFilter]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Status counts for quick filters
  const categoryCounts = useMemo(() => {
    const counts = { all: estimations.length, pending: 0, approved: 0, finalized: 0, rejected: 0 };
    estimations.forEach((e) => {
      const cat = categorizeStatus(e.projectStatus);
      if (cat in counts) {
        counts[cat as keyof typeof counts]++;
      }
    });
    return counts;
  }, [estimations]);

  // Filtered and sorted estimations
  const filtered = useMemo(() => {
    return estimations
      .filter((e) => {
        // Category tab filter
        if (activeCategoryTab !== 'all') {
          const cat = categorizeStatus(e.projectStatus);
          if (cat !== activeCategoryTab) return false;
        }

        // Text query filter
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          e.projectName.toLowerCase().includes(q) ||
          (e.clientName && e.clientName.toLowerCase().includes(q)) ||
          (e.location && e.location.toLowerCase().includes(q)) ||
          e.projectStatus.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'A-Z') return a.projectName.localeCompare(b.projectName);
        if (sortOrder === 'Z-A') return b.projectName.localeCompare(a.projectName);
        if (sortOrder === 'Highest Value') return grandTotal(b) - grandTotal(a);
        // Newest
        const timeA = new Date(a.createdAt || a.startDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.startDate || 0).getTime();
        return timeB - timeA;
      });
  }, [estimations, activeCategoryTab, searchQuery, sortOrder]);

  const handleDelete = async (est: SavedEstimation) => {
    const ok = await confirm(
      `Delete saved estimation and project "${est.projectName}"? This cannot be undone.`
    );
    if (!ok) return;

    if (est.key.startsWith('aa2000_estimation_')) {
      localStorage.removeItem(est.key);
    }
    if (onDeleteProject) {
      onDeleteProject(est.projectId);
    }
    refresh();
    toast.success(`"${est.projectName}" removed.`);
    if (expandedKey === est.key) setExpandedKey(null);
  };

  const handleReuse = (est: SavedEstimation) => {
    if (!reuseProjectId) return;
    const key = `aa2000_estimation_${reuseProjectId}`;
    const existing = localStorage.getItem(key);
    const existingData = existing ? JSON.parse(existing) : {};
    const merged = {
      manpower: est.manpower || [],
      consumables: est.consumables || [],
      fees: est.fees || [],
      constraints: est.constraints || { physical: '', electrical: '', installation: '' },
      priceTier: est.priceTier || 'srp',
      ...(existingData.priceTier ? { priceTier: existingData.priceTier } : {}),
    };
    localStorage.setItem(key, JSON.stringify(merged));
    const project = projects.find((p) => p.id === reuseProjectId);
    toast.success(`Estimation copied to "${project?.name || reuseProjectId}"`);
    setReuseKey(null);
    setReuseProjectId('');
  };

  if (estimations.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center min-h-[500px] text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-blue-500 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
          No History or Saved Records
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-sm">
          Completed project estimations and historical proposal archives will automatically be cataloged here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* ── Top Header & Stats ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#131B2E] border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              History / Archive
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {filtered.length} of {estimations.length} records
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Archived estimations, final equipment pricing, and proposal histories with status color coding.
          </p>
        </div>

        {/* ── Color Coded Quick Filter Tabs ── */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl">
          {/* ALL */}
          <button
            onClick={() => setActiveCategoryTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategoryTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeCategoryTab === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {categoryCounts.all}
            </span>
          </button>

          {/* PENDING */}
          <button
            onClick={() => setActiveCategoryTab('pending')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategoryTab === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 border border-amber-600" />
            <span>Pending</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeCategoryTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
              }`}
            >
              {categoryCounts.pending}
            </span>
          </button>

          {/* APPROVED */}
          <button
            onClick={() => setActiveCategoryTab('approved')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategoryTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-600" />
            <span>Approved</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeCategoryTab === 'approved' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {categoryCounts.approved}
            </span>
          </button>

          {/* FINALIZED */}
          <button
            onClick={() => setActiveCategoryTab('finalized')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategoryTab === 'finalized'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500 border border-indigo-600" />
            <span>Finalized</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeCategoryTab === 'finalized' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'
              }`}
            >
              {categoryCounts.finalized}
            </span>
          </button>

          {/* REJECTED (if any exist) */}
          {categoryCounts.rejected > 0 && (
            <button
              onClick={() => setActiveCategoryTab('rejected')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 dark:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-950/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 border border-rose-600" />
              <span>Rejected</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeCategoryTab === 'rejected' ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                }`}
              >
                {categoryCounts.rejected}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Search & Sorting Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#131B2E] p-3 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by project, client, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Sort by:
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none cursor-pointer"
          >
            <option value="Newest">Newest first</option>
            <option value="A-Z">Project Name (A-Z)</option>
            <option value="Z-A">Project Name (Z-A)</option>
            <option value="Highest Value">Highest Total Cost</option>
          </select>

          {filtered.length > 0 && (
            <button
              onClick={() => setExpandedKey(expandedKey ? null : filtered[0]?.key || null)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              {expandedKey ? 'Collapse' : 'Expand First'}
            </button>
          )}
        </div>
      </div>

      {/* ── Empty Filter State ── */}
      {filtered.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-[#131B2E] rounded-2xl border border-slate-200/90 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No estimations match your filter criteria.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Try clearing the search query or switching to the "All" tab.
          </p>
          {(searchQuery || activeCategoryTab !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategoryTab('all');
              }}
              className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── Maximized Width Items List with Color Coding ── */}
      <div className="space-y-3.5">
        {filtered.map((est) => {
          const isOpen = expandedKey === est.key;
          const category = categorizeStatus(est.projectStatus);
          const theme = STATUS_THEMES[category] || STATUS_THEMES.other;
          const gt = grandTotal(est);
          const mp = totalManpower(est);
          const mat = totalConsumables(est);
          const fee = totalFees(est);
          const hasPrice = gt > 0;
          const formattedDate = est.startDate || (est.createdAt ? est.createdAt.split('T')[0] : 'Archived');

          return (
            <div
              key={est.key}
              className={`rounded-2xl border ${theme.cardBorder} bg-white dark:bg-[#131B2E] overflow-hidden shadow-xs transition-all duration-200 border-l-[6px] ${theme.leftStripe}`}
            >
              {/* ── Card Main Row (Full Width Flex) ── */}
              <div className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${theme.headerHighlight}`}>
                {/* Left side: Icon + Project Title + Client + Status */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  {/* Status-colored icon */}
                  <div
                    className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${theme.iconBg}`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Prominent Color-Coded Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${theme.dotBg} animate-pulse`} />
                        {est.projectStatus}
                      </span>

                      {/* Project ID Tag */}
                      <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                        #{est.dbProjId ? `PRJ-${est.dbProjId}` : est.projectId.slice(0, 8)}
                      </span>

                      {/* Price Tier */}
                      {est.priceTier && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {TIER_LABELS[est.priceTier] ?? est.priceTier}
                        </span>
                      )}
                    </div>

                    <h2
                      className="text-base font-bold text-slate-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title={est.projectName}
                    >
                      {est.projectName}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {est.clientName && (
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {est.clientName}
                        </span>
                      )}
                      {est.location && (
                        <span className="flex items-center gap-1 truncate max-w-xs">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {est.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Cost summary + Action buttons */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                  {/* Grand total pill */}
                  <div className="text-left lg:text-right px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Grand Total
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {hasPrice ? `₱${gt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                    </p>
                  </div>

                  {/* PDF Export */}
                  <button
                    onClick={async () => {
                      toast.info('Generating PDF...');
                      try {
                        await exportBOQPdf({
                          title: `Project Estimation - ${est.projectName}`,
                          projectName: est.projectName,
                          manpower: est.manpower || [],
                          consumables: est.consumables || [],
                          fees: est.fees || [],
                          constraints: est.constraints,
                        });
                        toast.success('PDF downloaded!');
                      } catch {
                        toast.error('Failed to generate PDF.');
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Export PDF Proposal"
                  >
                    <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>PDF</span>
                  </button>

                  {/* Reuse / Copy */}
                  <button
                    onClick={() => {
                      setReuseKey(reuseKey === est.key ? null : est.key);
                      setReuseProjectId('');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Reuse / Copy this estimation"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                      />
                    </svg>
                    <span>Reuse</span>
                  </button>

                  {/* View Details Toggle */}
                  <button
                    onClick={() => setExpandedKey(isOpen ? null : est.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                      isOpen
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{isOpen ? 'Close' : 'View Details'}</span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(est)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    title="Delete record"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ── Reuse Panel ── */}
              {reuseKey === est.key && (
                <div className="border-t border-emerald-100 dark:border-emerald-900/50 px-5 py-4 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                      />
                    </svg>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Copy this estimation breakdown to another project
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <select
                      value={reuseProjectId}
                      onChange={(e) => setReuseProjectId(e.target.value)}
                      className="w-full sm:flex-1 px-3 py-2 rounded-xl text-xs font-medium border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-emerald-400 transition-colors"
                    >
                      <option value="">Select target project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.clientName || 'General Client'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleReuse(est)}
                      disabled={!reuseProjectId}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 cursor-pointer"
                      style={{
                        background: !reuseProjectId ? '#94A3B8' : 'linear-gradient(135deg, #059669, #047857)',
                        boxShadow: !reuseProjectId ? 'none' : '0 4px 12px rgba(5,150,105,0.3)',
                      }}
                    >
                      Apply to Project
                    </button>
                  </div>
                </div>
              )}

              {/* ── Expandable Detail (Maximized Width Grid) ── */}
              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-5 sm:p-6 space-y-5 bg-slate-50/60 dark:bg-slate-900/40">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div className="rounded-xl bg-white dark:bg-[#1A233A] border border-slate-200 dark:border-slate-800 p-3.5 text-center shadow-xs">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        Manpower Cost
                      </p>
                      <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
                        {mp > 0 ? `₱${mp.toLocaleString('en-PH')}` : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {est.manpower?.length || 0} crew roles
                      </p>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-[#1A233A] border border-slate-200 dark:border-slate-800 p-3.5 text-center shadow-xs">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        Materials / BOM
                      </p>
                      <p className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">
                        {mat > 0 ? `₱${mat.toLocaleString('en-PH')}` : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {est.consumables?.length || 0} line items
                      </p>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-[#1A233A] border border-slate-200 dark:border-slate-800 p-3.5 text-center shadow-xs">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        Additional Fees
                      </p>
                      <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                        {fee > 0 ? `₱${fee.toLocaleString('en-PH')}` : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {est.fees?.filter((f) => f.amount > 0).length || 0} surcharges
                      </p>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-[#1A233A] border border-slate-200 dark:border-slate-800 p-3.5 text-center shadow-xs">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        Total Project Value
                      </p>
                      <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {hasPrice ? `₱${gt.toLocaleString('en-PH')}` : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {TIER_LABELS[est.priceTier] ?? est.priceTier} tier
                      </p>
                    </div>
                  </div>

                  {/* Multi-column grid for Manpower & Materials */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {/* Manpower Breakdown */}
                    {est.manpower?.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#1A233A] shadow-xs">
                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Manpower Breakdown
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {est.manpower.length} roles
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                                <th className="px-4 py-2 text-left font-bold">Role</th>
                                <th className="px-4 py-2 text-right font-bold">Headcount</th>
                                <th className="px-4 py-2 text-right font-bold">Man-Days</th>
                                {est.manpower.some((m) => m.totalCost > 0) && (
                                  <th className="px-4 py-2 text-right font-bold">Total Cost</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {est.manpower.map((m, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                                >
                                  <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">
                                    {m.role}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">
                                    {m.headcount}
                                  </td>
                                  <td className="px-4 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
                                    {m.manDays}
                                  </td>
                                  {est.manpower.some((mp) => mp.totalCost > 0) && (
                                    <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                                      {m.totalCost > 0 ? `₱${m.totalCost.toLocaleString('en-PH')}` : '—'}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-[#1A233A] text-center flex flex-col justify-center">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          No manpower records specified for this project.
                        </p>
                      </div>
                    )}

                    {/* Materials & Consumables */}
                    {est.consumables?.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#1A233A] shadow-xs">
                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Bill of Materials (BOM)
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {est.consumables.length} line items
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                                <th className="px-4 py-2 text-left font-bold">Item Description</th>
                                <th className="px-4 py-2 text-right font-bold">Quantity</th>
                                {est.consumables.some((c) => c.unitPrice > 0) && (
                                  <th className="px-4 py-2 text-right font-bold">Total</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {est.consumables.map((c, i) => (
                                <tr
                                  key={i}
                                  className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${
                                    i % 2 ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''
                                  }`}
                                >
                                  <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">
                                    {c.name}
                                  </td>
                                  <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                                    {c.quantity} {c.unit || ''}
                                  </td>
                                  {est.consumables.some((cc) => cc.unitPrice > 0) && (
                                    <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                                      {c.totalPrice > 0 ? `₱${c.totalPrice.toLocaleString('en-PH')}` : '—'}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-[#1A233A] text-center flex flex-col justify-center">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          No consumables or equipment items logged.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Surcharges & Installation Notes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Additional Fees */}
                    {est.fees?.filter((f) => f.amount > 0).length > 0 && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A233A] p-4 shadow-xs">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-3">
                          Additional Surcharges & Fees
                        </span>
                        <div className="space-y-2">
                          {est.fees
                            .filter((f) => f.amount > 0)
                            .map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {f.type}
                                  </p>
                                  {f.description && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                      {f.description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                  ₱{f.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Constraints / Site Notes */}
                    {est.constraints &&
                      (est.constraints.physical ||
                        est.constraints.electrical ||
                        est.constraints.installation) && (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A233A] p-4 shadow-xs">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-3">
                            Installation & Site Constraints
                          </span>
                          <div className="space-y-2.5">
                            {[
                              { label: 'Physical Environment', value: est.constraints.physical },
                              { label: 'Electrical Infrastructure', value: est.constraints.electrical },
                              { label: 'Installation Notes', value: est.constraints.installation },
                            ]
                              .filter((c) => c.value)
                              .map(({ label, value }) => (
                                <div key={label}>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    {label}
                                  </p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">
                                    {value}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Exported count helper for sidebar badge */
export function getSavedEstimationCount(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('aa2000_estimation_')) count++;
  }
  return count;
}
