import axios, { AxiosError } from "axios";

const ACCESS_TOKEN_KEY = "rosario_access_token";

const axiosInstance = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

export default axiosInstance;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
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

function appendTrailingSlash(url: string): string {
  const [pathAndQuery, hash = ""] = url.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  return `${normalizedPath}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

axiosInstance.interceptors.request.use((config) => {
  if (config.url) config.url = appendTrailingSlash(config.url);

  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const payload = data as Record<string, unknown>;
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.detail === "string") return payload.detail;

  const fieldMessages = Object.values(payload)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string");

  return fieldMessages.join(" ") || fallback;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!error.response) return Promise.reject(error);

    const status = error.response.status;
    const requestUrl = error.config?.url ?? "";
    const isLoginRequest = requestUrl.includes("/accounts/login/");
    const fallback = `Request failed (${status})`;
    let message = extractErrorMessage(error.response.data, fallback);

    if (status === 401 && !isLoginRequest) {
      setAccessToken(null);
      notifyUnauthorized();
      message = "Your session has expired. Please log in again.";
    }

    return Promise.reject(new ApiError(status, message));
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
  id: number;
  username: string;
  email: string;
  role: "admin" | "staff";
}

export interface CreateOrderPayload {
  customer_id: number;
  items: Array<{ product_id: number; quantity: number }>;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number;
  payment_method?: "cash" | "online";
  amount_tendered?: number | null;
}

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
  unit_price: number;
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
  low_stock_threshold: number;
  is_active: boolean;
  category: DjangoCategory;
  total_stock: string;
  created_at: string;
  updated_at: string;
}

export interface CreateIngredientPayload {
  name: string;
  unit: string;
  low_stock_threshold: number;
  category_id: number;
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
  quantity: string;
  unit_price: string;
  subtotal: string;
}

export interface DjangoOrder {
  id: number;
  customer: DjangoCustomer;
  handled_by: CurrentUser;
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
  quantity: number;
}

export interface CheckoutPayload {
  customer_id: number | null;
  items: CheckoutItemPayload[];
  payment_method: "cash" | "online";
  discount_type: "none" | "percent" | "fixed";
  discount_value: number;
  amount_tendered: number | null;
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
