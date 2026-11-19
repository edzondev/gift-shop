import * as v from "valibot";
import { limaTimestamp } from "../orders/logic";
import { productRowSchema, toAdminProduct } from "../products/mappers";
import { PRODUCT_COLUMNS, photosByProduct } from "../products/queries";
import { encodeCursor } from "../products/schemas";
import type { AdminProduct, Page, ProductInput } from "../types";
import {
  type Assignment,
  inspectPhoto,
  isPhotoPositionConflict,
  isSlugConflict,
  patchAssignments,
  updateProductsSql,
} from "./logic";
import type { AdminProductsQuery, ProductPatch } from "./schemas";

const activeSchema = v.object({ active: v.number() });
const insertedPhotoSchema = v.object({ id: v.string(), r2_key: v.string() });
const deletedPhotoSchema = v.object({ r2_key: v.string() });

const INSERT_PHOTO = `INSERT INTO product_photos (id, product_id, r2_key, position)
SELECT ?, ?, ?, (
  SELECT MIN(candidate.pos)
  FROM (
    SELECT 1 AS pos
    UNION ALL SELECT 2
    UNION ALL SELECT 3
  ) AS candidate
  WHERE NOT EXISTS (
    SELECT 1 FROM product_photos AS taken
    WHERE taken.product_id = ? AND taken.position = candidate.pos
  )
)
WHERE (SELECT COUNT(*) FROM product_photos WHERE product_id = ?) < 3
RETURNING id, r2_key`;

function adminProduct(raw: unknown, photos: { id: string; key: string }[]): AdminProduct {
  const row = v.parse(productRowSchema, raw);
  const active = v.parse(activeSchema, raw).active === 1;
  return toAdminProduct(row, active, photos);
}

async function readAdminProduct(db: D1Database, id: string): Promise<AdminProduct | null> {
  const raw = await db
    .prepare(`SELECT ${PRODUCT_COLUMNS}, active FROM products WHERE id = ?`)
    .bind(id)
    .first();
  if (raw === null) return null;
  const photos = await photosByProduct(db, [id]);
  return adminProduct(raw, photos.get(id) ?? []);
}

export async function listAdminProducts(
  db: D1Database,
  query: AdminProductsQuery,
): Promise<Page<AdminProduct>> {
  const binds: (string | number)[] = [];
  const where = query.cursor === undefined ? "" : "WHERE id > ?";
  if (query.cursor !== undefined) binds.push(query.cursor);
  binds.push(query.limit + 1);

  const result = await db
    .prepare(`SELECT ${PRODUCT_COLUMNS}, active FROM products ${where} ORDER BY id LIMIT ?`)
    .bind(...binds)
    .all();

  const hasMore = result.results.length > query.limit;
  const raws = hasMore ? result.results.slice(0, query.limit) : result.results;
  const rows = raws.map((raw) => v.parse(productRowSchema, raw));
  const photos = await photosByProduct(
    db,
    rows.map((row) => row.id),
  );
  const items = raws.map((raw, index) => {
    const row = rows[index];
    if (row === undefined) throw new Error("missing product row");
    return adminProduct(raw, photos.get(row.id) ?? []);
  });
  const last = rows[rows.length - 1];

  return {
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(last.id) : null,
  };
}

export async function createProduct(
  db: D1Database,
  input: ProductInput,
  now: Date,
): Promise<{ type: "created"; product: AdminProduct } | { type: "slug_taken" }> {
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO products (
          id, slug, name, price_cents, old_price_cents, stock, prep_days, description,
          fields, occasions, tag, size_classic, size_large, large_extra_cents, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.slug,
        input.name,
        input.priceCents,
        input.oldPriceCents,
        input.initialStock ?? 0,
        input.prepDays,
        input.description,
        JSON.stringify(input.fields),
        JSON.stringify(input.occasions),
        input.tag,
        input.sizes.classic,
        input.sizes.large,
        input.sizes.largeExtraCents,
        input.active ? 1 : 0,
        limaTimestamp(now),
      )
      .run();
  } catch (error) {
    if (isSlugConflict(error)) return { type: "slug_taken" };
    throw error;
  }

  const product = await readAdminProduct(db, id);
  if (product === null) throw new Error("product insert did not persist");
  return { type: "created", product };
}

