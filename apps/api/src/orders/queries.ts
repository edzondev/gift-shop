import * as v from "valibot";
import { fieldsSchema } from "../products/schemas";
import type { CreatedOrder, CreateOrderInput, Delivery, Field, PublicOrder } from "../types";
import { issuePath } from "../validation";
import {
  captureMeta,
  deliveryCostCents,
  detectCapture,
  earliestDeliveryDate,
  limaTimestamp,
  limaToday,
  MAX_CAPTURE_BYTES,
  newOrderToken,
  optionLabels,
  optionsJson,
  orderCode,
  orderIdFromCode,
  requestedQuantities,
  requestHash,
  tokenHash,
  tokenMatches,
  unavailableOptionIssues,
  uniqueProductIds,
  unitPriceCents,
} from "./logic";
import { deliverySchema, orderTextSchema, storedOptionsSchema } from "./schemas";

type Issue = { path: string; message: string };

export type CreateOrderResult =
  | { type: "created"; order: CreatedOrder }
  | { type: "replayed"; order: CreatedOrder }
  | { type: "validation"; issues: Issue[] }
  | { type: "file_too_large" }
  | { type: "unsupported_file_type" }
  | { type: "product_unavailable"; productIds: string[] }
  | { type: "out_of_stock"; productIds: string[] }
  | { type: "price_changed"; totalCents: number }
  | { type: "idempotency_conflict" }
  | { type: "delivery_date_too_soon" };

const orderProductSchema = v.object({
  id: v.string(),
  name: v.string(),
  price_cents: v.number(),
  stock: v.number(),
  prep_days: v.number(),
  fields: v.pipe(v.string(), v.parseJson(), fieldsSchema),
  large_extra_cents: v.number(),
  active: v.number(),
});

type OrderProduct = v.InferOutput<typeof orderProductSchema>;

const existingOrderSchema = v.object({
  id: v.number(),
  created_at: v.string(),
  subtotal_cents: v.number(),
  delivery_cost_cents: v.nullable(v.number()),
  request_hash: v.string(),
});

type ExistingOrder = v.InferOutput<typeof existingOrderSchema>;

const publicOrderRowSchema = v.object({
  id: v.number(),
  status: v.picklist([
    "por_verificar",
    "confirmado",
    "en_preparacion",
    "listo",
    "entregado",
    "rechazado",
  ]),
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
  token_hash: v.string(),
});

type PublicOrderRow = v.InferOutput<typeof publicOrderRowSchema>;

const orderItemRowSchema = v.object({
  product_name: v.string(),
  qty: v.number(),
  unit_price_cents: v.number(),
  options: v.pipe(v.string(), v.parseJson(), storedOptionsSchema),
});

const insertedIdSchema = v.object({ id: v.number() });

function issuesFrom(issues: readonly v.BaseIssue<unknown>[]): Issue[] {
  return issues.map((issue) => {
    const path = issuePath(issue);
    return { path: path === "" ? "order" : path, message: issue.message };
  });
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "";
  const cause = error.cause instanceof Error ? error.cause.message : "";
  return `${error.name} ${error.message} ${cause}`;
}

function batchFailure(error: unknown): "stock" | "idempotency" | "other" {
  const text = errorText(error);
  if (text.includes("UNIQUE") && text.includes("idempotency_key")) return "idempotency";
  if (text.includes("CHECK")) return "stock";
  return "other";
}

