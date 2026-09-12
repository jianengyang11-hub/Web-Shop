import { Tenant } from "../models/types";

export interface Bindings {
  DB: D1Database;
  WHATSAPP_VERIFY_TOKEN?: string;
}

export interface Variables {
  tenant: Tenant;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
