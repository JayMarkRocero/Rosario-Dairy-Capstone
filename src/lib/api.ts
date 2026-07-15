const API_URL = import.meta.env.VITE_API_URL;

// ─── Auth ──────────────────────────────────────────────────────────────────
export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  role: "admin" | "staff";
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// ─── Django response shapes ──────────────────────────────────────────────────
export interface DjangoCategory {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DjangoProduct {
  id: number;
  name: string;
  variant: string | null;
  unit: string;
  unit_price: string;
  shelf_life: number;
  low_stock_threshold: number;
  is_active: boolean;
  category: DjangoCategory;
  total_stock: string | number;
  created_at: string;
  updated_at: string;
}

export interface DjangoProductBatch {
  id: number;
  product: DjangoProduct;
  batch_number: string;
  grade: string | null;
  unit_price: string | null;
  initial_quantity: string;
  remaining_quantity: string;
  expiration_date: string;
  date_received: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  name: string;
  variant: string | null;
  unit: string;
  unit_price: number;
  shelf_life: number;
  low_stock_threshold: number;
  is_active: boolean;
  category_id: number;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface CreateProductBatchPayload {
  product_id: number;
  grade?: string | null;
  unit_price?: number | null;
  quantity: number;
  expiration_date: string;
  date_received?: string;
  status?: string;
  notes?: string | null;
}

export interface CreateCategoryPayload {
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface DjangoUserListItem {
  id: number;
  username: string;
  email: string;
  role: "admin" | "staff";
  is_active: boolean;
  deactivation_reason: string;
  first_name: string;
  last_name: string;
}

export interface RegisterUserPayload {
  username: string;
  password: string;
  email: string;
  role: "admin" | "staff";
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  address?: string;
}

export interface UpdateUserPayload {
  role?: "admin" | "staff";
  is_active?: boolean;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  address?: string;
}

export interface ResetPasswordPayload {
  username: string;
  new_password: string;
}

// ─── Core fetch helpers ───────────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}

async function apiPost<T>(path: string, body: unknown, authRequired = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authRequired && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${errText}`);
  }
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${errText}`);
  }
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${errText}`);
  }
}

async function apiDeleteWithBody(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${errText}`);
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────
export const api = {
  login: (data: LoginPayload) =>
    apiPost<TokenPair>('/accounts/login/', data, false),
  getCurrentUser: () => apiFetch<CurrentUser>('/accounts/user/'),

  getCategories: () => apiFetch<DjangoCategory[]>('/inventory/categories/'),
  getProducts: () => apiFetch<DjangoProduct[]>('/inventory/products/'),
  getProductBatches: () => apiFetch<DjangoProductBatch[]>('/inventory/product-batches/'),

  createProduct: (data: CreateProductPayload) =>
    apiPost<DjangoProduct>('/inventory/products/', data),
  createProductBatch: (data: CreateProductBatchPayload) =>
    apiPost<DjangoProductBatch>('/inventory/product-batches/', data),
  createCategory: (data: CreateCategoryPayload) =>
    apiPost<DjangoCategory>('/inventory/categories/', data),

  updateProduct: (id: number, data: UpdateProductPayload) =>
    apiPatch<DjangoProduct>(`/inventory/products/${id}/`, data),
  deleteProduct: (id: number) =>
    apiDelete(`/inventory/products/${id}/`),

  getUsers: () => apiFetch<DjangoUserListItem[]>('/accounts/users/'),
  registerUser: (data: RegisterUserPayload) =>
    apiPost<{ message: string }>('/accounts/register/', data),
  updateUser: (id: number, data: UpdateUserPayload) =>
    apiPatch<{ message: string }>(`/accounts/users/${id}/`, data),
  deactivateUser: (id: number, reason: string) =>
    apiDeleteWithBody(`/accounts/users/${id}/`, { reason }),
  resetPassword: (data: ResetPasswordPayload) =>
    apiPost<{ message: string }>('/accounts/admin-reset-password/', data),
};