export async function patchProduct(
  db: D1Database,
  id: string,
  input: ProductPatch,
): Promise<
  { type: "updated"; product: AdminProduct } | { type: "not_found" } | { type: "slug_taken" }
> {
  const assignments = patchAssignments(input);
  try {
    const raw = await db
      .prepare(updateProductsSql(assignments.map((item: Assignment) => item.column)))
      .bind(...assignments.map((item) => item.value), id)
      .first();
    if (raw === null) return { type: "not_found" };
  } catch (error) {
    if (isSlugConflict(error)) return { type: "slug_taken" };
    throw error;
  }

  const product = await readAdminProduct(db, id);
  if (product === null) return { type: "not_found" };
  return { type: "updated", product };
}

export async function adjustStock(
  db: D1Database,
  id: string,
  delta: number,
): Promise<
  { type: "updated"; product: AdminProduct } | { type: "not_found" } | { type: "out_of_stock" }
> {
  const updated = await db
    .prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0")
    .bind(delta, id, delta)
    .run();
  if (updated.meta.changes === 1) {
    const product = await readAdminProduct(db, id);
    if (product === null) return { type: "not_found" };
    return { type: "updated", product };
  }

  const existing = await db.prepare("SELECT 1 AS ok FROM products WHERE id = ?").bind(id).first();
  if (existing === null) return { type: "not_found" };
  return { type: "out_of_stock" };
}

async function insertPhoto(
  db: D1Database,
  photoId: string,
  productId: string,
  key: string,
): Promise<{ id: string; key: string } | null | "conflict"> {
  try {
    const raw = await db
      .prepare(INSERT_PHOTO)
      .bind(photoId, productId, key, productId, productId)
      .first();
    if (raw === null) return null;
    const row = v.parse(insertedPhotoSchema, raw);
    return { id: row.id, key: row.r2_key };
  } catch (error) {
    if (isPhotoPositionConflict(error)) return "conflict";
    throw error;
  }
}

export async function addProductPhoto(
  db: D1Database,
  bucket: R2Bucket,
  input: { productId: string; bytes: Uint8Array },
): Promise<
  | { type: "not_found" }
  | { type: "file_too_large" }
  | { type: "unsupported_file_type" }
  | { type: "too_many" }
  | { type: "created"; id: string; key: string }
> {
  const existing = await db
    .prepare("SELECT 1 AS ok FROM products WHERE id = ?")
    .bind(input.productId)
    .first();
  if (existing === null) return { type: "not_found" };

  const checked = inspectPhoto(input.bytes);
  if (!checked.ok) return { type: checked.reason };

  const photoId = crypto.randomUUID();
  const key = `photos/${photoId}.${checked.extension}`;
  await bucket.put(key, input.bytes, { httpMetadata: { contentType: checked.contentType } });

  const first = await insertPhoto(db, photoId, input.productId, key);
  const inserted =
    first === "conflict" ? await insertPhoto(db, photoId, input.productId, key) : first;
  if (inserted === null || inserted === "conflict") {
    await bucket.delete(key);
    return { type: "too_many" };
  }
  return { type: "created", id: inserted.id, key: inserted.key };
}

export async function deleteProductPhoto(
  db: D1Database,
  bucket: R2Bucket,
  productId: string,
  photoId: string,
): Promise<boolean> {
  const raw = await db
    .prepare("DELETE FROM product_photos WHERE id = ? AND product_id = ? RETURNING r2_key")
    .bind(photoId, productId)
    .first();
  if (raw === null) return false;
  await bucket.delete(v.parse(deletedPhotoSchema, raw).r2_key);
  return true;
}
