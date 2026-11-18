import * as v from "valibot";
import type { ProductCard, ProductDetail } from "../types";
import { fieldsSchema, occasionsSchema } from "./schemas";

function jsonColumn<Schema extends v.GenericSchema>(schema: Schema) {
  return v.pipe(v.string(), v.parseJson(), schema);
}

export const productRowSchema = v.object({
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  price_cents: v.number(),
  old_price_cents: v.nullable(v.number()),
  stock: v.number(),
  prep_days: v.number(),
  description: v.string(),
  fields: jsonColumn(fieldsSchema),
  occasions: jsonColumn(occasionsSchema),
  tag: v.nullable(v.string()),
  size_classic: v.string(),
  size_large: v.string(),
  large_extra_cents: v.number(),
});

export type ProductRow = v.InferOutput<typeof productRowSchema>;

export function toProductCard(row: ProductRow, photoKeys: string[]): ProductCard {
  return {
    slug: row.slug,
    name: row.name,
    priceCents: row.price_cents,
    oldPriceCents: row.old_price_cents,
    tag: row.tag,
    occasions: row.occasions,
    prepDays: row.prep_days,
    photoKeys,
    customizable: row.fields.length > 0,
    stockLeft: row.stock > 3 ? null : row.stock,
  };
}

export function toProductDetail(row: ProductRow, photoKeys: string[]): ProductDetail {
  return {
    ...toProductCard(row, photoKeys),
    id: row.id,
    description: row.description,
    fields: row.fields,
    sizes: {
      classic: row.size_classic,
      large: row.size_large,
      largeExtraCents: row.large_extra_cents,
    },
    inStock: row.stock > 0,
  };
}
