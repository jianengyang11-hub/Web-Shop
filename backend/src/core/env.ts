import { Tenant } from "../models/types";

export interface Bindings {
  DB: D1Database;
  META_VERIFY_TOKEN?: string;
  JWT_SECRET?: string;
}

export interface Variables {
  tenant: Tenant;
  authTenantId: string;
  authStaffId: string;
  authRole: "OWNER" | "STAFF";
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
