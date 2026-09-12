import { getTenantId } from "../tenant";

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
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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

/** Not tenant-scoped — used by the tenant gate to validate a shop id before storing it, and to
 * create a new shop. */
export async function fetchTenant(id: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(`${API_ROOT}/tenants/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createTenant(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_ROOT}/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.json();
}
