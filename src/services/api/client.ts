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

// Request options: per-request timeout (AI calls can exceed the 30s default)
// and the ability to drop Content-Type so fetch can set a multipart boundary.
export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  omitContentType?: boolean;
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
  private sessionToken: string | null = null;

  constructor(baseURL: string, defaultHeaders?: HeadersInit) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
  }

  setSessionToken(token: string | null): void {
    this.sessionToken = token;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  private mergeHeaders(
    headers?: HeadersInit,
    omitContentType?: boolean
  ): Record<string, string> {
    const authHeaders: Record<string, string> = this.sessionToken
      ? {
          Authorization: `Bearer ${this.sessionToken}`,
          'X-Session-Id': this.sessionToken,
        }
      : {};

    const merged: Record<string, string> = {
      ...(this.defaultHeaders as Record<string, string>),
      ...authHeaders,
      ...(headers as Record<string, string> | undefined),
    };

    if (omitContentType) {
      delete merged['Content-Type'];
    }

    return merged;
  }

  async request<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 30000
    );

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers: this.mergeHeaders(options.headers, options.omitContentType),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorData = await response.json();
          errorMessage =
            errorData.message ||
            errorData.error ||
            errorMessage;
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

      return {
        success: true,
        data,
      };
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
          message:
            error instanceof Error
              ? error.message
              : 'Network error',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  async get<T>(
    url: string,
    params?: QueryParams
  ): Promise<ApiResponse<T>> {
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
    const fullUrl = queryString
      ? `${url}?${queryString}`
      : url;

    return this.request<T>(fullUrl, {
      method: 'GET',
    });
  }

  async post<T>(
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Multipart upload: Content-Type is omitted so the browser can set
  // `multipart/form-data` with the correct boundary.
  async postForm<T>(
    url: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: formData,
      omitContentType: true,
    });
  }

  async put<T>(
    url: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
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