import { ApiClient } from './client';
import type { ApiResponse } from './client';
import { config } from '../../config';

export const apiClient = new ApiClient(config.apiBase);

export { ApiClient };
export type { ApiResponse };