import { ApiClient } from './client';

export type ProductApiMode = 'mock' | 'live';

export interface BackendProduct {
  prod_ID: number;
  prod_Name: string | null;
  prod_Code: string | null;
  model: string | null;
  brand: string | null;
  category: string | null;
  item_description: string | null;
  prod_price: number | string | null;
  prod_supplierID?: number | null;
  prod_status?: string | null;
}

export interface ProductsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  products: BackendProduct[];
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  offset?: number;
  all?: boolean;
  search?: string;
  q?: string;
  brand?: string;
  supplier?: string;
  supplierId?: number | string | Array<number | string>;
  status?: string;
}

// Fictional products for local testing—not company prices.
const mockProducts: BackendProduct[] = [
  {
    prod_ID: 1,
    prod_Name: 'Demo CCTV Camera',
    prod_Code: 'DEMO-CAM-001',
    model: 'DEMO-CAM-001',
    brand: 'DEMO',
    category: 'CCTV',
    item_description: 'Fictional camera for integration testing',
    prod_price: '2500.00',
  },
  {
    prod_ID: 2,
    prod_Name: 'Demo Network Recorder',
    prod_Code: 'DEMO-NVR-001',
    model: 'DEMO-NVR-001',
    brand: 'DEMO',
    category: 'CCTV',
    item_description: 'Fictional recorder for integration testing',
    prod_price: '5000.00',
  },
];

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

export function resolveProductApiMode(
  env: Record<string, unknown> = (import.meta as any).env ?? {}
): ProductApiMode {
  const mode = String(env.VITE_PRODUCTS_MODE ?? '').trim().toLowerCase();

  if (mode === 'live' || mode === 'mock') {
    return mode;
  }

  return 'mock';
}

export function getProductApiBaseUrl(
  env: Record<string, unknown> = (import.meta as any).env ?? {}
): string {
  return String(env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function buildProductsQuery(
  params: ProductQueryParams = {}
): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (params.page !== undefined) {
    normalized.page = String(normalizePositiveInteger(params.page, 1));
  }

  if (params.offset !== undefined) {
    normalized.offset = String(Math.max(0, Math.floor(params.offset)));
  }

  if (params.limit !== undefined) {
    normalized.limit = String(
      Math.min(10000, normalizePositiveInteger(params.limit, 100))
    );
  }

  if (params.all) {
    normalized.all = 'true';
  }

  const includeIfPresent = (key: keyof ProductQueryParams, value: unknown) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return;
    }

    normalized[key] = String(value);
  };

  includeIfPresent('search', params.search);
  includeIfPresent('q', params.q);
  includeIfPresent('brand', params.brand);
  includeIfPresent('supplier', params.supplier);
  includeIfPresent('status', params.status);

  if (params.supplierId !== undefined) {
    const ids = Array.isArray(params.supplierId)
      ? params.supplierId
      : [params.supplierId];

    const value = ids
      .filter(
        (item) => item !== undefined && item !== null && String(item).trim() !== ''
      )
      .map((item) => String(item))
      .join(',');

    if (value) {
      normalized.supplierId = value;
    }
  }

  return normalized;
}

function normalizeProductsResponse(
  data: Partial<ProductsResponse> | null | undefined,
  fallbackPage: number,
  fallbackLimit: number
): ProductsResponse {
  const products = Array.isArray(data?.products) ? data.products : [];
  const total = Number(data?.total ?? products.length ?? 0);
  const limit = Number(data?.limit ?? fallbackLimit ?? products.length ?? 0);
  const page = Number(data?.page ?? fallbackPage ?? 1);
  const totalPages = Number(
    data?.totalPages ??
      (total > 0 ? Math.ceil(total / (limit > 0 ? limit : 1)) : 1)
  );

  return {
    total,
    page,
    limit,
    totalPages,
    products: products as BackendProduct[],
  };
}

export async function fetchProducts(
  pageOrParams: number | ProductQueryParams = 1,
  maybeLimit: number = 100
): Promise<ProductsResponse> {
  const env = (import.meta as any).env ?? {};
  const mode = resolveProductApiMode(env);

  const resolvedPage =
    typeof pageOrParams === 'number' ? pageOrParams : pageOrParams.page ?? 1;
  const resolvedLimit =
    typeof pageOrParams === 'number' ? maybeLimit : pageOrParams.limit ?? 100;

  if (mode === 'mock') {
    const start = (resolvedPage - 1) * resolvedLimit;

    return {
      total: mockProducts.length,
      page: resolvedPage,
      limit: resolvedLimit,
      totalPages: Math.ceil(mockProducts.length / resolvedLimit),
      products: mockProducts.slice(start, start + resolvedLimit),
    };
  }

  const baseURL = getProductApiBaseUrl(env);

  if (!baseURL) {
    throw new Error('Missing backend URL for live product requests.');
  }

  const client = new ApiClient(baseURL);
  const query =
    typeof pageOrParams === 'number'
      ? { page: resolvedPage, limit: resolvedLimit }
      : buildProductsQuery(pageOrParams);

  const response = await client.get<ProductsResponse>('/products/get/products', query);

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || 'Failed to retrieve products.'
    );
  }

  const data = response.data as Partial<ProductsResponse>;

  if (!Array.isArray(data.products)) {
    throw new Error('The backend returned an invalid product list.');
  }

  return normalizeProductsResponse(data, resolvedPage, resolvedLimit);
}

export const getProducts = fetchProducts;
export const listProducts = fetchProducts;
export default fetchProducts;