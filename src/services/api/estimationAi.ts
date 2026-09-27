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

interface EstimationAiBackendResponse {
  success: boolean;
  data?: EstimationAiResult;
  error?: string;
}

export async function requestEstimationAi(
  task: EstimationAiTask,
  payload: Record<string, unknown>
): Promise<EstimationAiResult> {
  const response = await apiClient.post<EstimationAiBackendResponse>(
    '/service/estimation/ai',
    {
      task,
      payload,
    }
  );

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || 'Failed to reach Estimation AI endpoint'
    );
  }

  if (!response.data.success || !response.data.data) {
    throw new Error(
      response.data.error || 'Estimation AI request failed'
    );
  }

  return response.data.data;
}

export async function requestEstimationAiChat(
  messages: EstimationAiMessage[]
): Promise<EstimationAiResult> {
  return requestEstimationAi('chat', {
    messages,
  });
}