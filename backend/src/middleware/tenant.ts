import { createMiddleware } from "hono/factory";
import { NotFoundError } from "../core/exceptions";
import { AppEnv } from "../core/env";
import * as tenantRepository from "../repositories/tenantRepository";

/** Resolves and validates :tenantId for every /api/:tenantId/* route. 404s on an unknown tenant
 * before any repository/service function runs, so nothing downstream needs to re-check it. */
export const tenantMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const tenantId = c.req.param("tenantId");
  if (!tenantId) throw new NotFoundError("Tenant id missing from path");
  const tenant = await tenantRepository.get(c.env.DB, tenantId);
  if (!tenant) throw new NotFoundError(`Tenant ${tenantId} not found`);
  c.set("tenant", tenant);
  await next();
});
