import * as v from "valibot";
import {
  addDays,
  limaTimestamp,
  limaToday,
  optionLabels,
  orderCode,
  orderCodeParts,
  orderIdFromCode,
} from "../orders/logic";
import { deliveryFrom } from "../orders/queries";
import { storedOptionsSchema } from "../orders/schemas";
import { encodeCursor } from "../products/schemas";
import type { AdminOrder, AdminOrderRow, AdminSummary, OrderLine, OrderStatus } from "../types";
import { canTransition, containsNonAscii, dayStart, itemsShort, likeContains } from "./logic";
import { type OrdersQuery, orderStatusSchema } from "./schemas";

const ORDER_COLUMNS = `id, status, customer_name, phone, email, note,
  delivery_mode, station, slot, address, district, reference,
  delivery_date, subtotal_cents, delivery_cost_cents, yape_operation,
  created_at, verified_at, delivered_at, rejected_at`;

const orderRowSchema = v.object({
  id: v.number(),
  status: orderStatusSchema,
  customer_name: v.string(),
  phone: v.string(),
  email: v.nullable(v.string()),
  note: v.nullable(v.string()),
  delivery_mode: v.picklist(["estacion", "delivery"]),
  station: v.nullable(v.string()),
  slot: v.nullable(v.string()),
  address: v.nullable(v.string()),
  district: v.nullable(v.string()),
  reference: v.nullable(v.string()),
  delivery_date: v.string(),
  subtotal_cents: v.number(),
  delivery_cost_cents: v.nullable(v.number()),
  yape_operation: v.string(),
  created_at: v.string(),
  verified_at: v.nullable(v.string()),
  delivered_at: v.nullable(v.string()),
  rejected_at: v.nullable(v.string()),
});

type OrderRow = v.InferOutput<typeof orderRowSchema>;

const shortItemSchema = v.object({
  order_id: v.number(),
  product_name: v.string(),
  qty: v.number(),
});

const itemRowSchema = v.object({
  product_name: v.string(),
  qty: v.number(),
  unit_price_cents: v.number(),
  options: v.pipe(v.string(), v.parseJson(), storedOptionsSchema),
});

const joinedItemSchema = v.object({
  product_name: v.nullable(v.string()),
  qty: v.nullable(v.number()),
  unit_price_cents: v.nullable(v.number()),
  options: v.nullable(v.string()),
});

const countSchema = v.object({
  new_today: v.number(),
  to_verify: v.number(),
  week_sales: v.number(),
});

const stockSchema = v.object({
  id: v.string(),
  name: v.string(),
  stock: v.number(),
});

const statusSchema = v.object({
  id: v.number(),
  status: orderStatusSchema,
});

const UPDATE_STATUS = `UPDATE orders
  SET status = ?,
      verified_at = CASE WHEN ? = 'confirmado' THEN ? ELSE verified_at END,
      delivered_at = CASE WHEN ? = 'entregado' THEN ? ELSE delivered_at END,
      rejected_at = CASE WHEN ? = 'rechazado' THEN ? ELSE rejected_at END
  WHERE id = ? AND status = ?`;

const RESTORE_STOCK = `UPDATE products
  SET stock = stock + (
    SELECT COALESCE(SUM(qty), 0) FROM order_items
    WHERE order_id = ? AND product_id = products.id
  )
  WHERE changes() = 1
    AND ? = 'rechazado'
    AND id IN (SELECT product_id FROM order_items WHERE order_id = ?)`;

function lineFrom(item: v.InferOutput<typeof itemRowSchema>): OrderLine {
  const labeled = optionLabels(item.options);
  return {
    productName: item.product_name,
    qty: item.qty,
    options: labeled.labels,
    cardMessage: labeled.cardMessage,
    lineTotalCents: item.unit_price_cents * item.qty,
  };
}

function toAdminOrderRow(row: OrderRow, short: string): AdminOrderRow {
  const base = {
    code: orderCode(row.created_at, row.id),
    customerName: row.customer_name,
    itemsShort: short,
    delivery: deliveryFrom(row),
    deliveryDate: row.delivery_date,
    totalCents: row.subtotal_cents + (row.delivery_cost_cents ?? 0),
    createdAt: row.created_at,
  };
  switch (row.status) {
    case "por_verificar":
      return { ...base, status: "por_verificar" };
    case "confirmado":
    case "en_preparacion":
    case "listo":
      if (row.verified_at === null) throw new Error("incomplete order");
      return { ...base, status: row.status, verifiedAt: row.verified_at };
    case "entregado":
      if (row.verified_at === null || row.delivered_at === null)
        throw new Error("incomplete order");
      return {
        ...base,
        status: "entregado",
        verifiedAt: row.verified_at,
        deliveredAt: row.delivered_at,
      };
    case "rechazado":
      if (row.rejected_at === null) throw new Error("incomplete order");
      return { ...base, status: "rechazado", rejectedAt: row.rejected_at };
  }
}

