import { isNotFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { PublicOrder } from "api";
import { createOrderInputSchema } from "api";
import * as v from "valibot";
import { apiClient } from "./api-client";
import { captureError } from "./capture";
import { readOrderPost, readPublicOrderResponse } from "./orders/result";

const orderQuerySchema = v.object({
  code: v.pipe(v.string(), v.minLength(1)),
  token: v.string(),
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Revisa los datos del pedido");
  }
}

function readForm(data: unknown): {
  order: v.InferOutput<typeof createOrderInputSchema>;
  capture: File;
  idempotencyKey: string;
} {
  if (!(data instanceof FormData)) throw new Error("Revisa los datos del pedido");
  const orderField = data.get("order");
  const capture = data.get("capture");
  const key = data.get("idempotencyKey");
  if (typeof orderField !== "string" || typeof key !== "string" || !(capture instanceof File)) {
    throw new Error("Revisa los datos del pedido");
  }
  if (!uuid.test(key)) throw new Error("Revisa los datos del pedido");
  const problem = captureError(capture);
  if (problem !== null) throw new Error(problem);
  const parsed = v.safeParse(createOrderInputSchema, parseJson(orderField));
  if (!parsed.success) throw new Error("Revisa los datos del pedido");
  return { order: parsed.output, capture, idempotencyKey: key };
}

export const placeOrder = createServerFn({ method: "POST" })
  .validator(readForm)
  .handler(async ({ data }) => {
    const client = apiClient();
    const form = new FormData();
    form.set("order", JSON.stringify(data.order));
    form.set("capture", data.capture);
    const response = await client.orders.$post(
      { header: { "idempotency-key": data.idempotencyKey } },
      { init: { body: form } },
    );
    return readOrderPost(response);
  });

export type OrderLookup = { found: true; order: PublicOrder } | { found: false };

export const getPublicOrder = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const parsed = v.safeParse(orderQuerySchema, data);
    if (!parsed.success) throw new Error("Pedido inválido");
    return parsed.output;
  })
  .handler(async ({ data }) => {
    const client = apiClient();
    const response = await client.orders[":code"].$get(
      { param: { code: data.code } },
      { headers: { "X-Order-Token": data.token } },
    );
    try {
      return { found: true, order: await readPublicOrderResponse(response) };
    } catch (error) {
      if (isNotFound(error)) return { found: false };
      throw error;
    }
  });
