import { createMiddleware } from "hono/factory";
import { AppEnv } from "../core/env";
import { verifyAuthToken } from "../core/authToken";

/** Requires a valid Bearer JWT on every /api/:tenantId/* route, and requires its `tenantId`
 * claim to match the URL's :tenantId — otherwise a valid token for one shop could be replayed
 * against another shop's URL. Runs before tenantMiddleware. */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const secret = c.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not configured");
    return c.json({ detail: "Server misconfiguration" }, 500);
  }

  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return c.json({ detail: "Missing bearer token" }, 401);

  let payload;
  try {
    payload = await verifyAuthToken(token, secret);
  } catch {
    return c.json({ detail: "Invalid or expired token" }, 401);
  }

  const tenantId = c.req.param("tenantId");
  if (!tenantId || payload.tenantId !== tenantId) {
    return c.json({ detail: "Token does not grant access to this shop" }, 403);
  }

  c.set("authTenantId", payload.tenantId);
  await next();
});
