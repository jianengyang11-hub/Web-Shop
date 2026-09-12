import { Hono } from "hono";
import { AppEnv } from "../core/env";
import * as tenantRepository from "../repositories/tenantRepository";

/** Auth-protected (mounted under /api/:tenantId, behind authMiddleware). Never returns
 * pin_hash/pin_salt — only the four integration credential fields the Owner manages here. */
export const settings = new Hono<AppEnv>();

function toIntegrationSettings(tenant: {
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  messengerPageId: string | null;
  messengerAccessToken: string | null;
}) {
  return {
    whatsappPhoneNumberId: tenant.whatsappPhoneNumberId,
    whatsappAccessToken: tenant.whatsappAccessToken,
    messengerPageId: tenant.messengerPageId,
    messengerAccessToken: tenant.messengerAccessToken,
  };
}

settings.get("/settings/integrations", async (c) => {
  const tenant = c.get("tenant");
  return c.json(toIntegrationSettings(tenant));
});

settings.put("/settings/integrations", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json<{
    whatsappPhoneNumberId?: string | null;
    whatsappAccessToken?: string | null;
    messengerPageId?: string | null;
    messengerAccessToken?: string | null;
  }>();
  const updated = await tenantRepository.updateIntegrations(c.env.DB, tenant.id, body);
  return c.json(toIntegrationSettings(updated));
});
