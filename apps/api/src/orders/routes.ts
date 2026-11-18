import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { validator } from "hono/validator";
import {
  type ApiEnv,
  deliveryDateTooSoon,
  fileTooLarge,
  idempotencyConflict,
  orderNotFound,
  outOfStock,
  priceChanged,
  productUnavailable,
  unsupportedFileType,
  validationError,
} from "../errors";
import { validationHook } from "../validation";
import { MAX_BODY_BYTES } from "./logic";
import { type CreateOrderResult, createOrder, readPublicOrder } from "./queries";
import { idempotencyHeaderSchema } from "./schemas";

function issue(path: string, message: string) {
  return { path, message };
}

function respond(c: Context<ApiEnv>, result: CreateOrderResult): Response {
  switch (result.type) {
    case "created":
      return c.json(result.order, 201);
    case "replayed":
      return c.json(result.order, 200);
    case "validation":
      return c.json(validationError(result.issues), 422);
    case "file_too_large":
      return c.json(fileTooLarge(), 413);
    case "unsupported_file_type":
      return c.json(unsupportedFileType(), 415);
    case "product_unavailable":
      return c.json(productUnavailable(result.productIds), 409);
    case "out_of_stock":
      return c.json(outOfStock(result.productIds), 409);
    case "price_changed":
      return c.json(priceChanged(result.totalCents), 409);
    case "idempotency_conflict":
      return c.json(idempotencyConflict(), 409);
    case "delivery_date_too_soon":
      return c.json(deliveryDateTooSoon(), 422);
  }
}

export const orders = new Hono<ApiEnv>()
  .post(
    "/",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(fileTooLarge(), 413),
    }),
    validator("header", validationHook(idempotencyHeaderSchema)),
    async (c) => {
      const body = await c.req.parseBody();
      const orderField = body.order;
      const captureField = body.capture;
      if (typeof orderField !== "string" || !(captureField instanceof File)) {
        const issues = [];
        if (typeof orderField !== "string")
          issues.push(issue("order", "order must be a JSON string"));
        if (!(captureField instanceof File))
          issues.push(issue("capture", "capture must be a file"));
        return c.json(validationError(issues), 422);
      }
      const result = await createOrder(c.env.DB, c.env.FILES, {
        idempotencyKey: c.req.valid("header")["idempotency-key"],
        orderText: orderField,
        capture: new Uint8Array(await captureField.arrayBuffer()),
        now: new Date(),
      });
      return respond(c, result);
    },
  )
  .get("/:code", async (c) => {
    const order = await readPublicOrder(
      c.env.DB,
      c.req.param("code"),
      c.req.header("X-Order-Token"),
    );
    if (order === null) return c.json(orderNotFound(), 404);
    return c.json(order, 200);
  });
