import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { OrderStatus } from "../models/enums";
import * as orderService from "../services/orderService";

export const orders = new Hono<AppEnv>();

orders.get("/orders", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.listOrders(c.env.DB, tenant.id));
});

orders.get("/orders/:id", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.getOrder(c.env.DB, tenant.id, c.req.param("id")));
});

orders.post("/orders", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const order = await orderService.createOrder(c.env.DB, tenant.id, body);
  return c.json(order, 201);
});

orders.post("/orders/:id/confirm", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.confirmOrder(c.env.DB, tenant.id, c.req.param("id")));
});

orders.post("/orders/:id/reject", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.rejectOrder(c.env.DB, tenant.id, c.req.param("id")));
});

orders.post("/orders/:id/preparing", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.advanceStatus(c.env.DB, tenant.id, c.req.param("id"), OrderStatus.PREPARING));
});

orders.post("/orders/:id/shipped", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.advanceStatus(c.env.DB, tenant.id, c.req.param("id"), OrderStatus.SHIPPED));
});

orders.post("/orders/:id/delivered", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.advanceStatus(c.env.DB, tenant.id, c.req.param("id"), OrderStatus.DELIVERED));
});

orders.post("/orders/:id/cancel", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await orderService.advanceStatus(c.env.DB, tenant.id, c.req.param("id"), OrderStatus.CANCELLED));
});
