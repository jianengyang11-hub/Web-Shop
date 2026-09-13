import { clearToken, getToken, setStaffIdentity, setToken } from "../auth";
import { clearTenantId, getTenantId, setTenantId } from "../tenant";
import type { Staff } from "../types";

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

    // The saved shop id itself no longer exists (deleted, or a stale/borrowed browser profile) —
    // tenantMiddleware's 404 fires before any resource lookup, so this can only mean the shop is
    // gone, not "some order/product wasn't found". Recover the same way as an expired token
    // instead of leaving the user stuck on a raw error.
    if (res.status === 404 && /^Tenant .* not found$/.test(detail)) {
      clearToken();
      clearTenantId();
      window.location.reload();
      throw new ApiError(404, "Shop no longer exists");
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

export async function createTenant(
  name: string,
  pin: string,
  id?: string
): Promise<{ id: string; name: string; recoveryCode: string }> {
  const res = await fetch(`${API_ROOT}/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, pin }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

/** "Forgot PIN" recovery — no shop id needed, the recovery code alone identifies the account.
 * Sets a new PIN and returns a freshly rotated recovery code (the old one stops working). */
export async function recoverPin(
  recoveryCode: string,
  newPin: string
): Promise<{ tenantId: string; tenantName: string; staffName: string; newRecoveryCode: string }> {
  const res = await fetch(`${API_ROOT}/auth/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recoveryCode, newPin }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

/** Changes the PIN for the currently logged-in tenant. Not tenant-scoped through `api` since the
 * endpoint lives under /api/tenants/:id/pin rather than /api/:tenantId/..., but it still requires
 * the caller's own bearer token. */
export async function changePin(tenantId: string, pin: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_ROOT}/tenants/${tenantId}/pin`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
}

/** Logs in and stores the tenant id, token, and which staff member the PIN matched. */
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
  setStaffIdentity(data.staff.name, data.staff.role);
}

/** Owner-only: manage the shop's staff accounts. */
export async function listStaff(): Promise<Staff[]> {
  return api.get<Staff[]>("/staff");
}

export async function addStaff(name: string, pin: string): Promise<Staff & { recoveryCode: string }> {
  return api.post<Staff & { recoveryCode: string }>("/staff", { name, pin });
}

export async function resetStaffPin(staffId: string, pin: string): Promise<void> {
  await api.put(`/staff/${staffId}/pin`, { pin });
}

export async function removeStaff(staffId: string): Promise<void> {
  await api.delete(`/staff/${staffId}`);
}

/** Generates (and overwrites) the CALLER's own recovery code, for the "forgot PIN" flow.
 * Returned in plaintext exactly once — only its hash is ever stored server-side. */
export async function generateMyRecoveryCode(): Promise<string> {
  return (await api.post<{ recoveryCode: string }>("/staff/me/recovery-code")).recoveryCode;
}
