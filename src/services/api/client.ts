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

// Request options: per-request timeout and multipart handling
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
  private defaultHeaders: Record<string, string>;
  private sessionToken: string | null = null;

  constructor(baseURL: string, defaultHeaders?: Record<string, string>) {
    const trimmed = (baseURL || '').trim();
    this.baseURL =
      trimmed && !/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')
        ? `http://${trimmed}`
        : trimmed;

    // Ensure defaultHeaders is handled safely as a key-value object
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
  }

  setSessionToken(token: string | null): void {
    this.sessionToken = token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('session_token', token);
    } else if (!token && typeof window !== 'undefined') {
      localStorage.removeItem('session_token');
    }
  }

  getSessionToken(): string | null {
    // Auto-hydrate from localStorage if in-memory token is null
    if (!this.sessionToken && typeof window !== 'undefined') {
      this.sessionToken = localStorage.getItem('session_token') || localStorage.getItem('token');
    }
    return this.sessionToken;
  }

  private mergeHeaders(
    headers?: HeadersInit,
    omitContentType?: boolean
  ): Record<string, string> {
    const activeToken = this.getSessionToken();

    const authHeaders: Record<string, string> = activeToken
      ? {
          Authorization: `Bearer ${activeToken}`,
          'X-Session-Id': activeToken,
        }
      : {};

    // Normalize incoming headers parameter into a standard object
    let customHeaders: Record<string, string> = {};
    if (headers) {
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          customHeaders[key] = value;
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(([key, value]) => {
          customHeaders[key] = value;
        });
      } else {
        customHeaders = { ...headers };
      }
    }

    const merged: Record<string, string> = {
      ...this.defaultHeaders,
      ...authHeaders,
      ...customHeaders,
    };

    if (omitContentType) {
      delete merged['Content-Type'];
      delete merged['content-type'];
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
        let errorCode = `HTTP_${response.status}`;

        try {
          const errorData = await response.json();
          // Extract error message & code from standardized server response
          errorMessage =
            errorData.message ||
            errorData.error ||
            (typeof errorData.error === 'object' ? errorData.error.message : null) ||
            errorMessage;

          if (errorData.code) {
            errorCode = errorData.code;
          }
        } catch {
          // Fallback if response body is not JSON
        }

        return {
          success: false,
          error: {
            message: errorMessage,
            code: errorCode,
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
    params?: QueryParams,
    options?: RequestOptions
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
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    return this.request<T>(fullUrl, {
      ...options,
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

  // Multipart upload: Content-Type is omitted so browser sets boundary
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
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(
    url: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'DELETE',
    });
  }
}