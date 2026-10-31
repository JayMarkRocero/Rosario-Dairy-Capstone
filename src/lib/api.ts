import axios, { AxiosError } from "axios";
import { clearDataCache, invalidateDataCache, INVENTORY_UPDATED } from "./dataCache";
import { acceptIdleSession, currentSessionId, endIdleSession, getIdleSession, IDLE_MESSAGE, isTerminalSessionCode, onIdleSessionEnd, reconcileStoredSession, SESSION_MESSAGE, sessionDeadlineReached, storedSessionEnd, syncIdleSessionToken, tokenSessionId, type LoginSession, type SessionEndReason } from "./idleSession";

const REFRESH_TOKEN_KEY = "rosario_refresh_token";

const ACCESS_TOKEN_KEY = "rosario_access_token";

const axiosInstance = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || "/backend",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

export default axiosInstance;

export class ApiError extends Error {
  status: number;
  retryAfterMs?: number;
  code?: string;

  constructor(status: number, message: string, public fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type UnauthorizedListener = (reason?: SessionEndReason) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(reason?: SessionEndReason) {
  unauthorizedListeners.forEach((listener) => listener(reason));
}

onIdleSessionEnd((reason, id) => {
  // A delayed expiry event must never clear a newer sign-in's shared credentials.
  if (id && tokenSessionId(getAccessToken()) !== id) { synchronizeSessionStorage(); return; }
  setAccessToken(null); setRefreshToken(null); notifyUnauthorized(reason);
});
export function handleTerminalSession(code: unknown, generation = sessionGeneration) {
  if (!isTerminalSessionCode(code) || generation !== sessionGeneration) return false;
  endIdleSession(code); return true;
}

// Keep a session usable when browser policy blocks token persistence.
// Failed removals also override any old persisted token until the next write.
const sessionTokens = new Map<string, string | null>();
let sessionGeneration = 0;
export const getSessionGeneration = () => sessionGeneration;
type SessionRequest = { sessionGeneration?: number; retried?: boolean };
const sessionStorageListeners = new Set<() => void>();
let storageWindow: Window | undefined;
let knownTokens: (string | null)[] = [];

function rememberTokens() { knownTokens = [getAccessToken(), getRefreshToken()]; syncIdleSessionToken(knownTokens[0]); }

function storageChanged(event: StorageEvent) {
  if (event.key !== null && ![ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY].includes(event.key)) return;
  try { if (event.storageArea && event.storageArea !== localStorage) return; } catch { return; }
  synchronizeSessionStorage();
}

function ensureSessionStorageSync() {
  if (typeof window === "undefined" || storageWindow === window) return;
  storageWindow?.removeEventListener("storage", storageChanged);
  storageWindow = window;
  rememberTokens();
  window.addEventListener("storage", storageChanged);
}

export function synchronizeSessionStorage() {
  ensureSessionStorageSync();
  const tokens = [getAccessToken(), getRefreshToken()];
  if (!knownTokens.length) { knownTokens = tokens; syncIdleSessionToken(tokens[0]); return; }
  if (tokens.every((token, index) => token === knownTokens[index])) return;
  const previousId = currentSessionId();
  if (previousId && tokenSessionId(tokens[0]) === previousId && tokens[0] && tokens[1]) {
    // Rotating the same sign-in must not unmount forms or clear private caches.
    knownTokens = tokens; reconcileStoredSession(); return;
  }
  const endedReason = !tokens[0] && previousId ? storedSessionEnd(previousId) : undefined;
  knownTokens = tokens;
  sessionGeneration += 1;
  syncIdleSessionToken(tokens[0]);
  clearDataCache();
  sessionStorageListeners.forEach(listener => listener());
  if (endedReason) notifyUnauthorized(endedReason);
}

export function onSessionStorageChange(listener: () => void) {
  ensureSessionStorageSync();
  sessionStorageListeners.add(listener);
  return () => { sessionStorageListeners.delete(listener); };
}

function readToken(key: string): string | null {
  if (sessionTokens.has(key)) return sessionTokens.get(key) ?? null;
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function writeToken(key: string, token: string | null) {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
    sessionTokens.delete(key);
  } catch {
    sessionTokens.set(key, token);
  }
}

export function setAccessToken(token: string | null, refreshingSession = false) {
  if (!refreshingSession && token !== getAccessToken()) { sessionGeneration += 1; clearDataCache(); }
  writeToken(ACCESS_TOKEN_KEY, token);
  syncIdleSessionToken(token);
  rememberTokens();
}

export function getAccessToken(): string | null {
  return readToken(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (!token) { if (getRefreshToken()) sessionGeneration += 1; clearDataCache(); }
  writeToken(REFRESH_TOKEN_KEY, token);
  rememberTokens();
}

export function getRefreshToken(): string | null {
  return readToken(REFRESH_TOKEN_KEY);
}

const PUBLIC_AUTH_PATHS = ["/accounts/login/", "/accounts/forgot-password/", "/accounts/reset-password/", "/accounts/refresh/"];

let refreshRequest: Promise<string> | null = null;
let refreshGeneration = -1;
const REFRESH_ATTEMPT_KEY = "rosario:refresh-attempt";
function refreshUnavailable(message = "Automatic session renewal is unavailable. Sign out and sign in again using a browser with session coordination enabled.") {
  const error = new ApiError(503, message); error.code = "refresh_coordination_unavailable"; return error;
}
async function withTokenRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) throw refreshUnavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let entered = false;
  try {
    return await navigator.locks.request("rosario:token-refresh", { signal: controller.signal }, () => { entered = true; return work(); });
  } catch (error) { if (!entered) throw refreshUnavailable(); throw error; }
  finally { clearTimeout(timer); }
}
/** The refresh token itself is never copied into coordination metadata. */
async function claimRefresh(refresh: string): Promise<(retryAfterMs?: number) => void> {
  if (!globalThis.crypto?.subtle) throw refreshUnavailable();
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(refresh))), byte => byte.toString(16).padStart(2, "0")).join("");
  const uncertain = () => refreshUnavailable("The previous session renewal could not be confirmed. Sign out and sign in again; no automatic refresh retry was sent.");
  try {
    const previous = localStorage.getItem(REFRESH_ATTEMPT_KEY);
    if (previous) {
      const saved = JSON.parse(previous);
      if (saved.fingerprint === fingerprint) {
        if (!Number.isFinite(saved.retryAt)) throw uncertain();
        if (saved.retryAt > Date.now()) { const error = new ApiError(429, "Session renewal is temporarily limited. Please try again later."); error.retryAfterMs = saved.retryAt - Date.now(); throw error; }
      }
    }
    const value = JSON.stringify({ fingerprint });
    localStorage.setItem(REFRESH_ATTEMPT_KEY, value);
    if (localStorage.getItem(REFRESH_ATTEMPT_KEY) !== value) throw refreshUnavailable();
    return retryAfterMs => { try {
      if (localStorage.getItem(REFRESH_ATTEMPT_KEY) !== value) return;
      if (retryAfterMs !== undefined) localStorage.setItem(REFRESH_ATTEMPT_KEY, JSON.stringify({ fingerprint, retryAt: Date.now() + retryAfterMs }));
      else localStorage.removeItem(REFRESH_ATTEMPT_KEY);
    } catch { /* Retain the fail-closed guard. */ } };
  } catch (error) { if (error instanceof ApiError) throw error; throw refreshUnavailable(); }
}
/** Explicit logout may use captured credentials after local cleanup; never revive them. */
export function refreshLogoutCredentials(access: string, refresh: string, generation: number) {
  const id = tokenSessionId(access);
  return withTokenRefreshLock(async () => {
    synchronizeSessionStorage();
    const peerAccess = getAccessToken(), peerRefresh = getRefreshToken();
    if (id && peerAccess && peerRefresh && tokenSessionId(peerAccess) === id && peerRefresh !== refresh) return { access: peerAccess, refresh: peerRefresh };
    const release = await claimRefresh(refresh);
    try {
      const { data } = await axiosInstance.post<{ access: string; refresh?: string }>("/accounts/refresh/", { refresh }, { headers: {}, ...{ sessionGeneration: generation } });
      if (!data.access) throw new ApiError(502, "Unable to refresh your session for logout.");
      release(); return { access: data.access, refresh: data.refresh ?? refresh };
    } catch (error) {
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) release();
      else if (error instanceof ApiError && error.status === 429) release(error.retryAfterMs ?? 60_000);
      throw error;
    }
  });
}
export function refreshAccessToken(): Promise<string> {
  const generation = sessionGeneration;
  if (refreshRequest && refreshGeneration === generation) return refreshRequest;
  refreshGeneration = generation;
  const refresh = getRefreshToken();
  const originalAccess = getAccessToken(), id = tokenSessionId(originalAccess);
  if (!refresh) return Promise.reject(new ApiError(401, "Please log in again."));
  refreshRequest = withTokenRefreshLock(async () => {
    synchronizeSessionStorage();
    const peerAccess = getAccessToken(), peerRefresh = getRefreshToken();
    if (peerRefresh !== refresh) {
      if (id && peerAccess && peerRefresh && tokenSessionId(peerAccess) === id && !sessionDeadlineReached()) return peerAccess;
      throw new ApiError(409, "Session changed. Please log in again.");
    }
    if (sessionGeneration !== generation || peerAccess !== originalAccess) throw new ApiError(409, "Session changed. Please log in again.");
    const release = await claimRefresh(refresh);
    try {
      if (sessionGeneration !== generation || getRefreshToken() !== refresh) throw new ApiError(409, "Session changed.");
      const { data } = await axiosInstance.post<{ access: string; refresh?: string; session?: LoginSession }>("/accounts/refresh/", { refresh }, { headers: {}, ...{ sessionGeneration: generation } });
      if (sessionGeneration !== generation || getRefreshToken() !== refresh) throw new ApiError(401, "Session changed. Please log in again.");
      if (!data.access) throw refreshUnavailable("Unable to confirm session renewal. Sign out and sign in again.");
      setAccessToken(data.access, true);
      if (data.refresh) setRefreshToken(data.refresh);
      if (data.session) acceptIdleSession(data.session);
      // Clear only after both rotated credentials can be shared with waiting tabs.
      try { if (localStorage.getItem(ACCESS_TOKEN_KEY) === data.access && localStorage.getItem(REFRESH_TOKEN_KEY) === (data.refresh ?? refresh)) release(); } catch { /* Keep recovery blocked for other tabs. */ }
      return data.access;
    } catch (error) {
      synchronizeSessionStorage();
      if (id && getAccessToken() && getRefreshToken() !== refresh && tokenSessionId(getAccessToken()) === id && !sessionDeadlineReached()) return getAccessToken()!;
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) release();
      else if (error instanceof ApiError && error.status === 429) release(error.retryAfterMs ?? 60_000);
      throw error;
    }
  }).finally(() => { if (refreshGeneration === generation) refreshRequest = null; });
  return refreshRequest;
}

