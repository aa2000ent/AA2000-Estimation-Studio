// Core error handling utility
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// HTTP response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Query parameters for pagination, filtering, sorting
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}

// Paginated response type
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// API client utility for making HTTP requests
export class ApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;

  constructor(baseURL: string, defaultHeaders?: HeadersInit) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
  }

  private mergeHeaders(headers?: HeadersInit): HeadersInit {
    return { ...this.defaultHeaders, ...headers };
  }

  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers: this.mergeHeaders(options.headers),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Ignore JSON parse errors for error response
        }

        return {
          success: false,
          error: {
            message: errorMessage,
            code: `HTTP_${response.status}`,
          },
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            message: 'Request timeout',
            code: 'TIMEOUT',
          },
        };
      }

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  async get<T>(url: string, params?: QueryParams): Promise<ApiResponse<T>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            searchParams.append(key, value.join(','));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
    }

    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    return this.request<T>(fullUrl, {
      method: 'GET',
    });
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      method: 'DELETE',
    });
  }
}