function toAdminOrder(row: OrderRow, items: OrderLine[]): AdminOrder {
  const base = {
    code: orderCode(row.created_at, row.id),
    createdAt: row.created_at,
    delivery: deliveryFrom(row),
    deliveryDate: row.delivery_date,
    items,
    subtotalCents: row.subtotal_cents,
    deliveryCostCents: row.delivery_cost_cents,
    yapeOperation: row.yape_operation,
    customer: { name: row.customer_name, phone: row.phone, email: row.email },
    note: row.note,
  };
  switch (row.status) {
    case "por_verificar":
      return { ...base, status: "por_verificar" };
    case "confirmado":
    case "en_preparacion":
    case "listo":
      if (row.verified_at === null) throw new Error("incomplete order");
      return { ...base, status: row.status, verifiedAt: row.verified_at };
    case "entregado":
      if (row.verified_at === null || row.delivered_at === null)
        throw new Error("incomplete order");
      return {
        ...base,
        status: "entregado",
        verifiedAt: row.verified_at,
        deliveredAt: row.delivered_at,
      };
    case "rechazado":
      if (row.rejected_at === null) throw new Error("incomplete order");
      return { ...base, status: "rechazado", rejectedAt: row.rejected_at };
  }
}

async function namesByOrder(
  db: D1Database,
  ids: readonly number[],
): Promise<Map<number, { name: string; qty: number }[]>> {
  const grouped = new Map<number, { name: string; qty: number }[]>();
  if (ids.length === 0) return grouped;
  const marks = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT order_id, product_name, qty FROM order_items WHERE order_id IN (${marks}) ORDER BY id`,
    )
    .bind(...ids)
    .all();
  for (const raw of result.results) {
    const item = v.parse(shortItemSchema, raw);
    const list = grouped.get(item.order_id);
    const entry = { name: item.product_name, qty: item.qty };
    if (list === undefined) grouped.set(item.order_id, [entry]);
    else list.push(entry);
  }
  return grouped;
}

function resultRows(result: D1Result | undefined): unknown[] {
  return result?.results ?? [];
}

export async function readSummary(db: D1Database, now: Date): Promise<AdminSummary> {
  const today = limaToday(now);
  const start = dayStart(today);
  const next = dayStart(addDays(today, 1));
  const weekStart = dayStart(addDays(today, -6));
  const [counts, pending, upcoming, low] = await db.batch([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM orders WHERE created_at >= ? AND created_at < ?) AS new_today,
          (SELECT COUNT(*) FROM orders WHERE status = 'por_verificar') AS to_verify,
          (SELECT COALESCE(SUM(subtotal_cents + COALESCE(delivery_cost_cents, 0)), 0)
            FROM orders
            WHERE status != 'rechazado' AND verified_at >= ? AND verified_at < ?) AS week_sales`,
      )
      .bind(start, next, weekStart, next),
    db.prepare(
      `SELECT ${ORDER_COLUMNS} FROM orders
       WHERE status = 'por_verificar'
       ORDER BY created_at ASC, id ASC
       LIMIT 5`,
    ),
    db
      .prepare(
        `SELECT ${ORDER_COLUMNS} FROM orders
         WHERE status != 'entregado' AND status != 'rechazado' AND delivery_date >= ?
         ORDER BY delivery_date ASC, id ASC
         LIMIT 3`,
      )
      .bind(today),
    db.prepare("SELECT id, name, stock FROM products WHERE stock <= 3 ORDER BY stock ASC, id ASC"),
  ]);
  const countRow = resultRows(counts)[0];
  if (countRow === undefined) throw new Error("missing summary");
  const parsed = v.parse(countSchema, countRow);
  const pendingRows = resultRows(pending).map((raw) => v.parse(orderRowSchema, raw));
  const upcomingRows = resultRows(upcoming).map((raw) => v.parse(orderRowSchema, raw));
  const names = await namesByOrder(
    db,
    [...pendingRows, ...upcomingRows].map((row) => row.id),
  );
  return {
    newToday: parsed.new_today,
    toVerify: parsed.to_verify,
    weekVerifiedSalesCents: parsed.week_sales,
    pending: pendingRows.map((row) => toAdminOrderRow(row, itemsShort(names.get(row.id) ?? []))),
    upcoming: upcomingRows.map((row) => toAdminOrderRow(row, itemsShort(names.get(row.id) ?? []))),
    lowStock: resultRows(low).map((raw) => v.parse(stockSchema, raw)),
  };
}

