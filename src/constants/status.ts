// Single source of truth for project status and the status KPIs.
//
// Every KPI surface in the studio — Dashboard, Home, CalendarView,
// ApprovalPipeline, CompanyDetail — used to roll its own predicates over the raw
// status strings. They had drifted into five different definitions of the same
// numbers, so the same project could be counted as completed on one page and
// in progress on another. The vocabulary and the bucketing live here now; a page
// that needs a status count asks for it instead of re-deriving it.
//
// The four buckets:
//
//   Rejected  -> sent back for rework
//   Pending   -> waiting for approval (never submitted, or submitted and
//                awaiting review)
//   Active    -> approved and awaiting the site survey schedule, or scheduled
//                and under way
//   Completed -> approved and the site survey is done
//
// `FINALIZED` is the "waiting for approval" state (TO-VALIDATE in the database
// enum) and `FINALIZED_APPROVED` is APPROVED. Both are distinct states in the
// database but land in different buckets here: approval clears a survey to
// proceed, it does not mean the survey has happened.

import { PROJECT_STATUS } from './roles';

export { PROJECT_STATUS };
export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

/**
 * The buckets status KPIs are reported in.
 *
 * Rejected is deliberately kept apart from Pending rather than being folded into
 * it. Sent-back work is the one outcome a user has to actively resolve, so
 * burying it inside "pending" hides it — a rejected proposal still showed as
 * merely waiting.
 */
export type StatusBucket = 'rejected' | 'pending' | 'active' | 'completed';

export const STATUS_BUCKET_LABEL: Record<StatusBucket, string> = {
  rejected: 'Rejected',
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
};

export const STATUS_BUCKETS: readonly StatusBucket[] = ['rejected', 'pending', 'active', 'completed'];

/**
 * Every state, and the bucket it reports under.
 *
 * This is a total function over the six states on purpose: nothing is dropped
 * and nothing is counted twice, so the four buckets always sum to the number of
 * projects. That reconciliation is the whole point — the old per-page predicates
 * silently dropped `Finalized - Rejected` from every bucket on some pages and
 * counted it as completed on others.
 *
 * Note that `Finalized - Approved` reports under Active, not Completed: being
 * approved means the survey is cleared to proceed, not that it has happened.
 */
const STATUS_TO_BUCKET: Record<ProjectStatus, StatusBucket> = {
  // Sent back for rework. Tracked apart from every other open state.
  [PROJECT_STATUS.FINALIZED_REJECTED]: 'rejected',
  // Not yet approved — either never submitted, or submitted and awaiting review.
  [PROJECT_STATUS.PENDING]: 'pending',
  [PROJECT_STATUS.FINALIZED]: 'pending',
  // Cleared to proceed: approved and awaiting schedule, or scheduled and under way.
  [PROJECT_STATUS.FINALIZED_APPROVED]: 'active',
  [PROJECT_STATUS.IN_PROGRESS]: 'active',
  // The site survey actually ran.
  [PROJECT_STATUS.COMPLETED]: 'completed',
};

/**
 * Normalises an arbitrary status string to one of the six known states.
 *
 * Returns null for anything unrecognised rather than guessing. The old code
 * defaulted unknown statuses to 'Pending', which made a bad value inflate the
 * pending KPI; surfacing it as `unclassified` keeps the counts honest.
 */
export function normalizeStatus(status: unknown): ProjectStatus | null {
  if (typeof status !== 'string') return null;
  const trimmed = status.trim();
  return (Object.values(PROJECT_STATUS) as string[]).includes(trimmed)
    ? (trimmed as ProjectStatus)
    : null;
}

/** The KPI bucket for a status, or null if the status is not recognised. */
export function statusBucket(status: unknown): StatusBucket | null {
  const known = normalizeStatus(status);
  return known ? STATUS_TO_BUCKET[known] : null;
}

/** Reports under Pending: not yet approved. */
export function isPending(status: unknown): boolean {
  return statusBucket(status) === 'pending';
}

/** Reports under Active: approved, and either awaiting schedule or under way. */
export function isActive(status: unknown): boolean {
  return statusBucket(status) === 'active';
}

/** Reports under Completed: the survey has been done. */
export function isCompleted(status: unknown): boolean {
  return statusBucket(status) === 'completed';
}

/** Awaiting approval — the `Finalized` state, which sits under Pending. */
export function isAwaitingApproval(status: unknown): boolean {
  return normalizeStatus(status) === PROJECT_STATUS.FINALIZED;
}

/**
 * Sent back for rework. This is also the Rejected bucket, since that bucket holds
 * exactly this one state.
 */
