import { ApiClient } from './client';

export interface BackendProduct {
  prod_ID: number;
  prod_Name: string | null;
  prod_Code: string | null;
  model: string | null;
  brand: string | null;
  category: string | null;
  item_description: string | null;
  prod_price: number | string | null;
}

export interface ProductsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  products: BackendProduct[];
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

export async function fetchProducts(
  page = 1,
  limit = 100
): Promise<ProductsResponse> {
  const mode = import.meta.env.VITE_PRODUCTS_MODE || 'mock';

  if (mode === 'mock') {
    const start = (page - 1) * limit;

    return {
      total: mockProducts.length,
      page,
      limit,
      totalPages: Math.ceil(mockProducts.length / limit),
      products: mockProducts.slice(start, start + limit),
    };
  }

  if (mode !== 'live') {
    throw new Error('Product mode must be mock or live.');
  }

  const baseURL = (
    import.meta.env.VITE_API_BASE_URL || ''
  ).trim().replace(/\/+$/, '');

  if (!baseURL) {
    throw new Error('Missing backend URL for live product requests.');
  }

  const client = new ApiClient(baseURL);

  const response = await client.get<ProductsResponse>(
    '/products/get/products',
    { page, limit }
  );

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || 'Failed to retrieve products.'
    );
  }

  if (!Array.isArray(response.data.products)) {
    throw new Error('The backend returned an invalid product list.');
  }

  return response.data;
}