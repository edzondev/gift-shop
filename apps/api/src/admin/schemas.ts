import * as v from "valibot";
import { decodeCursor } from "../products/schemas";

const LIMIT_MESSAGE = "limit must be an integer from 1 to 50";
const CURSOR_MESSAGE = "cursor is invalid";

export const orderStatusSchema = v.picklist([
  "por_verificar",
  "confirmado",
  "en_preparacion",
  "listo",
  "entregado",
  "rechazado",
]);

const limitSchema = v.pipe(
  v.string(),
  v.regex(/^\d+$/, LIMIT_MESSAGE),
  v.transform(Number),
  v.minValue(1, LIMIT_MESSAGE),
  v.maxValue(50, LIMIT_MESSAGE),
);

const cursorSchema = v.pipe(
  v.string(),
  v.transform(decodeCursor),
  v.string(CURSOR_MESSAGE),
  v.transform(Number),
  v.integer(CURSOR_MESSAGE),
  v.minValue(1, CURSOR_MESSAGE),
);

export const ordersQuerySchema = v.pipe(
  v.object({
    status: v.optional(orderStatusSchema),
    q: v.optional(v.string()),
    cursor: v.optional(cursorSchema),
    limit: v.optional(limitSchema),
  }),
  v.transform((query) => ({
    status: query.status,
    q: query.q === undefined || query.q === "" ? undefined : query.q,
    cursor: query.cursor,
    limit: query.limit ?? 20,
  })),
);

export const statusBodySchema = v.object({
  to: orderStatusSchema,
});

export type OrdersQuery = v.InferOutput<typeof ordersQuerySchema>;