export function isRejected(status: unknown): boolean {
  return normalizeStatus(status) === PROJECT_STATUS.FINALIZED_REJECTED;
}

/** Approved and cleared to proceed. Sits under Active, not Completed. */
export function isApproved(status: unknown): boolean {
  return normalizeStatus(status) === PROJECT_STATUS.FINALIZED_APPROVED;
}

/**
 * Work that still has to be done: a project waiting to start, or under way.
 *
 * Equivalent to the old `status !== 'Completed' && !status.includes('Finalized')`
 * used by CompanyDetail, but without the substring match — which also excluded
 * `Finalized` itself, i.e. a project waiting for approval read as "not complete"
 * on one page and "pending" on another.
 *
 * Named for the work, not the Active bucket: an approved project awaiting its
 * schedule is Active but has no outstanding site work.
 */
export function isOpenWork(status: unknown): boolean {
  const known = normalizeStatus(status);
  return known === PROJECT_STATUS.PENDING || known === PROJECT_STATUS.IN_PROGRESS;
}

export interface StatusKpis {
  /** Headline counts. These always sum to `total`. */
  rejected: number;
  pending: number;
  active: number;
  completed: number;
  /** Projects that fell inside the KPI window. */
  total: number;
  /**
   * Count for each of the six states, so no state is lost by the headline
   * buckets: `pending` covers both PENDING and FINALIZED, and `active` covers
   * both FINALIZED_APPROVED and IN_PROGRESS.
   */
  byStatus: Record<ProjectStatus, number>;
  /** Awaiting approval specifically (PROJECT_STATUS.FINALIZED). */
  awaitingApproval: number;
  /** Sent back for rework (PROJECT_STATUS.FINALIZED_REJECTED). */
  rejectedDetail: number;
  /** Approved and awaiting the survey (PROJECT_STATUS.FINALIZED_APPROVED). */
  approved: number;
  /**
   * Projects whose status is not one of the six known states. Non-zero means
   * bad data, and is deliberately excluded from the buckets rather than being
   * folded into Pending, so the four totals still reconcile.
   */
  unclassified: number;
}

/**
 * Computes the status KPIs for a list of projects.
 *
 * Callers filter to the projects they mean to report on first (e.g. the calendar
 * narrows to one month) and then use the same function as every other page, so
 * the definition of each bucket can never drift between them.
 */
export function computeStatusKpis(projects: ReadonlyArray<{ status?: unknown }>): StatusKpis {
  const byStatus = {
    [PROJECT_STATUS.PENDING]: 0,
    [PROJECT_STATUS.IN_PROGRESS]: 0,
    [PROJECT_STATUS.FINALIZED]: 0,
    [PROJECT_STATUS.FINALIZED_APPROVED]: 0,
    [PROJECT_STATUS.FINALIZED_REJECTED]: 0,
    [PROJECT_STATUS.COMPLETED]: 0,
  } as Record<ProjectStatus, number>;

  const counts: Record<StatusBucket, number> = { rejected: 0, pending: 0, active: 0, completed: 0 };
  let unclassified = 0;

  for (const project of projects) {
    const known = normalizeStatus(project?.status);
    if (!known) {
      unclassified += 1;
      continue;
    }
    byStatus[known] += 1;
    counts[STATUS_TO_BUCKET[known]] += 1;
  }

  return {
    ...counts,
    total: projects.length,
    byStatus,
    awaitingApproval: byStatus[PROJECT_STATUS.FINALIZED],
    rejectedDetail: byStatus[PROJECT_STATUS.FINALIZED_REJECTED],
    approved: byStatus[PROJECT_STATUS.FINALIZED_APPROVED],
    unclassified,
  };
}

/**
 * Rolls a set of child project statuses up into the status to show on a company
 * folder. Duplicated inline on three pages, and one copy had already drifted to
 * a different order.
 *
 * Most-resolved wins, so a folder reads as complete only when everything under
 * it is complete.
 */
export function deriveFolderStatus(
  children: ReadonlyArray<{ status?: unknown }>,
  fallback: unknown = PROJECT_STATUS.PENDING,
): ProjectStatus {
  const priority: ProjectStatus[] = [
    PROJECT_STATUS.COMPLETED,
    PROJECT_STATUS.FINALIZED_APPROVED,
    PROJECT_STATUS.FINALIZED,
    PROJECT_STATUS.FINALIZED_REJECTED,
    PROJECT_STATUS.IN_PROGRESS,
    PROJECT_STATUS.PENDING,
  ];
  for (const candidate of priority) {
    if (children.some((child) => normalizeStatus(child?.status) === candidate)) return candidate;
  }
  return normalizeStatus(fallback) ?? PROJECT_STATUS.PENDING;
}