async function loadProducts(
  db: D1Database,
  ids: readonly string[],
): Promise<Map<string, OrderProduct>> {
  const products = new Map<string, OrderProduct>();
  if (ids.length === 0) return products;
  const marks = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id, name, price_cents, stock, prep_days, fields, large_extra_cents, active FROM products WHERE id IN (${marks})`,
    )
    .bind(...ids)
    .all();
  for (const raw of result.results) {
    const row = v.parse(orderProductSchema, raw);
    products.set(row.id, row);
  }
  return products;
}

function unavailableIds(
  items: CreateOrderInput["items"],
  products: ReadonlyMap<string, OrderProduct>,
): string[] {
  const ids: string[] = [];
  for (const item of items) {
    const product = products.get(item.productId);
    if ((product === undefined || product.active !== 1) && !ids.includes(item.productId)) {
      ids.push(item.productId);
    }
  }
  return ids;
}

function shortProductIds(
  items: CreateOrderInput["items"],
  products: ReadonlyMap<string, OrderProduct>,
): string[] {
  const requested = requestedQuantities(items);
  const ids: string[] = [];
  for (const item of items) {
    const qty = requested.get(item.productId);
    const product = products.get(item.productId);
    if (qty === undefined || product === undefined || product.stock < qty) {
      if (!ids.includes(item.productId)) ids.push(item.productId);
    }
  }
  return ids;
}

async function findExisting(db: D1Database, idempotencyKey: string): Promise<ExistingOrder | null> {
  const raw = await db
    .prepare(
      `SELECT id, created_at, subtotal_cents, delivery_cost_cents, request_hash
       FROM orders WHERE idempotency_key = ?`,
    )
    .bind(idempotencyKey)
    .first();
  if (raw === null) return null;
  return v.parse(existingOrderSchema, raw);
}

function createdFrom(row: ExistingOrder, token: string): CreateOrderResult {
  return {
    type: "replayed",
    order: {
      code: orderCode(row.created_at, row.id),
      token,
      status: "por_verificar",
      totalCents: row.subtotal_cents + (row.delivery_cost_cents ?? 0),
    },
  };
}

async function replay(
  db: D1Database,
  idempotencyKey: string,
  requestHashHex: string,
): Promise<CreateOrderResult> {
  const existing = await findExisting(db, idempotencyKey);
  if (existing === null) throw new Error("missing idempotent order");
  if (existing.request_hash !== requestHashHex) return { type: "idempotency_conflict" };
  const token = newOrderToken();
  const update = await db
    .prepare("UPDATE orders SET token_hash = ? WHERE id = ? AND request_hash = ?")
    .bind(await tokenHash(token), existing.id, requestHashHex)
    .run();
  if (update.meta.changes === 0) throw new Error("could not refresh order token");
  return createdFrom(existing, token);
}

function deliveryColumns(delivery: Delivery): {
  station: string | null;
  slot: string | null;
  address: string | null;
  district: string | null;
  reference: string | null;
} {
  if (delivery.mode === "estacion") {
    return {
      station: delivery.station,
      slot: delivery.slot,
      address: null,
      district: null,
      reference: null,
    };
  }
  return {
    station: null,
    slot: null,
    address: delivery.address,
    district: delivery.district,
    reference: delivery.reference ?? null,
  };
}

export async function createOrder(
  db: D1Database,
  files: R2Bucket,
  input: { idempotencyKey: string; orderText: string; capture: Uint8Array; now: Date },
): Promise<CreateOrderResult> {
  const parsed = v.safeParse(orderTextSchema, input.orderText, { abortPipeEarly: true });
  if (!parsed.success) return { type: "validation", issues: issuesFrom(parsed.issues) };
  const order = parsed.output;

  if (input.capture.byteLength > MAX_CAPTURE_BYTES) return { type: "file_too_large" };
  const kind = detectCapture(input.capture);
  if (kind === null) return { type: "unsupported_file_type" };

  const requestHashHex = await requestHash(input.orderText, input.capture);
  const existing = await findExisting(db, input.idempotencyKey);
  if (existing !== null) return replay(db, input.idempotencyKey, requestHashHex);

  const ids = uniqueProductIds(order.items);
  const products = await loadProducts(db, ids);
  const missing = unavailableIds(order.items, products);
  if (missing.length > 0) return { type: "product_unavailable", productIds: missing };

  const fields = new Map<string, readonly Field[]>();
  for (const [id, product] of products) fields.set(id, product.fields);
  const optionIssues = unavailableOptionIssues(order.items, fields);
  if (optionIssues.length > 0) return { type: "validation", issues: optionIssues };

  let subtotalCents = 0;
  const lines: {
    item: CreateOrderInput["items"][number];
    product: OrderProduct;
    unitCents: number;
  }[] = [];
  for (const item of order.items) {
    const product = products.get(item.productId);
    if (product === undefined) throw new Error("missing product");
    const unitCents = unitPriceCents(
      { priceCents: product.price_cents, largeExtraCents: product.large_extra_cents },
      item,
    );
    subtotalCents += unitCents * item.qty;
    lines.push({ item, product, unitCents });
  }
  const shipping = deliveryCostCents(order.delivery.mode);
  const totalCents = subtotalCents + (shipping ?? 0);
  if (order.expectedTotalCents !== totalCents) return { type: "price_changed", totalCents };

  const prepDays = lines.map((line) => line.product.prep_days);
  const earliest = earliestDeliveryDate(limaToday(input.now), prepDays);
  if (order.deliveryDate < earliest) return { type: "delivery_date_too_soon" };

  const short = shortProductIds(order.items, products);
  if (short.length > 0) return { type: "out_of_stock", productIds: short };

  const meta = captureMeta(kind);
  const captureKey = `captures/${crypto.randomUUID()}.${meta.extension}`;
  await files.put(captureKey, input.capture, { httpMetadata: { contentType: meta.contentType } });

  const token = newOrderToken();
  const createdAt = limaTimestamp(input.now);
  const place = deliveryColumns(order.delivery);
  let results: D1Result<unknown>[];
  try {
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO orders (
            idempotency_key, request_hash, token_hash, status,
            customer_name, phone, email,
            delivery_mode, station, slot, address, district, reference,
            delivery_date, note, subtotal_cents, delivery_cost_cents,
            yape_operation, capture_key, created_at
          ) VALUES (?, ?, ?, 'por_verificar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
        )
        .bind(
          input.idempotencyKey,
          requestHashHex,
          await tokenHash(token),
          order.customer.name,
          order.customer.phone,
          order.customer.email ?? null,
          order.delivery.mode,
          place.station,
          place.slot,
          place.address,
          place.district,
          place.reference,
          order.deliveryDate,
          order.note ?? null,
          subtotalCents,
          shipping,
          order.yapeOperation,
          captureKey,
          createdAt,
        ),
    ];
    for (const line of lines) {
      statements.push(
        db
          .prepare(
            `INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price_cents, options)
             VALUES ((SELECT id FROM orders WHERE idempotency_key = ?), ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.idempotencyKey,
            line.item.productId,
            line.product.name,
            line.item.qty,
            line.unitCents,
            optionsJson(line.item),
          ),
      );
    }
    for (const [productId, qty] of requestedQuantities(order.items)) {
      statements.push(
        db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(qty, productId),
      );
    }
    results = await db.batch(statements);
  } catch (error) {
    await files.delete(captureKey);
    const failure = batchFailure(error);
    if (failure === "idempotency") return replay(db, input.idempotencyKey, requestHashHex);
    if (failure === "stock") {
      const fresh = await loadProducts(db, ids);
      const productIds = shortProductIds(order.items, fresh);
      if (productIds.length > 0) return { type: "out_of_stock", productIds };
    }
    throw error;
  }

  const parsedId = v.safeParse(insertedIdSchema, results[0]?.results[0]);
  const id = parsedId.success ? parsedId.output.id : results[0]?.meta.last_row_id;
  if (id === undefined || id === 0) throw new Error("missing order id");
  return {
    type: "created",
    order: { code: orderCode(createdAt, id), token, status: "por_verificar", totalCents },
  };
}

