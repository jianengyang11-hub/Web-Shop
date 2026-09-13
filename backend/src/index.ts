import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppEnv } from "./core/env";
import { AppError } from "./core/exceptions";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";
import { ai } from "./routes/ai";
import { auth } from "./routes/auth";
import { channelMessages } from "./routes/channelMessages";
import { customers } from "./routes/customers";
import { dashboard } from "./routes/dashboard";
import { notifications } from "./routes/notifications";
import { orders } from "./routes/orders";
import { products } from "./routes/products";
import { settings } from "./routes/settings";
import { staff } from "./routes/staff";
import { staffSelf } from "./routes/staffSelf";
import { tenants } from "./routes/tenants";
import { variants } from "./routes/variants";
import { messenger } from "./webhooks/messenger";
import { whatsapp } from "./webhooks/whatsapp";

const app = new Hono<AppEnv>();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

// Meta webhooks are not tenant-scoped in the URL — Meta calls one fixed URL per App/product,
// and the tenant is resolved from the inbound payload (phone_number_id / page id). Protected by
// the shared META_VERIFY_TOKEN handshake instead of a user JWT.
app.route("/", whatsapp);
app.route("/", messenger);

// Tenant onboarding/lookup and login — not tenant-scoped/no token required yet.
app.route("/api", tenants);
app.route("/api", auth);

// Every other API route requires a valid Bearer token for this exact tenant, then resolves the
// tenant row: /api/:tenantId/...
app.use("/api/:tenantId/*", authMiddleware, tenantMiddleware);
app.route("/api/:tenantId", products);
app.route("/api/:tenantId", variants);
app.route("/api/:tenantId", customers);
app.route("/api/:tenantId", orders);
app.route("/api/:tenantId", ai);
app.route("/api/:tenantId", notifications);
app.route("/api/:tenantId", dashboard);
app.route("/api/:tenantId", channelMessages);
app.route("/api/:tenantId", settings);
app.route("/api/:tenantId", staff);
app.route("/api/:tenantId", staffSelf);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ detail: err.message }, err.statusCode as never);
  }
  console.error(err);
  return c.json({ detail: "Internal server error" }, 500);
});

export default app;
