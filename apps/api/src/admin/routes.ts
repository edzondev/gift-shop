import { Hono } from "hono";
import { validator } from "hono/validator";
import { type ApiEnv, invalidTransition, orderNotFound } from "../errors";
import { validationHook } from "../validation";
import { accessAuth } from "./access";
import { readAdminOrder, readCapture, readSummary, searchOrders, setOrderStatus } from "./queries";
import { ordersQuerySchema, statusBodySchema } from "./schemas";

const orders = new Hono<ApiEnv>()
  .get("/", validator("query", validationHook(ordersQuerySchema)), async (c) => {
    const page = await searchOrders(c.env.DB, c.req.valid("query"));
    return c.json(page, 200);
  })
  .get("/:code/capture", async (c) => {
    const capture = await readCapture(c.env.DB, c.env.FILES, c.req.param("code"));
    if (capture === null) return c.json(orderNotFound(), 404);
    return c.body(capture.body, 200, {
      "cache-control": "private, no-store",
      "content-type": capture.contentType,
    });
  })
  .get("/:code", async (c) => {
    const order = await readAdminOrder(c.env.DB, c.req.param("code"));
    if (order === null) return c.json(orderNotFound(), 404);
    return c.json(order, 200);
  })
  .post("/:code/status", validator("json", validationHook(statusBodySchema)), async (c) => {
    const result = await setOrderStatus(c.env.DB, {
      code: c.req.param("code"),
      to: c.req.valid("json").to,
      now: new Date(),
    });
    if (result.type === "not_found") return c.json(orderNotFound(), 404);
    if (result.type === "invalid_transition") return c.json(invalidTransition(), 409);
    return c.json(result.order, 200);
  });

export const admin = new Hono<ApiEnv>()
  .use("*", accessAuth)
  .get("/summary", async (c) => {
    const summary = await readSummary(c.env.DB, new Date());
    return c.json(summary, 200);
  })
  .route("/orders", orders);
