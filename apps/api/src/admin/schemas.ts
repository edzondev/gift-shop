import * as v from "valibot";
import { decodeCursor, fieldsSchema, occasionsSchema } from "../products/schemas";

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

const SLUG = "slug must be lowercase letters, digits, and single hyphens, at most 80 characters";
const PREP = "prepDays must be an integer from 0 to 30";
const STOCK = "initialStock must be an integer from 0 to 999";
const DELTA = "delta must be a non-zero integer from -999 to 999";

function cents(label: string) {
  const message = `${label} must be an integer greater than 0`;
  return v.pipe(v.number(message), v.integer(message), v.minValue(1, message));
}

function requiredText(label: string) {
  return v.pipe(v.string(), v.trim(), v.minLength(1, `${label} must not be empty`));
}

const slugSchema = v.pipe(
  v.string(),
  v.maxLength(80, SLUG),
  v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, SLUG),
);

const tagSchema = v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1, "tag must not be empty")));

const sizesSchema = v.object({
  classic: requiredText("sizes.classic"),
  large: requiredText("sizes.large"),
  largeExtraCents: cents("largeExtraCents"),
});

const productFields = {
  slug: slugSchema,
  name: requiredText("name"),
  priceCents: cents("priceCents"),
  oldPriceCents: v.nullable(cents("oldPriceCents")),
  prepDays: v.pipe(v.number(PREP), v.integer(PREP), v.minValue(0, PREP), v.maxValue(30, PREP)),
  description: requiredText("description"),
  fields: fieldsSchema,
  occasions: occasionsSchema,
  tag: tagSchema,
  sizes: sizesSchema,
  active: v.boolean("active must be a boolean"),
};

export const productInputSchema = v.strictObject({
  ...productFields,
  initialStock: v.optional(
    v.pipe(v.number(STOCK), v.integer(STOCK), v.minValue(0, STOCK), v.maxValue(999, STOCK)),
  ),
});

export const productPatchSchema = v.pipe(
  v.strictObject(
    {
      slug: v.optional(productFields.slug),
      name: v.optional(productFields.name),
      priceCents: v.optional(productFields.priceCents),
      oldPriceCents: v.optional(productFields.oldPriceCents),
      prepDays: v.optional(productFields.prepDays),
      description: v.optional(productFields.description),
      fields: v.optional(productFields.fields),
      occasions: v.optional(productFields.occasions),
      tag: v.optional(productFields.tag),
      sizes: v.optional(productFields.sizes),
      active: v.optional(productFields.active),
    },
    "unknown field",
  ),
  v.check(
    (value) => Object.values(value).some((item) => item !== undefined),
    "body must include a field",
  ),
);

export const stockDeltaSchema = v.object({
  delta: v.pipe(
    v.number(DELTA),
    v.integer(DELTA),
    v.minValue(-999, DELTA),
    v.maxValue(999, DELTA),
    v.check((value) => value !== 0, DELTA),
  ),
});

const productCursorSchema = v.pipe(v.string(), v.transform(decodeCursor), v.string(CURSOR_MESSAGE));

export const adminProductsQuerySchema = v.pipe(
  v.object({
    cursor: v.optional(productCursorSchema),
    limit: v.optional(limitSchema),
  }),
  v.transform((query) => ({
    cursor: query.cursor,
    limit: query.limit ?? 20,
  })),
);

export type ProductPatch = v.InferOutput<typeof productPatchSchema>;
export type AdminProductsQuery = v.InferOutput<typeof adminProductsQuerySchema>;
