// Client for saved Doc Reader / AI Scan audits.
//
// These used to be written straight to localStorage, which meant an audit only
// existed in the browser that produced it, was shared by every account using
// that browser, and was wiped by the app-version migration. They are per-account
// rows on the backend now.
//
// The routes live on the existing authenticated AI router
// (/service/estimation/ai/scans), so the session token is already attached by
// ApiClient and the server scopes every query to the signed-in account.

import { apiClient } from './index';
import type { ApiResponse } from './index';
import type { AIScanGroup } from '../../App';

const BASE = '/service/estimation/ai/scans';

interface ScanEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

/**
 * The backend wraps every response in its own envelope, and ApiClient already
 * returns that body as `response.data` — so the payload sits at `response.data.data`.
 */
async function unwrap<T>(response: ApiResponse<ScanEnvelope<T>>): Promise<T> {
  if (!response.success) {
    throw new Error(response.error?.message || 'The saved analyses could not be reached.');
  }

  const body = response.data;
  if (!body || body.success === false) {
    throw new Error(body?.error || 'The saved analyses could not be reached.');
  }

  return body.data as T;
}

/** Loads every audit saved by the signed-in account, newest first. */
export async function fetchAIScans(): Promise<AIScanGroup[]> {
  const scans = await unwrap<AIScanGroup[]>(await apiClient.get<ScanEnvelope<AIScanGroup[]>>(BASE));
  return Array.isArray(scans) ? scans : [];
}

/** Saves a new audit, or replaces the files of one saved under the same id. */
export async function saveAIScan(scan: AIScanGroup): Promise<AIScanGroup> {
  return unwrap<AIScanGroup>(
    await apiClient.post<ScanEnvelope<AIScanGroup>>(BASE, {
      id: scan.id,
      name: scan.name,
      files: scan.files,
    }),
  );
}

/** Persists a rename, a changed file role, or a re-run audit. */
export async function updateAIScan(scan: AIScanGroup): Promise<AIScanGroup> {
  return unwrap<AIScanGroup>(
    await apiClient.put<ScanEnvelope<AIScanGroup>>(`${BASE}/${encodeURIComponent(scan.id)}`, {
      name: scan.name,
      files: scan.files,
    }),
  );
}

export async function deleteAIScan(scanId: string): Promise<void> {
  await unwrap<{ deleted: number }>(
    await apiClient.delete<ScanEnvelope<{ deleted: number }>>(`${BASE}/${encodeURIComponent(scanId)}`),
  );
}
