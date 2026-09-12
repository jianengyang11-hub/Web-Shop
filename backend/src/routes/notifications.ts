import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { listNotifications } from "../notifications/mockAdapter";

export const notifications = new Hono<AppEnv>();

notifications.get("/notifications", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await listNotifications(c.env.DB, tenant.id));
});
