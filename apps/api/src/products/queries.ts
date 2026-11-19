import * as v from "valibot";
import type { Page, ProductCard, ProductDetail } from "../types";
import { type ProductRow, productRowSchema, toProductCard, toProductDetail } from "./mappers";
import { encodeCursor, type ListQuery } from "./schemas";

export const PRODUCT_COLUMNS =
  "id, slug, name, price_cents, old_price_cents, stock, prep_days, description, fields, occasions, tag, size_classic, size_large, large_extra_cents";

const photoRowSchema = v.object({
  id: v.string(),
  product_id: v.string(),
  r2_key: v.string(),
});

export type StoredPhoto = { id: string; key: string };

export async function photosByProduct(
  db: D1Database,
  ids: readonly string[],
): Promise<Map<string, StoredPhoto[]>> {
  const grouped = new Map<string, StoredPhoto[]>();
  if (ids.length === 0) return grouped;

  const marks = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id, product_id, r2_key FROM product_photos WHERE product_id IN (${marks}) ORDER BY position`,
    )
    .bind(...ids)
    .all();

  for (const raw of result.results) {
    const row = v.parse(photoRowSchema, raw);
    const photo = { id: row.id, key: row.r2_key };
    const photos = grouped.get(row.product_id);
    if (photos === undefined) grouped.set(row.product_id, [photo]);
    else photos.push(photo);
  }
  return grouped;
}

function parsePage(raws: readonly Record<string, unknown>[]): ProductRow[] {
  return raws.map((raw) => v.parse(productRowSchema, raw));
}

export async function listProducts(db: D1Database, query: ListQuery): Promise<Page<ProductCard>> {
  const where = ["active = 1"];
  const binds: (string | number)[] = [];
  if (query.cursor !== undefined) {
    where.push("id > ?");
    binds.push(query.cursor);
  }
  if (query.occasion !== undefined) {
    where.push("EXISTS (SELECT 1 FROM json_each(occasions) WHERE value = ?)");
    binds.push(query.occasion);
  }
  binds.push(query.limit + 1);

  const result = await db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE ${where.join(" AND ")} ORDER BY id LIMIT ?`,
    )
    .bind(...binds)
    .all();

  const hasMore = result.results.length > query.limit;
  const page = parsePage(hasMore ? result.results.slice(0, query.limit) : result.results);
  const photos = await photosByProduct(
    db,
    page.map((row) => row.id),
  );
  const items = page.map((row) =>
    toProductCard(
      row,
      (photos.get(row.id) ?? []).map((photo) => photo.key),
    ),
  );
  const last = page[page.length - 1];

  return {
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(last.id) : null,
  };
}

export async function getProduct(db: D1Database, slug: string): Promise<ProductDetail | null> {
  const raw = await db
    .prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = ? AND active = 1`)
    .bind(slug)
    .first();
  if (raw === null) return null;

  const row = v.parse(productRowSchema, raw);
  const photos = await photosByProduct(db, [row.id]);
  return toProductDetail(
    row,
    (photos.get(row.id) ?? []).map((photo) => photo.key),
  );
}