function deliveryFrom(row: PublicOrderRow): Delivery {
  if (row.delivery_mode === "estacion") {
    return v.parse(deliverySchema, { mode: "estacion", station: row.station, slot: row.slot });
  }
  return v.parse(deliverySchema, {
    mode: "delivery",
    address: row.address,
    district: row.district,
    ...(row.reference === null ? {} : { reference: row.reference }),
  });
}

function publicOrder(row: PublicOrderRow, items: PublicOrder["items"]): PublicOrder {
  const base = {
    code: orderCode(row.created_at, row.id),
    createdAt: row.created_at,
    delivery: deliveryFrom(row),
    deliveryDate: row.delivery_date,
    items,
    subtotalCents: row.subtotal_cents,
    deliveryCostCents: row.delivery_cost_cents,
    yapeOperation: row.yape_operation,
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

export async function readPublicOrder(
  db: D1Database,
  code: string,
  token: string | undefined,
): Promise<PublicOrder | null> {
  const id = orderIdFromCode(code);
  if (id === null) return null;
  const raw = await db
    .prepare(
      `SELECT id, status, delivery_mode, station, slot, address, district, reference,
        delivery_date, subtotal_cents, delivery_cost_cents, yape_operation, created_at,
        verified_at, delivered_at, rejected_at, token_hash
       FROM orders WHERE id = ?`,
    )
    .bind(id)
    .first();
  const row = raw === null ? null : v.parse(publicOrderRowSchema, raw);
  const matches = await tokenMatches(token ?? "", row === null ? "" : row.token_hash);
  if (row === null || token === undefined || !matches) return null;

  const items = await db
    .prepare(
      `SELECT product_name, qty, unit_price_cents, options
       FROM order_items WHERE order_id = ? ORDER BY id`,
    )
    .bind(row.id)
    .all();
  return publicOrder(
    row,
    items.results.map((rawItem) => {
      const item = v.parse(orderItemRowSchema, rawItem);
      const labeled = optionLabels(item.options);
      return {
        productName: item.product_name,
        qty: item.qty,
        options: labeled.labels,
        cardMessage: labeled.cardMessage,
        lineTotalCents: item.unit_price_cents * item.qty,
      };
    }),
  );
}
