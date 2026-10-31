import { apiClient } from './index';

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

export async function getProducts(
  page: number = 1,
  limit: number = 10000
): Promise<ProductsResponse> {
  const response = await apiClient.get<ProductsResponse>(
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
// ── Product catalog search (same backend routes the Sales Quotation catalog uses) ──

export interface CatalogBrand {
  id: number;
  name: string;
  totalProducts: number;
}

interface AllCatalogResponse {
  catalogs?: Array<{ sup_ID: number; sup_storeName: string | null; totalProducts?: number }>;
}

/** GET /products/get/all-catalog — supplier/brand list for the filter chips. */
export async function getCatalogBrands(signal?: AbortSignal): Promise<CatalogBrand[]> {
  const response = await apiClient.get<AllCatalogResponse>('/products/get/all-catalog', undefined, { signal });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to load catalog brands');
  }
  return (response.data.catalogs || [])
    .filter(c => c.sup_storeName && c.sup_storeName.trim())
    .map(c => ({ id: c.sup_ID, name: c.sup_storeName!.trim(), totalProducts: Number(c.totalProducts) || 0 }));
}

export interface CatalogProduct extends BackendProduct {
  image_base64?: string | null;
  prod_supplierID?: number | null;
}

const productMatches = (p: CatalogProduct, query: string): boolean => {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [p.prod_Name, p.prod_Code, p.model, p.item_description, p.brand, p.category]
    .filter(Boolean).join(' ').toLowerCase();
  return tokens.every(t => haystack.includes(t));
};

const supplierCache = new Map<number, CatalogProduct[]>();

/**
 * Searches the product database. With a brand selected, loads that supplier's
 * active products once (the supplier route has no search parameter) and filters
 * locally; otherwise uses the multi-token search on /products/get/products.
 */
export async function searchCatalogProducts(
  query: string,
  brand: CatalogBrand | null,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<CatalogProduct[]> {
  const limit = options.limit ?? 50;
  const search = query.trim();

  if (brand) {
    let rows = supplierCache.get(brand.id);
    if (!rows) {
      const response = await apiClient.get<{ products?: CatalogProduct[] }>(
        `/products/get/products-by-supplier/${encodeURIComponent(brand.id)}`, undefined, { signal: options.signal });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to load products for this brand');
      }
      rows = response.data.products || [];
      supplierCache.set(brand.id, rows);
    }
    return (search ? rows.filter(p => productMatches(p, search)) : rows).slice(0, limit);
  }

  const params = new URLSearchParams({ limit: String(limit), status: 'ACTIVE' });
  if (search) params.set('search', search);
  const response = await apiClient.get<ProductsResponse>(`/products/get/products?${params}`, undefined, { signal: options.signal });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to search products');
  }
  return response.data.products as CatalogProduct[];
}

/** Backend images are usually bare base64; make them usable as an <img> src. */
export function productImageSrc(raw: string | null | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^(data:image\/|https?:\/\/|\/)/i.test(value)) return value;
  return `data:image/jpeg;base64,${value}`;
}
