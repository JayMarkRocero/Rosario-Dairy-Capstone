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

let accessToken: string | null = localStorage.getItem('rosario_access_token');

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('rosario_access_token', token);
  } else {
    localStorage.removeItem('rosario_access_token');
  }
}

export function getAccessToken() {
  return accessToken;
}

export interface CreateOrderPayload {
  customer_id: number;
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

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface DjangoUserListItem {
  id: number;
  username: string;
  email: string;
  role: "admin" | "staff";
  is_active: boolean;
  deactivation_reason: string;
  first_name: string;
  last_name: string;
  last_login: string | null;
  phone_number?: string;
  address?: string;
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

export interface DjangoCustomer {
  id: number;
  name: string;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DjangoOrderItem {
  id: number;
  product: DjangoProduct;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface DjangoOrder {
  id: number;
  customer: DjangoCustomer;
  handled_by: CurrentUser;
  status: "placed" | "confirmed" | "fulfilled" | "cancelled";
  transaction: number | null;
  items: DjangoOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerPayload {
  name: string;
  contact_number?: string | null;
  email?: string | null;
  address?: string | null;
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export interface CheckoutItemPayload {
  product_id: number;
  quantity: number;
}

export interface CheckoutPayload {
  items: CheckoutItemPayload[];
  payment_method: "cash" | "online";
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number;
  amount_tendered?: number;
}

export interface DjangoTransactionItem {
  id: number;
  product_batch: DjangoProductBatch;
  quantity: number;
  unit_price: string;
}

export interface DjangoTransaction {
  id: number;
  handled_by: CurrentUser;
  subtotal: string;
  discount_type: string;
  discount_value: string;
  discount_amount: string;
  total_amount: string;
  amount_tendered: string | null;
  change_due: string | null;
  payment_method: string;
  delivery_status: string | null;
  items: DjangoTransactionItem[];
  created_at: string;
}

export interface DjangoBestSeller {
  product: string;
  sales: number;
}

export interface DjangoSalesByCategory {
  name: string;
  value: number;
}

// ─── Error parsing helper ──────────────────────────────────────────────────────
async function throwParsedError(res: Response): Promise<never> {
  const errText = await res.text();
  let message = `Request failed (${res.status})`;
  try {
    const parsed = JSON.parse(errText);
    message = parsed.error || parsed.detail || Object.values(parsed).flat().join(" ") || message;
  } catch {
    // errText wasn't valid JSON — keep the generic message
  }
  throw new Error(message);
}

// ─── Core fetch helpers ───────────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) return throwParsedError(res);
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
  if (!res.ok) return throwParsedError(res);
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
  if (!res.ok) return throwParsedError(res);
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) return throwParsedError(res);
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
  if (!res.ok) return throwParsedError(res);
}

// Some DELETE endpoints (e.g. category soft-delete) return 200 + a JSON body
// instead of a plain 204, so we parse and hand back the result.
async function apiDeleteWithResult<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) return throwParsedError(res);
  return res.json();
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

  updateCategory: (id: number, data: UpdateCategoryPayload) =>
    apiPatch<DjangoCategory>(`/inventory/categories/${id}/`, data),
  deleteCategory: (id: number) =>
    apiDeleteWithResult<{ message: string }>(`/inventory/categories/${id}/`),

  getUsers: () => apiFetch<DjangoUserListItem[]>('/accounts/users/'),
  registerUser: (data: RegisterUserPayload) =>
    apiPost<{ message: string }>('/accounts/register/', data),
  updateUser: (id: number, data: UpdateUserPayload) =>
    apiPatch<{ message: string }>(`/accounts/users/${id}/`, data),
  deactivateUser: (id: number, reason: string) =>
    apiDeleteWithBody(`/accounts/users/${id}/`, { reason }),
  resetPassword: (data: ResetPasswordPayload) =>
    apiPost<{ message: string }>('/accounts/admin-reset-password/', data),

  getCustomers: () => apiFetch<DjangoCustomer[]>('/sales/customers/'),
  getOrders: () => apiFetch<DjangoOrder[]>('/sales/orders/'),
  createCustomer: (data: CreateCustomerPayload) =>
    apiPost<DjangoCustomer>('/sales/customers/', data),
  updateCustomer: (id: number, data: UpdateCustomerPayload) =>
    apiPatch<DjangoCustomer>(`/sales/customers/${id}/`, data),
  deleteCustomer: (id: number) =>
    apiDelete(`/sales/customers/${id}/`),

  createOrder: (data: CreateOrderPayload) =>
  apiPost<DjangoOrder>('/sales/orders/', data),
confirmOrder: (id: number) =>
  apiPost<DjangoOrder>(`/sales/orders/${id}/confirm/`, {}),
fulfillOrder: (id: number, paymentMethod: string) =>
  apiPost<DjangoOrder>(`/sales/orders/${id}/fulfill/`, { payment_method: paymentMethod }),
cancelOrder: (id: number) =>
  apiPost<DjangoOrder>(`/sales/orders/${id}/cancel/`, {}),

checkout: (data: CheckoutPayload) =>
  apiPost<DjangoTransaction>('/sales/checkout/', data),

getTransactions: (params?: { start_date?: string; end_date?: string; payment_method?: string }) => {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.payment_method) query.set('payment_method', params.payment_method);
  const qs = query.toString();
  return apiFetch<DjangoTransaction[]>(`/sales/transactions/${qs ? `?${qs}` : ''}`);
},

getBestSellers: (limit = 10) =>
  apiFetch<DjangoBestSeller[]>(`/sales/reports/best-sellers/?limit=${limit}`),

getSalesByCategory: () =>
  apiFetch<DjangoSalesByCategory[]>('/sales/reports/sales-by-category/'),

};