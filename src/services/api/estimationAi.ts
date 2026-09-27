import { apiClient } from './index';

export type EstimationAiTask = 'chat';

export interface EstimationAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EstimationAiResult {
  task: EstimationAiTask;
  content: string;
  model: string;
  meta?: Record<string, unknown>;
}

export interface EstimationAiAttachments {
  /** Document images (PNG, JPEG, GIF, WEBP) — max 3, 8 MB each. */
  images?: File[];
  /** Excel (.xlsx) spreadsheet to analyze server-side. */
  spreadsheet?: File;
}

// Backend contract for POST /service/estimation/ai:
//   success -> { success: true,  data: "<ai chat message>" }
//   failure -> { success: false, data: '', error: "<reason>" }
interface EstimationAiBackendResponse {
  success: boolean;
  data?: string;
  error?: string;
}

const AI_REQUEST_TIMEOUT_MS = 120000;
const MAX_IMAGES = 3;

export async function requestEstimationAi(
  task: EstimationAiTask,
  payload: Record<string, unknown>,
  attachments?: EstimationAiAttachments
): Promise<EstimationAiResult> {
  const imageFiles = (attachments?.images || []).slice(0, MAX_IMAGES);
  const spreadsheetFile = attachments?.spreadsheet || null;
  const hasAttachments = imageFiles.length > 0 || Boolean(spreadsheetFile);

  let response;

  if (hasAttachments) {
    const formData = new FormData();
    formData.append('task', task);
    formData.append('payload', JSON.stringify(payload));
    imageFiles.forEach((file, index) => {
      formData.append('images', file, file.name || `image_${index + 1}.png`);
    });
    if (spreadsheetFile) {
      formData.append(
        'spreadsheet',
        spreadsheetFile,
        spreadsheetFile.name || 'spreadsheet.xlsx'
      );
    }

    response = await apiClient.postForm<EstimationAiBackendResponse>(
      '/service/estimation/ai',
      formData,
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );
  } else {
    response = await apiClient.post<EstimationAiBackendResponse>(
      '/service/estimation/ai',
      { task, payload },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS }
    );
  }

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || 'Failed to reach Estimation AI endpoint'
    );
  }

  const body = response.data;

  if (!body.success) {
    throw new Error(body.error || 'Estimation AI request failed');
  }

  return {
    task,
    content: typeof body.data === 'string' ? body.data : '',
    model: '',
  };
}

export async function requestEstimationAiChat(
  messages: EstimationAiMessage[],
  attachments?: EstimationAiAttachments
): Promise<EstimationAiResult> {
  return requestEstimationAi(
    'chat',
    {
      messages,
    },
    attachments
  );
}