export interface PaginatedResponse<T> { count: number; results: T[]; previous?: string | null; next?: string | null }
export async function getAllPages<T>(url: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  const generation = sessionGeneration;
  const checkCanceled = () => {
    if (signal?.aborted || generation !== sessionGeneration) throw new axios.CanceledError("Obsolete history request");
  };
  let page = 1;
  while (true) {
    checkCanceled();
    const { data } = await axiosInstance.get<T[] | PaginatedResponse<T>>(url, { params: { ...params, page }, signal });
    checkCanceled();
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
  const origin = sessionGeneration;
  synchronizeSessionStorage();
  if (config.url) config.url = appendTrailingSlash(config.url);
  if (origin !== sessionGeneration && !PUBLIC_AUTH_PATHS.includes(config.url ?? "")) {
    throw new ApiError(409, "Your account changed in another tab. Wait for your session to reload before trying again.");
  }
  if (!["/accounts/login/", "/accounts/forgot-password/", "/accounts/reset-password/", "/accounts/logout/"].includes(config.url ?? "") && sessionDeadlineReached()) {
    endIdleSession("session_idle_timeout");
    const error = new ApiError(401, IDLE_MESSAGE); error.code = "session_idle_timeout"; throw error;
  }
  if (currentSessionId() && !getIdleSession() && !["get", "head", "options"].includes(config.method ?? "get") &&
      !PUBLIC_AUTH_PATHS.includes(config.url ?? "") && config.url !== "/accounts/logout/") {
    throw new ApiError(503, "Your session deadline has not been verified. Reconnect before submitting changes.");
  }
  (config as typeof config & SessionRequest).sessionGeneration ??= sessionGeneration;

  const token = getAccessToken();
  if (token && !config.headers.Authorization && !PUBLIC_AUTH_PATHS.includes(config.url ?? "")) config.headers.Authorization = `Bearer ${token}`;

  return config;
}, error => { throw error; }, { synchronous: true });

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
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return "The request timed out. Please check your connection and try again.";
    }
    return extractErrorMessage(error.response?.data, fallback);
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

