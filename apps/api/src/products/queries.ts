import type { Page, ProductCard, ProductDetail } from "../types";
import { readString, toProductCard, toProductDetail } from "./mappers";
import { encodeCursor, type ListQuery } from "./schemas";

const COLUMNS =
  "id, slug, name, price_cents, old_price_cents, stock, prep_days, description, fields, occasions, tag, size_classic, size_large, large_extra_cents";

async function photoKeysByProduct(db: D1Database, ids: string[]): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (ids.length === 0) return grouped;

  const marks = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT product_id, r2_key FROM product_photos WHERE product_id IN (${marks}) ORDER BY position`,
    )
    .bind(...ids)
    .all();

  for (const row of result.results) {
    const productId = readString(row, "product_id");
    const key = readString(row, "r2_key");
    const keys = grouped.get(productId);
    if (keys === undefined) grouped.set(productId, [key]);
    else keys.push(key);
  }
  return grouped;
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
    .prepare(`SELECT ${COLUMNS} FROM products WHERE ${where.join(" AND ")} ORDER BY id LIMIT ?`)
    .bind(...binds)
    .all();

  const hasMore = result.results.length > query.limit;
  const page = hasMore ? result.results.slice(0, query.limit) : result.results;
  const ids = page.map((row) => readString(row, "id"));
  const photos = await photoKeysByProduct(db, ids);
  const items = page.map((row) => {
    const id = readString(row, "id");
    return toProductCard(row, photos.get(id) ?? []);
  });
  const lastId = ids[ids.length - 1];

  return {
    items,
    nextCursor: hasMore && lastId !== undefined ? encodeCursor(lastId) : null,
  };
}

export async function getProduct(db: D1Database, slug: string): Promise<ProductDetail | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM products WHERE slug = ? AND active = 1`)
    .bind(slug)
    .first();
  if (row === null) return null;

  const id = readString(row, "id");
  const photos = await photoKeysByProduct(db, [id]);
  return toProductDetail(row, photos.get(id) ?? []);
}
