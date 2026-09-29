// Estimation Hub -> database submission.
// Modeled on the Quotation App's saveQuotationProject flow:
//   snapshot payload -> POST save route (with fallback) -> Proj_ID returned and reused on re-save.
import type {
  Project,
  User,
  EstimationManpowerEntry,
  EstimationConsumableEntry,
  EstimationAdditionalFeeEntry,
} from '../types';
import { restoreSessionToken, getSessionAccountId } from './authService';

const API_BASE: string = (
  import.meta.env.VITE_API_BASE_URL || 'https://aa2000backend-server.onrender.com'
).replace(/\/+$/, '');

// Same fallback idea as the Quotation App (/save/quotation, /save-quotation)
const SAVE_ENDPOINTS = [
  '/service/estimation/post/save/estimation',
  '/service/estimation/post/save-estimation',
];

export const ESTIMATION_SNAPSHOT_VERSION = 'estimation-v1' as const;

export interface EstimationSubmissionInput {
  project: Project;
  user: User | null;
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks: unknown[];
  constraints: { physical: string; electrical: string; installation: string };
  priceTier: string;
  aiQuotation?: unknown;
  aiBaseline?: unknown;
  technicianNotes?: string;
  discrepancyJustifications?: unknown;
  /** Rendered report PDF; uploaded first and linked to the project as FilePath */
  reportPdf?: Blob | null;
}

export interface SubmissionResult {
  success: boolean;
  message?: string;
  projId?: number;
  /** false when the PDF failed to upload (record itself was still saved) */
  fileUploaded?: boolean;
}

// Token stored by loginWithPin() in authService.ts (POST /security/pin-authenticate -> session.s_name).
function getSessionToken(): string {
  return restoreSessionToken() || '';
}

export const dbProjKey = (hubProjectId: string) => `aa2000_db_proj_${hubProjectId}`;
export const getSavedDbProjId = (hubProjectId: string): number | null => {
  const raw = localStorage.getItem(dbProjKey(hubProjectId));
  return raw ? Number(raw) : null;
};

const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);

function readProjectSurveys(projectId: string) {
  try {
    const all = JSON.parse(localStorage.getItem('aa2000_surveys') || '[]');
    return Array.isArray(all) ? all.filter((s: any) => s.projectId === projectId) : [];
  } catch {
    return [];
  }
}

// Hub status -> DB status set used by the Quotation save route
function toDbStatus(hubStatus: string): string {
  if (hubStatus === 'Finalized - Approved') return 'APPROVED';
  if (hubStatus === 'Completed') return 'COMPLETED';
  return 'TO-VALIDATE'; // submitted, awaiting Admin/Sales approval (also re-submission after rejection)
}

export function buildEstimationPayload(input: EstimationSubmissionInput, estimationFileName?: string) {
  const { project, user, manpower, consumables, fees } = input;
  const materialsTotal = consumables.reduce((s, c) => s + num(c.totalPrice), 0);
  const laborTotal = manpower.reduce((s, m) => s + num(m.totalCost), 0);
  const feesTotal = fees.reduce((s, f) => s + num(f.amount), 0);
  const subtotal = materialsTotal + laborTotal + feesTotal;
  const grandTotal = +(subtotal * 1.12).toFixed(2);
  const now = new Date().toISOString();

  // JSON round-trip drops `undefined` (unitPrice/amount start as undefined) and guarantees plain JSON,
  // which the backend validator requires.
  const snapshot = JSON.parse(JSON.stringify({
    estimationSchemaVersion: ESTIMATION_SNAPSHOT_VERSION,
    currency: 'PHP',
    priceTier: input.priceTier,
    projectName: project.name,
    clientName: project.clientName,
    locationName: project.locationName,
    hubProjectId: project.id,
    manpower,
    consumables,
    logistics: fees,
    scopeOfWorks: input.scopeOfWorks,
    siteConstraints: {
      physicalConstraints: { notes: input.constraints.physical },
      electricalConstraints: { notes: input.constraints.electrical },
      installationConstraints: { notes: input.constraints.installation },
    },
    technicianNotes: input.technicianNotes ?? '',
    discrepancyJustifications: input.discrepancyJustifications ?? null,
    aiBaseline: input.aiBaseline ?? null,
    aiQuotation: input.aiQuotation ?? null,
    totals: { materialsTotal, laborTotal, feesTotal, subtotal, vat: +(subtotal * 0.12).toFixed(2), grandTotal },
    surveys: readProjectSurveys(project.id),
    submittedBy: user ? { id: user.id, fullName: user.fullName } : null,
    submittedAt: now,
    createdAt: project.createdAt,
    updatedAt: now,
  }));

  const dbProjId = getSavedDbProjId(project.id);
  const customerId = (project as any).customerId ?? (project as any).customerID;

  return {
    ...(dbProjId ? { Proj_ID: dbProjId } : {}),
    AccountId: getSessionAccountId() ?? undefined, // numeric acc_ID saved at login
    ...(customerId ? { customerID: customerId } : {}),
    Start_date: project.startDate,
    activity: project.name,
    objective: `Estimation for ${project.clientName} - ${project.locationName}`,
    amount: grandTotal,
    status: toDbStatus(project.status),
    ...(estimationFileName ? { estimationFilePath: estimationFileName } : {}),
    estimationSnapshot: snapshot,
  };
}

async function uploadReportPdf(pdf: Blob, projectName: string): Promise<string | null> {
  try {
    const token = getSessionToken();
    const form = new FormData();
    const safe = projectName.replace(/[^\w-]+/g, '_').slice(0, 60) || 'estimation';
    form.append('file', pdf, `${safe}.pdf`);
    // No Content-Type header: the browser sets the multipart boundary itself.
    const res = await fetch(`${API_BASE}/service/estimation/post/upload/estimationFile`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}`, 'X-Session-Id': token } : {},
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && json?.fileName ? String(json.fileName) : null;
  } catch {
    return null;
  }
}

async function postJson(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const token = getSessionToken();
    return await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'X-Session-Id': token } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function submitEstimationToDB(input: EstimationSubmissionInput): Promise<SubmissionResult> {
  if (!getSessionToken()) {
    return { success: false, message: 'You are not signed in to the AA2000 server. Please log in again.' };
  }
  // 1) Upload the report PDF (best-effort: a PDF problem must not block the submission itself)
  let fileName: string | null = null;
  if (input.reportPdf) fileName = await uploadReportPdf(input.reportPdf, input.project.name);

  // 2) Save the project record (+ FilePath when the upload worked)
  const payload = buildEstimationPayload(input, fileName ?? undefined);
  if (!payload.AccountId) {
    return { success: false, message: 'No account ID found for this session. Please log out and log in again.' };
  }

  try {
    let res: Response | null = null;
    for (const path of SAVE_ENDPOINTS) {
      res = await postJson(path, payload);
      if (res.status !== 404) break; // only fall back when the route itself is missing
    }
    const json = await res!.json().catch(() => ({}));
    if (!res!.ok) {
      return { success: false, message: json?.message || `Server responded ${res!.status}` };
    }
    const projId = Number(json?.data?.Proj_ID);
    if (!projId) {
      return { success: false, message: 'Server replied OK but returned no Proj_ID; treating as not saved.' };
    }
    localStorage.setItem(dbProjKey(input.project.id), String(projId));
    return { success: true, message: json?.message, projId, fileUploaded: !!fileName };
  } catch (err: any) {
    return {
      success: false,
      message: err?.name === 'AbortError' ? 'Request timed out' : err?.message || 'Network error',
    };
  }
}
