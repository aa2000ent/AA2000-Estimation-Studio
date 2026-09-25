import { ApiClient } from './client';
import { config } from '../../config';

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

const client = new ApiClient(config.apiBase);

export async function getProducts(
  page: number = 1,
  limit: number = 10000
): Promise<ProductsResponse> {
  const response = await client.get<ProductsResponse>(
    '/products/get/products',
    {
      page,
      limit,
    }
  );

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || 'Failed to load products from backend'
    );
  }

  return response.data;
}

export async function getAllProducts(
  limit: number = 10000
): Promise<BackendProduct[]> {
  const firstPage = await getProducts(1, limit);

  const allProducts: BackendProduct[] = [...firstPage.products];

  for (let page = 2; page <= firstPage.totalPages; page++) {
    const nextPage = await getProducts(page, limit);
    allProducts.push(...nextPage.products);
  }

  return allProducts;
}