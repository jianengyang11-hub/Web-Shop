import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppEnv } from "./core/env";
import { AppError } from "./core/exceptions";
import { tenantMiddleware } from "./middleware/tenant";
import { ai } from "./routes/ai";
import { customers } from "./routes/customers";
import { dashboard } from "./routes/dashboard";
import { notifications } from "./routes/notifications";
import { orders } from "./routes/orders";
import { products } from "./routes/products";
import { tenants } from "./routes/tenants";
import { variants } from "./routes/variants";
import { whatsappMessages } from "./routes/whatsappMessages";
import { whatsapp } from "./webhooks/whatsapp";

const app = new Hono<AppEnv>();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

// WhatsApp webhook is not tenant-scoped in the URL — Meta calls one fixed URL per App, and the
// tenant is resolved from the inbound payload's phone_number_id (see webhooks/whatsapp.ts).
app.route("/", whatsapp);

// Tenant onboarding/lookup — not tenant-scoped (there's no tenant yet when creating one).
app.route("/api", tenants);

// Every other API route is tenant-scoped: /api/:tenantId/...
app.use("/api/:tenantId/*", tenantMiddleware);
app.route("/api/:tenantId", products);
app.route("/api/:tenantId", variants);
app.route("/api/:tenantId", customers);
app.route("/api/:tenantId", orders);
app.route("/api/:tenantId", ai);
app.route("/api/:tenantId", notifications);
app.route("/api/:tenantId", dashboard);
app.route("/api/:tenantId", whatsappMessages);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ detail: err.message }, err.statusCode as never);
  }
  console.error(err);
  return c.json({ detail: "Internal server error" }, 500);
});

export default app;
