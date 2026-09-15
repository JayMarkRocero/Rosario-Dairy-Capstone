import axios, { AxiosError } from "axios";

const REFRESH_TOKEN_KEY = "rosario_refresh_token";

const ACCESS_TOKEN_KEY = "rosario_access_token";

const axiosInstance = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

export default axiosInstance;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string, public fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener());
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

const PUBLIC_AUTH_PATHS = ["/accounts/login/", "/accounts/forgot-password/", "/accounts/reset-password/", "/accounts/refresh/"];

let refreshRequest: Promise<string> | null = null;
export function refreshAccessToken(): Promise<string> {
  if (refreshRequest) return refreshRequest;
  const refresh = getRefreshToken();
  if (!refresh) return Promise.reject(new ApiError(401, "Please log in again."));
  refreshRequest = axiosInstance.post<{ access: string; refresh?: string }>("/accounts/refresh/", { refresh })
    .then(({ data }) => {
      if (getRefreshToken() !== refresh) throw new ApiError(401, "Session changed. Please log in again.");
      if (!data.access) throw new ApiError(401, "Unable to refresh your session.");
      setAccessToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      return data.access;
    }).finally(() => { refreshRequest = null; });
  return refreshRequest;
}

export interface PaginatedResponse<T> { count: number; results: T[]; next?: string | null }
export async function getAllPages<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  while (true) {
    const { data } = await axiosInstance.get<T[] | PaginatedResponse<T>>(url, { params: { ...params, page } });
    if (Array.isArray(data)) return [...rows, ...data];
    rows.push(...data.results);
    if (!data.results.length || rows.length >= data.count || data.next === null) return rows;
    page += 1;
  }
}

function appendTrailingSlash(url: string): string {
  const [pathAndQuery, hash = ""] = url.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  return `${normalizedPath}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

axiosInstance.interceptors.request.use((config) => {
  if (config.url) config.url = appendTrailingSlash(config.url);

  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && !config.headers.Authorization && !PUBLIC_AUTH_PATHS.includes(config.url ?? "")) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const payload = data as Record<string, unknown>;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;

  const fieldMessages = Object.values(payload)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string");

  return fieldMessages.join(" ") || fallback;
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    return extractErrorMessage(error.response?.data, fallback);
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!error.response) return Promise.reject(error);

    const status = error.response.status;
    const requestUrl = error.config?.url ?? "";
    const isPublicAuthRequest = PUBLIC_AUTH_PATHS.includes(requestUrl);
    const config = error.config as (typeof error.config & { retried?: boolean });
    if (status === 401 && !isPublicAuthRequest && requestUrl !== "/accounts/logout/" && config && !config.retried && getRefreshToken()) {
      config.retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance.request(config);
      } catch (refreshError) {
        // A temporary refresh outage must not discard a valid refresh token.
        if (!(refreshError instanceof ApiError) || ![400, 401].includes(refreshError.status)) throw refreshError;
      }
    }
    const fallback = status === 429 ? "Too many attempts. Please wait before trying again." : `Request failed (${status})`;
    let data = error.response.data;
    if (data instanceof Blob) {
      try { data = JSON.parse(await data.text()); } catch { data = null; }
    }
    const fieldErrors: Record<string, string[]> = {};
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.every(item => typeof item === "string")) fieldErrors[key] = value;
      }
    }
    let message = extractErrorMessage(data, fallback);

    if (status === 401 && !isPublicAuthRequest && requestUrl !== "/accounts/logout/") {
      setAccessToken(null);
      setRefreshToken(null);
      notifyUnauthorized();
      message = "Your session has expired. Please log in again.";
    }

    return Promise.reject(new ApiError(status, message, fieldErrors));
  }
);

export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface CurrentUser {
  username: string;
  email: string;
  role: "admin" | "staff";
  first_name: string;
  last_name: string;
  phone_number: string | null;
  address: string | null;
  last_login: string | null;
}

export interface DjangoUserSummary {
  id: number;
  username: string;
  role: "admin" | "staff";
}

export type { CreateOrderPayload } from "@/features/orders/types/order";

export interface DjangoCategory {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  is_visible_to_staff: boolean;
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
  total_stock: string;
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
  unit_price: string | number;
  shelf_life: number;
  low_stock_threshold: number;
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
  notes?: string | null;
}

export type UpdateProductBatchPayload = Partial<
  Omit<CreateProductBatchPayload, "product_id" | "quantity">
>;

export interface DjangoIngredient {
  id: number;
  name: string;
  unit: string;
  unit_price: string;
  shelf_life: number;
  ingredient_type: "raw_milk" | "processing" | "packaging";
  low_stock_threshold: number;
  is_active: boolean;
  total_stock: string | number;
  created_at: string;
  updated_at: string;
}

export interface CreateIngredientPayload {
  name: string;
  unit: string;
  unit_price: string | number;
  shelf_life: number;
  ingredient_type?: DjangoIngredient["ingredient_type"];
  low_stock_threshold?: number;
}

export type UpdateIngredientPayload = Partial<CreateIngredientPayload>;

export interface DjangoIngredientBatch {
  id: number;
  ingredient: DjangoIngredient;
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

export interface CreateIngredientBatchPayload {
  ingredient_id: number;
  quantity: number;
  expiration_date: string;
  grade?: string | null;
  unit_price?: number | null;
  date_received?: string;
  notes?: string | null;
}

export type UpdateIngredientBatchPayload = Partial<
  Omit<CreateIngredientBatchPayload, "ingredient_id" | "quantity">
>;

export interface CreateCategoryPayload {
  name: string;
  description: string;
  is_visible_to_staff: boolean;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export type DeactivationReason = "leave" | "suspended" | "resigned" | "terminated";

export interface DjangoUserListItem {
  id: number;
  username: string;
  email: string;
  role: "admin" | "staff";
  is_active: boolean;
  deactivation_reason: DeactivationReason | "none";
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
  quantity: string;
  unit_price: string;
  subtotal: string;
}

export interface DjangoOrder {
  id: number;
  customer: DjangoCustomer;
  handled_by: DjangoUserSummary;
  status: "fulfilled" | "cancelled";
  transaction: DjangoTransaction;
  items: DjangoOrderItem[];
  warning?: string;
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
  quantity: string;
}

export interface CheckoutPayload {
  customer_id: number | null;
  items: CheckoutItemPayload[];
  payment_method: "cash" | "online";
  discount_type: "none" | "percent" | "fixed";
  discount_value: string;
  amount_tendered: string;
}

export interface DjangoTransactionItem {
  id: number;
  product_batch: DjangoProductBatch;
  quantity: string | number;
  unit_price: string;
}

export interface DjangoTransaction {
  id: number;
  handled_by: DjangoUserSummary;
  order?: { customer?: DjangoCustomer | null } | null;
  customer?: DjangoCustomer | null;
  subtotal: string;
  discount_type: string;
  discount_value: string;
  discount_amount: string;
  total_amount: string;
  amount_tendered: string | null;
  change_due: string | null;
  payment_method: string;
  delivery_status: string | null;
  is_voided?: boolean;
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
