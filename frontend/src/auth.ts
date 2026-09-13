import type { StaffRole } from "./types";

const TOKEN_KEY = "shop.authToken";
const STAFF_NAME_KEY = "shop.staffName";
const STAFF_ROLE_KEY = "shop.staffRole";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STAFF_NAME_KEY);
    localStorage.removeItem(STAFF_ROLE_KEY);
  } catch {
    // ignore
  }
}

export function getStaffName(): string | null {
  try {
    return localStorage.getItem(STAFF_NAME_KEY);
  } catch {
    return null;
  }
}

export function getStaffRole(): StaffRole | null {
  try {
    return localStorage.getItem(STAFF_ROLE_KEY) as StaffRole | null;
  } catch {
    return null;
  }
}

export function setStaffIdentity(name: string, role: StaffRole): void {
  try {
    localStorage.setItem(STAFF_NAME_KEY, name);
    localStorage.setItem(STAFF_ROLE_KEY, role);
  } catch {
    // ignore
  }
}
