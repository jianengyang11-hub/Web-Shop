import { clearToken, getToken, setToken } from "../auth";
import { clearTenantId, getTenantId, setTenantId } from "../tenant";

const API_ROOT = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function baseUrl(): string {
  const tenantId = getTenantId();
  if (!tenantId) throw new ApiError(0, "No shop selected");
  return `${API_ROOT}/${tenantId}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    // Token missing/expired/invalid — force back to the login screen. Reloading is the simplest
    // reliable way to reset the app's state without a global auth store.
    clearToken();
    clearTenantId();
    window.location.reload();
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Not tenant-scoped, no auth required — used by the login screen to validate a shop id exists
 * before asking for a PIN. */
export async function fetchTenant(id: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(`${API_ROOT}/tenants/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createTenant(name: string, pin: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_ROOT}/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, pin }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

/** Logs in and stores both the tenant id and the token on success. */
export async function login(tenantId: string, pin: string): Promise<void> {
  const res = await fetch(`${API_ROOT}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, pin }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? "Login failed");
  }
  const data = await res.json();
  setTenantId(data.tenant.id);
  setToken(data.token);
}