export async function searchOrders(
  db: D1Database,
  query: OrdersQuery,
): Promise<{ items: AdminOrderRow[]; nextCursor: string | null }> {
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (query.status !== undefined) {
    where.push("status = ?");
    binds.push(query.status);
  }
  if (query.cursor !== undefined) {
    where.push("id < ?");
    binds.push(query.cursor);
  }
  if (query.q !== undefined) {
    const code = orderCodeParts(query.q);
    const nameMatch = containsNonAscii(query.q)
      ? "instr(customer_name, ?) > 0"
      : "customer_name LIKE ? ESCAPE '\\'";
    where.push(`(${nameMatch} OR (id = ? AND substr(created_at, 1, 4) = ?))`);
    binds.push(
      containsNonAscii(query.q) ? query.q : likeContains(query.q),
      code?.id ?? 0,
      code?.year ?? "",
    );
  }
  binds.push(query.limit + 1);
  const filter = where.length === 0 ? "" : `WHERE ${where.join(" AND ")}`;
  const result = await db
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders ${filter} ORDER BY id DESC LIMIT ?`)
    .bind(...binds)
    .all();
  const hasMore = result.results.length > query.limit;
  const page = (hasMore ? result.results.slice(0, query.limit) : result.results).map((raw) =>
    v.parse(orderRowSchema, raw),
  );
  const names = await namesByOrder(
    db,
    page.map((row) => row.id),
  );
  const last = page[page.length - 1];
  return {
    items: page.map((row) => toAdminOrderRow(row, itemsShort(names.get(row.id) ?? []))),
    nextCursor: hasMore && last !== undefined ? encodeCursor(String(last.id)) : null,
  };
}

export async function readAdminOrder(db: D1Database, code: string): Promise<AdminOrder | null> {
  const id = orderIdFromCode(code);
  if (id === null) return null;
  const result = await db
    .prepare(
      `SELECT orders.id AS id, orders.status AS status, orders.customer_name AS customer_name,
        orders.phone AS phone, orders.email AS email, orders.note AS note,
        orders.delivery_mode AS delivery_mode, orders.station AS station, orders.slot AS slot,
        orders.address AS address, orders.district AS district, orders.reference AS reference,
        orders.delivery_date AS delivery_date, orders.subtotal_cents AS subtotal_cents,
        orders.delivery_cost_cents AS delivery_cost_cents, orders.yape_operation AS yape_operation,
        orders.created_at AS created_at, orders.verified_at AS verified_at,
        orders.delivered_at AS delivered_at, orders.rejected_at AS rejected_at,
        order_items.product_name AS product_name, order_items.qty AS qty,
        order_items.unit_price_cents AS unit_price_cents, order_items.options AS options
       FROM orders
       LEFT JOIN order_items ON order_items.order_id = orders.id
       WHERE orders.id = ?
       ORDER BY order_items.id`,
    )
    .bind(id)
    .all();
  const first = result.results[0];
  if (first === undefined) return null;
  const items: OrderLine[] = [];
  for (const raw of result.results) {
    const joined = v.parse(joinedItemSchema, raw);
    if (
      joined.product_name === null ||
      joined.qty === null ||
      joined.unit_price_cents === null ||
      joined.options === null
    ) {
      continue;
    }
    items.push(
      lineFrom(
        v.parse(itemRowSchema, {
          product_name: joined.product_name,
          qty: joined.qty,
          unit_price_cents: joined.unit_price_cents,
          options: joined.options,
        }),
      ),
    );
  }
  return toAdminOrder(v.parse(orderRowSchema, first), items);
}

export async function readCapture(
  db: D1Database,
  files: R2Bucket,
  code: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  const id = orderIdFromCode(code);
  if (id === null) return null;
  const raw = await db.prepare("SELECT capture_key FROM orders WHERE id = ?").bind(id).first();
  if (raw === null) return null;
  const row = v.parse(v.object({ capture_key: v.string() }), raw);
  const object = await files.get(row.capture_key);
  if (object === null) return null;
  const contentType = object.httpMetadata?.contentType;
  return {
    body: object.body,
    contentType:
      contentType === undefined || contentType === "" ? "application/octet-stream" : contentType,
  };
}

export async function commitStatus(
  db: D1Database,
  id: number,
  from: OrderStatus,
  to: OrderStatus,
  at: string,
): Promise<boolean> {
  const results = await db.batch([
    db.prepare(UPDATE_STATUS).bind(to, to, at, to, at, to, at, id, from),
    db.prepare(RESTORE_STOCK).bind(id, to, id),
  ]);
  return results[0]?.meta.changes === 1;
}

export async function setOrderStatus(
  db: D1Database,
  input: { code: string; to: OrderStatus; now: Date },
): Promise<
  { type: "not_found" } | { type: "invalid_transition" } | { type: "ok"; order: AdminOrder }
> {
  const id = orderIdFromCode(input.code);
  if (id === null) return { type: "not_found" };
  const raw = await db.prepare("SELECT id, status FROM orders WHERE id = ?").bind(id).first();
  if (raw === null) return { type: "not_found" };
  const current = v.parse(statusSchema, raw);
  if (!canTransition(current.status, input.to)) return { type: "invalid_transition" };
  const changed = await commitStatus(
    db,
    current.id,
    current.status,
    input.to,
    limaTimestamp(input.now),
  );
  if (!changed) return { type: "invalid_transition" };
  const order = await readAdminOrder(db, input.code);
  if (order === null) throw new Error("missing order");
  return { type: "ok", order };
}
