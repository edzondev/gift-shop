import * as v from "valibot";
import type { ProductCard, ProductDetail } from "../types";
import { fieldsSchema, occasionsSchema } from "./schemas";

export function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`expected string at ${key}`);
  return value;
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`expected number at ${key}`);
  return value;
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`expected string at ${key}`);
  return value;
}

function readNullableNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "number") throw new Error(`expected number at ${key}`);
  return value;
}

function parseColumn<Schema extends v.GenericSchema>(
  schema: Schema,
  raw: string,
): v.InferOutput<Schema> {
  const parsed = v.safeParse(schema, JSON.parse(raw));
  if (!parsed.success) throw new Error("invalid json column");
  return parsed.output;
}

function readCard(row: Record<string, unknown>, photoKeys: string[]) {
  const stock = readNumber(row, "stock");
  const fields = parseColumn(fieldsSchema, readString(row, "fields"));
  const card: ProductCard = {
    slug: readString(row, "slug"),
    name: readString(row, "name"),
    priceCents: readNumber(row, "price_cents"),
    oldPriceCents: readNullableNumber(row, "old_price_cents"),
    tag: readNullableString(row, "tag"),
    occasions: parseColumn(occasionsSchema, readString(row, "occasions")),
    prepDays: readNumber(row, "prep_days"),
    photoKeys,
    customizable: fields.length > 0,
    stockLeft: stock > 3 ? null : stock,
  };
  return { card, fields, stock };
}

export function toProductCard(row: Record<string, unknown>, photoKeys: string[]): ProductCard {
  return readCard(row, photoKeys).card;
}

export function toProductDetail(row: Record<string, unknown>, photoKeys: string[]): ProductDetail {
  const read = readCard(row, photoKeys);
  return {
    ...read.card,
    id: readString(row, "id"),
    description: readString(row, "description"),
    fields: read.fields,
    sizes: {
      classic: readString(row, "size_classic"),
      large: readString(row, "size_large"),
      largeExtraCents: readNumber(row, "large_extra_cents"),
    },
    inStock: read.stock > 0,
  };
}