axiosInstance.interceptors.response.use(
  (response) => {
    synchronizeSessionStorage();
    const origin = (response.config as typeof response.config & SessionRequest).sessionGeneration;
    if (origin !== undefined && origin !== sessionGeneration && !PUBLIC_AUTH_PATHS.includes(response.config.url ?? "") && response.config.url !== "/accounts/logout/") {
      return Promise.reject(new ApiError(409, "This request belongs to a previous session."));
    }
    const method = response.config.method?.toLowerCase();
    const path = response.config.url ?? "";
    if (method && !["get", "head", "options"].includes(method)) {
      if (path.startsWith("/sales/encoding/") || path.startsWith("/sales/orders/")) invalidateDataCache(["orders", "sales", "dashboard", "inventory", "reports", "customers"]);
      else if (path.startsWith("/sales/checkout/") || path.startsWith("/sales/transactions/")) invalidateDataCache(["sales", "dashboard", "inventory", "reports", "customers"]);
      else if (path.startsWith("/inventory/categories/")) invalidateDataCache(["categories", "inventory", "reports", "dashboard"]);
      else if (path.startsWith("/inventory/")) invalidateDataCache(["inventory", "categories", "dashboard", "reports"]);
      else if (path.startsWith("/sales/customers/")) invalidateDataCache(["customers", "reports"]);
      else if (path === "/accounts/user/") invalidateDataCache(["users", "sales", "orders", "dashboard"]);
      else if (path.startsWith("/accounts/users/") || ["/accounts/register/", "/accounts/admin-reset-password/"].includes(path)) invalidateDataCache(["users"]);
      else if (path.startsWith("/settings/") && !path.startsWith("/settings/inbox/")) invalidateDataCache(["settings", "inventory", "dashboard", "reports"]);
      if (typeof window !== "undefined" && (["/sales/encoding/", "/sales/checkout/", "/sales/orders/", "/sales/transactions/", "/inventory/stock-adjustments/"].some(prefix => path.startsWith(prefix)))) window.dispatchEvent(new Event(INVENTORY_UPDATED));
    }
    return response;
  },
  async (error: AxiosError) => {
    // An obsolete GET must not renew tokens or report a user-facing API error.
    if (axios.isCancel(error) || error.config?.signal?.aborted) return Promise.reject(new axios.CanceledError());
    synchronizeSessionStorage();
    if (!error.response) return Promise.reject(error);

    const status = error.response.status;
    const requestUrl = error.config?.url ?? "";
    const isPublicAuthRequest = PUBLIC_AUTH_PATHS.includes(requestUrl);
    const config = error.config as (typeof error.config & SessionRequest);
    const activeSession = () => config?.sessionGeneration === undefined || config.sessionGeneration === sessionGeneration;
    if (!isPublicAuthRequest && requestUrl !== "/accounts/logout/" && !activeSession()) {
      return Promise.reject(new ApiError(status, "This request belongs to a previous session."));
    }
    // Inspect terminal session codes before any token refresh or mutation replay.
    let data = error.response.data;
    if (data instanceof Blob) {
      try { data = JSON.parse(await data.text()); } catch { data = null; }
    }
    const payload = data as { code?: unknown } | undefined;
    if (status === 401 && requestUrl !== "/accounts/login/" && requestUrl !== "/accounts/logout/" &&
        activeSession() && isTerminalSessionCode(payload?.code)) {
      handleTerminalSession(payload.code);
      const terminal = new ApiError(401, payload.code === "session_idle_timeout" ? IDLE_MESSAGE : SESSION_MESSAGE);
      terminal.code = payload.code; return Promise.reject(terminal);
    }
    if (status === 401 && !isPublicAuthRequest && requestUrl !== "/accounts/logout/" && config && !config.retried && getRefreshToken()) {
      config.retried = true;
      try {
        const usedAccess = String(config.headers.Authorization ?? "").replace(/^Bearer /, "");
        const currentAccess = getAccessToken();
        if (currentAccess && currentAccess !== usedAccess && tokenSessionId(currentAccess) && tokenSessionId(currentAccess) === tokenSessionId(usedAccess)) {
          config.headers.Authorization = `Bearer ${currentAccess}`;
          return axiosInstance.request(config);
        }
        const token = await refreshAccessToken();
        if (!activeSession()) throw new ApiError(409, "Session changed.");
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance.request(config);
      } catch (refreshError) {
        if (refreshError instanceof ApiError && isTerminalSessionCode(refreshError.code)) throw refreshError;
        // A temporary refresh outage must not discard a valid refresh token.
        if (!(refreshError instanceof ApiError) || ![400, 401].includes(refreshError.status)) throw refreshError;
      }
    }
    const fallback = status === 429 ? "Too many attempts. Please wait before trying again." : `Request failed (${status})`;
    const fieldErrors: Record<string, string[]> = {};
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.every(item => typeof item === "string")) fieldErrors[key] = value;
      }
    }
    let message = extractErrorMessage(data, fallback);

    if (status === 401 && !isPublicAuthRequest && requestUrl !== "/accounts/logout/" && activeSession() && (getAccessToken() || getRefreshToken())) {
      setAccessToken(null);
      setRefreshToken(null);
      notifyUnauthorized();
      message = "Your session has expired. Please log in again.";
    }

    const apiError = new ApiError(status, message, fieldErrors);
    if (data && typeof data === "object" && "code" in data && typeof data.code === "string") apiError.code = data.code;
    const retryAfter = error.response.headers?.["retry-after"];
    if (retryAfter != null) {
      const seconds = Number(retryAfter);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(String(retryAfter)) - Date.now();
      if (Number.isFinite(delay)) apiError.retryAfterMs = Math.max(0, delay);
    }
    return Promise.reject(apiError);
  }
);

