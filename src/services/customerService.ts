import { apiClient } from './api';
import { restoreSessionToken } from './authService';

export interface CustomerAddress {
  Addrss_ID: number;
  Addrss_lat?: number | string | null;
  Addrss_long?: number | string | null;
  Addrss_street?: string | null;
  Addrss_municipality?: string | null;
  Addrss_province?: string | null;
  Addrss_postal?: string | null;
}

export interface BackendCustomer {
  cus_ID: number;
  cus_fname?: string | null;
  cus_mname?: string | null;
  cus_lname?: string | null;
  cus_cnum?: string | null;
  cus_email?: string | null;
  TIN_NO?: string | null;
  company_name?: string | null;
  cus_AddressID?: number | null;
  role_ID?: number | null;
  Address?: CustomerAddress | null;
}

/**
 * Fetch all existing customers from backend with joined address records
 * Endpoint: GET /customers/get/customers
 */
export async function getCustomers(): Promise<BackendCustomer[]> {
  try {
    restoreSessionToken();
    const res = await apiClient.get<BackendCustomer[]>('/customers/get/customers');
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch (err) {
    console.error('Failed to load customers from backend:', err);
    return [];
  }
}

/**
 * Format full contact person name from customer record
 */
export function getCustomerFullName(c: BackendCustomer): string {
  return [c.cus_fname, c.cus_mname, c.cus_lname].filter(Boolean).join(' ').trim();
}

/**
 * Format address string from customer Address model
 */
export function getCustomerAddressString(c: BackendCustomer): string {
  if (!c.Address) return '';
  const parts = [
    c.Address.Addrss_street,
    c.Address.Addrss_municipality,
    c.Address.Addrss_province,
    c.Address.Addrss_postal,
  ].filter(Boolean);
  return parts.join(', ').trim();
}
