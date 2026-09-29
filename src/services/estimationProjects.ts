// src/services/estimationProjects.ts
// DB <-> Hub sync for Estimation projects (project_details, application = ESTIMATION).
import { apiClient } from './api';
import { restoreSessionToken } from './authService';
import { dbProjKey, submitEstimationToDB } from './estimationSubmission';
import type { SubmissionResult } from './estimationSubmission';
import type { Project, User } from '../App';

// ---- Hub status -> DB status (for status updates only) ----
// NOTE: intentionally separate from toDbStatus() in estimationSubmission.ts, which maps
// a re-submission after rejection back to TO-VALIDATE.
const HUB_TO_DB_STATUS: Record<string, string> = {
  'Pending': 'PENDING',
  'In Progress': 'ONPROGRESS',
  'Finalized': 'TO-VALIDATE',
  'Finalized - Approved': 'APPROVED',
  'Finalized - Rejected': 'REJECTED',
  'Completed': 'COMPLETED',
};

// ---- DB status -> Hub status ----
export function fromDbStatus(dbStatus?: string | null): string {
  switch (dbStatus) {
    case 'TO-VALIDATE':
    case 'VALIDATED': return 'Finalized';
    case 'APPROVED': return 'Finalized - Approved';
    case 'REJECTED': return 'Finalized - Rejected';
    case 'COMPLETED': return 'Completed';
    case 'ONPROGRESS': return 'In Progress';
    default: return 'Pending';
  }
}

// Recreate the local survey/estimation caches on a device that has never seen this project,
// so Survey Report and Cost Estimation open populated. Never overwrites existing local data.
function hydrateLocalFromSnapshot(hubId: string, snap: any) {
  try {
    if (Array.isArray(snap.surveys) && snap.surveys.length) {
      const all = JSON.parse(localStorage.getItem('aa2000_surveys') || '[]');
      if (!all.some((s: any) => s.projectId === hubId)) {
        localStorage.setItem('aa2000_surveys', JSON.stringify([...all, ...snap.surveys]));
      }
    }
    const key = `aa2000_estimation_${hubId}`;
    if (!localStorage.getItem(key)) {
      const c = snap.siteConstraints || {};
      localStorage.setItem(key, JSON.stringify({
        manpower: snap.manpower ?? [],
        consumables: snap.consumables ?? [],
        fees: snap.logistics ?? [],
        scopeOfWorks: snap.scopeOfWorks ?? [],
        constraints: {
          physical: c.physicalConstraints?.notes ?? '',
          electrical: c.electricalConstraints?.notes ?? '',
          installation: c.installationConstraints?.notes ?? '',
        },
        priceTier: snap.priceTier ?? 'srp',
        aiQuotation: snap.aiQuotation ?? null,
        aiBaseline: snap.aiBaseline ?? null,
        technicianNotes: snap.technicianNotes ?? '',
        discrepancyJustifications: snap.discrepancyJustifications ?? [],
        updatedAt: snap.updatedAt ?? new Date().toISOString(),
      }));
    }
  } catch { /* localStorage full/unavailable: non-fatal */ }
}

// ---- project_details row -> App Project ----
export function mapDbRowToProject(row: any): Project {
  const snap = row.estimationSnapshot ?? row.estimation_snapshot ?? {};
  const hubId: string = snap.hubProjectId || `db-${row.Proj_ID}`;
  try { localStorage.setItem(dbProjKey(hubId), String(row.Proj_ID)); } catch { /* ignore */ }
  hydrateLocalFromSnapshot(hubId, snap);

  const submitter = snap.submittedBy;
  return {
    id: hubId,
    name: snap.projectName || row.activity || `Project ${row.Proj_ID}`,
    clientName: snap.clientName || '',
    location: snap.locationName || '',
    locationName: snap.locationName || '',
    status: fromDbStatus(row.Status),
    startDate: row.Start_date || undefined,
    assignedTechnicians: submitter ? [{ id: String(submitter.id), fullName: submitter.fullName, email: '' }] : [],
    createdAt: snap.createdAt || new Date().toISOString(),
  };
}

export async function fetchEstimationProjects(): Promise<Project[]> {
  restoreSessionToken();
  const res = await apiClient.get<any[]>('/service/estimation/get/submissions');
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error?.message || 'Failed to load estimation projects');
  }
  return res.data.map(mapDbRowToProject);
}

// DB is the source of truth for status; local-only (unsubmitted) projects are kept.
export function mergeProjects(local: Project[], remote: Project[]): Project[] {
  const remoteById = new Map(remote.map(p => [p.id, p]));
  const merged = local.map(p => {
    const r = remoteById.get(p.id);
    return r ? { ...p, status: r.status } : p;
  });
  const localIds = new Set(local.map(p => p.id));
  return [...merged, ...remote.filter(p => !localIds.has(p.id))];
}

function savedDbProjId(hubProjectId: string): number {
  const raw = localStorage.getItem(dbProjKey(hubProjectId));
  return raw ? Number(raw) : NaN;
}

export async function updateEstimationStatus(
  hubProjectId: string,
  hubStatus: string
): Promise<{ success: boolean; message?: string }> {
  restoreSessionToken();
  const projId = savedDbProjId(hubProjectId);
  if (!projId) return { success: false, message: 'This project has not been submitted to the database yet.' };
  const dbStatus = HUB_TO_DB_STATUS[hubStatus];
  if (!dbStatus) return { success: false, message: `Unknown status "${hubStatus}"` };

  const res = await apiClient.put<{ Proj_ID: number; Status: string }>(
    `/service/estimation/put/submissions/${projId}/status`,
    { status: dbStatus }
  );
  if (!res.success) return { success: false, message: res.error?.message };
  return { success: true, message: `Status saved as ${res.data?.Status}` };
}

export async function deleteEstimationProject(
  hubProjectId: string
): Promise<{ success: boolean; message?: string }> {
  restoreSessionToken();
  const projId = savedDbProjId(hubProjectId);
  if (!projId) return { success: true }; // never reached the DB: nothing to delete remotely
  const res = await apiClient.delete<{ Proj_ID: number; deleted: boolean }>(
    `/service/estimation/delete/submissions/${projId}`
  );
  // 404 = already gone in the DB, which is the outcome we want
  if (!res.success && res.error?.code !== 'HTTP_404') return { success: false, message: res.error?.message };
  try { localStorage.removeItem(dbProjKey(hubProjectId)); } catch { /* ignore */ }
  return { success: true };
}

// "Submit" button on the project screen: send the project (with whatever estimation has been
// saved locally, or an empty one) to the DB without needing the Cost Estimation screen.
// No PDF is attached here; the PDF is rendered from the Cost Estimation screen (Save Estimation).
export async function submitProjectToDB(project: Project, user: User | null): Promise<SubmissionResult> {
  let saved: any = {};
  try { saved = JSON.parse(localStorage.getItem(`aa2000_estimation_${project.id}`) || '{}') || {}; } catch { /* ignore */ }
  return submitEstimationToDB({
    project: project as any,
    user: user as any,
    manpower: saved.manpower ?? [],
    consumables: saved.consumables ?? [],
    fees: saved.fees ?? [],
    scopeOfWorks: saved.scopeOfWorks ?? [],
    constraints: saved.constraints ?? { physical: '', electrical: '', installation: '' },
    priceTier: saved.priceTier ?? 'srp',
    aiQuotation: saved.aiQuotation ?? undefined,
    aiBaseline: saved.aiBaseline ?? undefined,
    technicianNotes: saved.technicianNotes ?? '',
    discrepancyJustifications: saved.discrepancyJustifications ?? undefined,
    reportPdf: null,
  });
}