export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
  session?: LoginSession;
}

export interface CurrentUser {
  id?: number;
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
  icon?: string | null;
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
  shelf_life: number;
  readonly low_stock_threshold: number;
  is_active: boolean;
  category: DjangoCategory;
  total_stock: number | string;
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
  expiry_status?: "critical" | "near_expiry";
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
  shelf_life: number;
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

export interface CreateCategoryPayload {
  name: string;
  description: string;
  icon: string;
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
  current_password?: string;
  username?: string;
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
  is_active: boolean;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  transaction_count?: number;
  last_sale?: string | null;
  readonly total_spent?: string | null;
}

export interface CreateCustomerPayload {
  name: string;
  contact_number?: string | null;
  email?: string | null;
  address?: string | null;
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export interface CheckoutItemPayload {
  product_id: number; quantity: string; unit_price: string;
}
export interface CheckoutPayload {
  customer_id: number | null; items: CheckoutItemPayload[]; payment_method: "cash" | "online"; amount_tendered?: string | null;
}

export interface DjangoTransactionItem {
  line_number?: number | null;
  subtotal?: string | null;
  total_amount?: string | null;
  id: number;
  product_batch: DjangoProductBatch;
  quantity: string | number;
  unit_price: string;
  product_id_snapshot?: number | null;
  product_name_snapshot?: string | null;
  product_variant_snapshot?: string | null;
  category_id_snapshot?: number | null;
  category_name_snapshot?: string | null;
  source_product_label?: string;
  source_line_total?: string | null;
}

export interface DjangoTransaction {
  recorded_cashier?: DjangoUserSummary | null;
  transaction_number?: string | null;
  transaction_date?: string | null;
  is_manually_encoded?: boolean;
  encoded_at?: string | null;
  encoding_request_id?: string | null;
  payment_status?: "pending" | "paid" | "unknown";
  can_update_payment?: boolean | null;
  payment_updated_at?: string | null;
  payment_updated_by?: number | null;
  payment_updated_by_user?: DjangoUserSummary | null;
  id: number;
  handled_by: DjangoUserSummary;
  order?: { customer?: DjangoCustomer | null } | null;
  customer?: DjangoCustomer | null;
  subtotal: string;
  total_amount: string;
  amount_tendered: string | null;
  change_due: string | null;
  payment_method: string;
  delivery_status: string | null;
  is_voided?: boolean;
  voided_at?: string | null;
  voided_by?: number | null;
  void_reason?: string;
  items: DjangoTransactionItem[];
  created_at: string;
  source_reference?: string | null;
  source_invoice_number?: string;
  source_customer_label?: string;
  source_note?: string;
}

export interface DjangoBestSeller {
  product: string;
  sales: number;
}

export interface DjangoSalesByCategory {
  name: string;
  value: number;
}
