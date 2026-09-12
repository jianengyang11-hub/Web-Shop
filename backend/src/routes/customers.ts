import { Hono } from "hono";
import { NotFoundError } from "../core/exceptions";
import { AppEnv } from "../core/env";
import * as customerRepository from "../repositories/customerRepository";

export const customers = new Hono<AppEnv>();

customers.get("/customers", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await customerRepository.listAll(c.env.DB, tenant.id));
});

customers.get("/customers/:id", async (c) => {
  const tenant = c.get("tenant");
  const customer = await customerRepository.get(c.env.DB, tenant.id, c.req.param("id"));
  if (!customer) throw new NotFoundError(`Customer ${c.req.param("id")} not found`);
  return c.json(customer);
});
